using Estudae.Api.Endpoints;
using Estudae.Domain.Progresso;
using Estudae.Infra.Identity;
using Estudae.Infra.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using static Estudae.Api.Endpoints.ConteudoEndpoints;

namespace Estudae.Api.Progresso;

// Progresso do aluno com conta (contrato em docs/api.md, "Progresso do aluno").
// Tudo exige login e é sempre do usuário do cookie: nenhum id de usuário vem
// na URL ou no corpo. Visitante continua só no localStorage.
//
// Regras:
// - O servidor calcula o acertou (o front manda só o texto escolhido).
// - Sessão é idempotente pela chave do front: reenviar devolve a já gravada.
// - Nada derivado é guardado; acertos e total do DTO saem das tentativas.
public static class ProgressoEndpoints
{
    // ---- DTOs ----
    public sealed record TentativaResumoDto(int QuestaoId, string Tema, bool Acertou, bool EmBranco);
    public sealed record SessaoResumoDto(
        long Id, string Chave, string Tipo, string Disciplina, string? Tema, bool Treino,
        DateTime IniciadaEm, DateTime ConcluidaEm, int? TempoLimiteSeg,
        int Acertos, int Total, List<TentativaResumoDto> Tentativas);
    public sealed record AulaDto(int VideoaulaId, DateTime AssistidaEm);
    public sealed record ProgressoDto(List<SessaoResumoDto> Sessoes, List<AulaDto> Aulas);

    public sealed record TentativaDetalheDto(
        int QuestaoId, int Ordem, string Tema, string? TextoBase, string Enunciado, List<string> Alternativas,
        ImagemDto? Imagem, string? Escolhida, string RespostaCorreta, string Resolucao, bool Acertou);
    public sealed record SessaoDetalheDto(
        long Id, string Chave, string Tipo, string Disciplina, string? Tema, bool Treino,
        DateTime IniciadaEm, DateTime ConcluidaEm, int? TempoLimiteSeg,
        int Acertos, int Total, List<TentativaDetalheDto> Questoes);

    public sealed record AulaImportRequest(int VideoaulaId, DateTimeOffset? AssistidaEm);
    public sealed record ImportarRequest(List<SessaoRequest>? Sessoes, List<AulaImportRequest>? Aulas);
    // Posição = índice em "sessoes" do pedido, para o front saber qual foi.
    public sealed record IgnoradaDto(int Posicao, string? Chave, string Erro);
    public sealed record ImportacaoDto(
        int SessoesNovas, int SessoesRepetidas, List<IgnoradaDto> SessoesIgnoradas, int AulasNovas, int AulasIgnoradas);

    public const int MaxSessoesImportar = 500;
    public const int MaxAulasImportar = 1000;

    private const string ErroSemConta = "Você precisa entrar na sua conta.";

    public static void MapProgresso(this IEndpointRouteBuilder app)
    {
        var p = app.MapGroup("/api/progresso").RequireAuthorization();
        p.MapGet("", Listar);
        p.MapPost("/sessoes", Gravar);
        p.MapGet("/sessoes/{id:long}", Detalhe);
        p.MapPut("/aulas/{videoaulaId:int}", MarcarAula);
        p.MapDelete("/aulas/{videoaulaId:int}", DesmarcarAula);
        p.MapPost("/importar", Importar);
    }

    // ---- leitura ----

    private static async Task<IResult> Listar(HttpContext http, UserManager<Usuario> usuarios, EstudaeDbContext db, CancellationToken ct)
    {
        var usuarioId = await UsuarioAtual(http, usuarios, db, ct);
        if (usuarioId is null) return SemConta();

        // Da mais antiga para a mais nova, como o estudae:results do front.
        var sessoes = await Resumos(db.SessoesEstudo
                .Where(s => s.UsuarioId == usuarioId)
                .OrderBy(s => s.ConcluidaEm).ThenBy(s => s.Id))
            .AsSplitQuery()
            .ToListAsync(ct);
        var aulas = await db.AulasAssistidas
            .Where(a => a.UsuarioId == usuarioId)
            .OrderBy(a => a.AssistidaEm)
            .Select(a => new AulaDto(a.VideoaulaId, a.AssistidaEm))
            .ToListAsync(ct);
        return TypedResults.Ok(new ProgressoDto(sessoes, aulas));
    }

    // Para a tela de Resultado: enunciado, alternativas, gabarito e resolução de
    // cada questão. Pode mostrar o gabarito porque o aluno já respondeu.
    private static async Task<IResult> Detalhe(
        long id, HttpContext http, UserManager<Usuario> usuarios, EstudaeDbContext db, CancellationToken ct)
    {
        var usuarioId = await UsuarioAtual(http, usuarios, db, ct);
        if (usuarioId is null) return SemConta();

        // Sessão de outra pessoa responde 404, como se não existisse.
        var detalhe = await db.SessoesEstudo
            .Where(s => s.Id == id && s.UsuarioId == usuarioId)
            .Select(s => new SessaoDetalheDto(
                s.Id, s.Chave, s.Tipo, s.Disciplina.Slug, s.Tema == null ? null : s.Tema.Slug, s.Treino,
                s.IniciadaEm, s.ConcluidaEm, s.TempoLimiteSeg,
                s.Tentativas.Count(t => t.Acertou), s.Tentativas.Count,
                s.Tentativas.OrderBy(t => t.Ordem).Select(t => new TentativaDetalheDto(
                    t.QuestaoId, t.Ordem, t.Questao.Tema.Slug, t.Questao.TextoBase, t.Questao.Enunciado,
                    t.Questao.Alternativas,
                    t.Questao.ImagemUrl == null ? null : new ImagemDto("conteudo/imagens/" + t.Questao.ImagemUrl, t.Questao.ImagemDescricao),
                    t.AlternativaEscolhida, t.Questao.RespostaCorreta, t.Questao.Resolucao, t.Acertou)).ToList()))
            .AsSplitQuery()
            .SingleOrDefaultAsync(ct);
        return detalhe is null
            ? TypedResults.NotFound(new ProblemaDto($"Sessão {id} não encontrada."))
            : TypedResults.Ok(detalhe);
    }

    // ---- gravar uma sessão ----

    private static async Task<IResult> Gravar(
        SessaoRequest corpo, HttpContext http, UserManager<Usuario> usuarios, EstudaeDbContext db,
        TimeProvider relogio, CancellationToken ct)
    {
        var usuarioId = await UsuarioAtual(http, usuarios, db, ct);
        if (usuarioId is null) return SemConta();

        var (valida, erro) = ValidacaoProgresso.Sessao(corpo, relogio.GetUtcNow().UtcDateTime);
        if (valida is null) return Invalido(erro!);

        // Já gravada (o front reenviou): devolve a mesma, 200 em vez de 201.
        var existente = await Existente(db, usuarioId, valida.Chave, ct);
        if (existente is not null) return TypedResults.Ok(existente);

        var conteudo = await ConteudoDasSessoes.CarregarAsync(db, [valida], ct);
        var (sessao, erroConteudo) = conteudo.Montar(usuarioId, valida);
        if (sessao is null) return Invalido(erroConteudo!);

        db.SessoesEstudo.Add(sessao);
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException e) when (Unica(e))
        {
            // Dois envios iguais ao mesmo tempo: o outro ganhou.
            return TypedResults.Ok(await Existente(db, usuarioId, valida.Chave, ct));
        }

        return TypedResults.Created($"/api/progresso/sessoes/{sessao.Id}", Resumo(sessao, conteudo));
    }

    // ---- aulas assistidas (liga/desliga) ----

    private static async Task<IResult> MarcarAula(
        int videoaulaId, HttpContext http, UserManager<Usuario> usuarios, EstudaeDbContext db,
        TimeProvider relogio, CancellationToken ct)
    {
        var usuarioId = await UsuarioAtual(http, usuarios, db, ct);
        if (usuarioId is null) return SemConta();

        if (!await db.Videoaulas.AnyAsync(v => v.Id == videoaulaId, ct))
            return TypedResults.NotFound(new ProblemaDto($"Vídeo-aula {videoaulaId} não encontrada."));

        // Já marcada: fica a data da primeira vez.
        if (await db.AulasAssistidas.AnyAsync(a => a.UsuarioId == usuarioId && a.VideoaulaId == videoaulaId, ct))
            return TypedResults.NoContent();

        db.AulasAssistidas.Add(new AulaAssistida
        {
            UsuarioId = usuarioId, VideoaulaId = videoaulaId, AssistidaEm = relogio.GetUtcNow().UtcDateTime,
        });
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException e) when (Unica(e)) { }
        return TypedResults.NoContent();
    }

    private static async Task<IResult> DesmarcarAula(
        int videoaulaId, HttpContext http, UserManager<Usuario> usuarios, EstudaeDbContext db, CancellationToken ct)
    {
        var usuarioId = await UsuarioAtual(http, usuarios, db, ct);
        if (usuarioId is null) return SemConta();

        await db.AulasAssistidas
            .Where(a => a.UsuarioId == usuarioId && a.VideoaulaId == videoaulaId)
            .ExecuteDeleteAsync(ct);
        return TypedResults.NoContent();
    }

    // ---- importar o localStorage (primeiro login no aparelho) ----

    // Ao contrário do POST /sessoes, um item ruim não derruba o lote: é ignorado e
    // listado (questão que saiu do ar, resultado antigo...). Repetir o pedido é
    // seguro: sessões pela chave, aulas pela chave da tabela.
    private static async Task<IResult> Importar(
        ImportarRequest corpo, HttpContext http, UserManager<Usuario> usuarios, EstudaeDbContext db,
        TimeProvider relogio, CancellationToken ct)
    {
        var usuarioId = await UsuarioAtual(http, usuarios, db, ct);
        if (usuarioId is null) return SemConta();

        var pedidos = corpo.Sessoes ?? [];
        var aulasPedidas = corpo.Aulas ?? [];
        if (pedidos.Count > MaxSessoesImportar)
            return Invalido($"Envie no máximo {MaxSessoesImportar} sessões por vez.");
        if (aulasPedidas.Count > MaxAulasImportar)
            return Invalido($"Envie no máximo {MaxAulasImportar} aulas por vez.");

        var agora = relogio.GetUtcNow().UtcDateTime;
        var ignoradas = new List<IgnoradaDto>();
        var validas = new List<(int Posicao, SessaoValida Sessao)>();
        for (var i = 0; i < pedidos.Count; i++)
        {
            var (v, erro) = ValidacaoProgresso.Sessao(pedidos[i], agora);
            if (v is null) ignoradas.Add(new IgnoradaDto(i, pedidos[i]?.Chave, erro!));
            else validas.Add((i, v));
        }

        // Repetidas: já no banco, ou a mesma chave mais de uma vez no próprio lote.
        var chaves = validas.Select(v => v.Sessao.Chave).Distinct().ToList();
        var jaGravadas = (await db.SessoesEstudo
            .Where(s => s.UsuarioId == usuarioId && chaves.Contains(s.Chave))
            .Select(s => s.Chave)
            .ToListAsync(ct)).ToHashSet(StringComparer.Ordinal);
        var repetidas = 0;
        var novas = new List<(int Posicao, SessaoValida Sessao)>();
        foreach (var v in validas)
        {
            if (jaGravadas.Add(v.Sessao.Chave)) novas.Add(v);
            else repetidas++;
        }

        var conteudo = await ConteudoDasSessoes.CarregarAsync(db, novas.Select(n => n.Sessao).ToList(), ct);
        var gravadas = 0;
        foreach (var (posicao, v) in novas)
        {
            var (sessao, erro) = conteudo.Montar(usuarioId, v);
            if (sessao is null) { ignoradas.Add(new IgnoradaDto(posicao, v.Chave, erro!)); continue; }
            db.SessoesEstudo.Add(sessao);
            gravadas++;
        }

        // Aulas: vídeo que não existe mais ou data absurda é ignorado; já marcada
        // fica com a data que tinha.
        var idsAulas = aulasPedidas.Select(a => a.VideoaulaId).Distinct().ToList();
        var existentes = (await db.Videoaulas.Where(v => idsAulas.Contains(v.Id)).Select(v => v.Id).ToListAsync(ct)).ToHashSet();
        var marcadas = (await db.AulasAssistidas
            .Where(a => a.UsuarioId == usuarioId && idsAulas.Contains(a.VideoaulaId))
            .Select(a => a.VideoaulaId)
            .ToListAsync(ct)).ToHashSet();
        int aulasNovas = 0, aulasIgnoradas = 0;
        foreach (var a in aulasPedidas)
        {
            if (a is null) { aulasIgnoradas++; continue; }
            var quando = a.AssistidaEm?.UtcDateTime ?? agora;
            if (!existentes.Contains(a.VideoaulaId) || ValidacaoProgresso.Data(quando, agora, "assistidaEm") is not null)
            {
                aulasIgnoradas++;
                continue;
            }
            if (!marcadas.Add(a.VideoaulaId)) continue; // já marcada (ou repetida no lote)
            db.AulasAssistidas.Add(new AulaAssistida { UsuarioId = usuarioId, VideoaulaId = a.VideoaulaId, AssistidaEm = quando });
            aulasNovas++;
        }

        try
        {
            await db.SaveChangesAsync(ct); // uma transação: entra tudo ou nada
        }
        catch (DbUpdateException e) when (Unica(e))
        {
            // Outro aparelho importou ao mesmo tempo. Repetir é seguro.
            return TypedResults.Json(new ProblemaDto("O progresso estava sendo salvo em outro lugar. Tente de novo."),
                statusCode: StatusCodes.Status409Conflict);
        }

        return TypedResults.Ok(new ImportacaoDto(
            gravadas, repetidas, ignoradas.OrderBy(i => i.Posicao).ToList(), aulasNovas, aulasIgnoradas));
    }

    // ---- apoio ----

    // Id do cookie, conferido no banco: um cookie ainda válido de uma conta já
    // excluída não pode gravar nada (daria erro de FK).
    private static async Task<string?> UsuarioAtual(
        HttpContext http, UserManager<Usuario> usuarios, EstudaeDbContext db, CancellationToken ct)
    {
        var id = usuarios.GetUserId(http.User);
        return id is not null && await db.Users.AnyAsync(u => u.Id == id, ct) ? id : null;
    }

    private static IResult SemConta() =>
        TypedResults.Json(new ProblemaDto(ErroSemConta), statusCode: StatusCodes.Status401Unauthorized);

    private static IResult Invalido(string erro) => TypedResults.BadRequest(new ProblemaDto(erro));

    private static bool Unica(DbUpdateException e) =>
        e.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation };

    private static IQueryable<SessaoResumoDto> Resumos(IQueryable<SessaoEstudo> q) =>
        q.Select(s => new SessaoResumoDto(
            s.Id, s.Chave, s.Tipo, s.Disciplina.Slug, s.Tema == null ? null : s.Tema.Slug, s.Treino,
            s.IniciadaEm, s.ConcluidaEm, s.TempoLimiteSeg,
            s.Tentativas.Count(t => t.Acertou), s.Tentativas.Count,
            s.Tentativas.OrderBy(t => t.Ordem)
                .Select(t => new TentativaResumoDto(t.QuestaoId, t.Questao.Tema.Slug, t.Acertou, t.AlternativaEscolhida == null))
                .ToList()));

    private static Task<SessaoResumoDto?> Existente(EstudaeDbContext db, string usuarioId, string chave, CancellationToken ct) =>
        Resumos(db.SessoesEstudo.Where(s => s.UsuarioId == usuarioId && s.Chave == chave))
            .AsSplitQuery()
            .SingleOrDefaultAsync(ct);

    // Recém-gravada: monta o resumo da memória, sem reler do banco.
    private static SessaoResumoDto Resumo(SessaoEstudo s, ConteudoDasSessoes conteudo)
    {
        var tentativas = s.Tentativas
            .Select(t => new TentativaResumoDto(t.QuestaoId, conteudo.TemaDaQuestao(t.QuestaoId), t.Acertou, t.AlternativaEscolhida is null))
            .ToList();
        return new SessaoResumoDto(
            s.Id, s.Chave, s.Tipo, conteudo.SlugDisciplina(s.DisciplinaId), conteudo.SlugTema(s.TemaId), s.Treino,
            s.IniciadaEm, s.ConcluidaEm, s.TempoLimiteSeg, tentativas.Count(t => t.Acertou), tentativas.Count, tentativas);
    }
}
