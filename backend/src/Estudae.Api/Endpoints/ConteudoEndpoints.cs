using Estudae.Domain.Conteudo;
using Estudae.Infra.Importacao;
using Estudae.Infra.Persistence;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace Estudae.Api.Endpoints;

// API pública de conteúdo (contrato em docs/api.md). Sem login: visitante usa
// tudo e nada é gravado.
//
// Regras de segurança do conteúdo:
// - Só questões PUBLICADAS aparecem; rascunho responde 404 como se não existisse.
// - Os GETs nunca trazem gabarito nem resolução. As consultas projetam (Select)
//   direto para os DTOs abaixo, então resposta_correta e resolucao nem saem do banco.
public static class ConteudoEndpoints
{
    // ---- DTOs de saída (JSON em camelCase, padrão do ASP.NET Core) ----
    public sealed record DisciplinaDto(string Slug, string Nome, string? Icone, string Nivel, int TotalQuestoes);
    // Url relativa à raiz do site ("conteudo/imagens/..."), como o front usa.
    public sealed record ImagemDto(string Url, string? Descricao);
    public sealed record VideoDto(int Id, string Titulo, string YoutubeId, int? DuracaoSegundos, List<string> Habilidades);
    public sealed record HabilidadeDto(string Slug, string Titulo, bool Essencial);
    public sealed record TemaDto(string Slug, string Titulo, string Sobre, int TotalQuestoes, List<VideoDto> Videos, List<HabilidadeDto> Habilidades);
    public sealed record ProvaDto(int? Ano, string? Edicao, string? Nivel, int? Numero);
    // Classificação pedagógica da questão (null = ainda não curada).
    // Revisao: "pendente" | "aprovada" | "rejeitada". Elegivel já é o resultado
    // final: aprovada + conteúdo conferindo + imagem válida + pedido do revisor.
    public sealed record PedagogiaQuestaoDto(
        string Habilidade, List<string> Secundarias, string Familia,
        string? Dificuldade, string? Tipo, string Revisao, bool Elegivel, int Versao);
    // Prova = null: questão autoral (sem origem no INEP).
    public sealed record QuestaoDto(int Id, string Codigo, string RevisaoConteudo, string? TextoBase, string Enunciado, List<string> Alternativas, ProvaDto? Prova, ImagemDto? Imagem, PedagogiaQuestaoDto? Pedagogia);
    public sealed record RespostaRequest(string? Alternativa);
    // RevisaoConteudo é o mesmo UUID opaco devolvido no GET, para o cliente
    // perceber se a questão mudou no meio de uma sessão sem revelar o conteúdo.
    public sealed record CorrecaoDto(bool Acertou, string RespostaCorreta, string Resolucao, string Codigo, string RevisaoConteudo);

    // Índice leve de curadoria para o motor adaptativo: habilidades por tema e,
    // por questão publicada, a classificação (sem enunciados, gabarito ou resolução).
    public sealed record MatrizDto(string? Versao, bool Validada);
    public sealed record QuestaoIndiceDto(string Codigo, string RevisaoConteudo, PedagogiaQuestaoDto? Pedagogia);
    public sealed record TemaPedagogiaDto(string Slug, List<HabilidadeDto> Habilidades, List<QuestaoIndiceDto> Questoes);
    public sealed record PedagogiaDto(string Disciplina, MatrizDto? Matriz, List<TemaPedagogiaDto> Temas);

    public static void MapConteudo(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("/api");
        api.MapGet("/disciplinas", ListarDisciplinas);
        api.MapGet("/disciplinas/{disciplina}/temas", ListarTemas);
        api.MapGet("/disciplinas/{disciplina}/temas/{tema}/questoes", ListarQuestoes);
        api.MapGet("/disciplinas/{disciplina}/pedagogia", Pedagogia);
        api.MapPost("/questoes/{id:int}/resposta", Responder);

        // Imagens das questões, lidas da tabela imagem. Fora de /api porque o
        // front usa a URL direto no <img> (ImagemDto.Url = "conteudo/imagens/...").
        app.MapGet("/conteudo/imagens/{**caminho}", Imagem);
    }

    // ETag = hash dos bytes + no-cache: o navegador revalida a cada carga e recebe
    // 304 sem corpo se a imagem não mudou (o FileContentHttpResult trata o If-None-Match).
    private static async Task<IResult> Imagem(string caminho, HttpContext http, EstudaeDbContext db, CancellationToken ct)
    {
        var img = await db.Imagens
            .Where(i => i.Caminho == caminho)
            .Select(i => new { i.TipoMime, i.Dados, i.Sha256, i.AtualizadaEm })
            .SingleOrDefaultAsync(ct);
        if (img is null)
            return TypedResults.NotFound(new ProblemaDto($"Imagem \"{caminho}\" não encontrada."));

        http.Response.Headers.CacheControl = "no-cache";
        return TypedResults.File(img.Dados, img.TipoMime,
            lastModified: new DateTimeOffset(DateTime.SpecifyKind(img.AtualizadaEm, DateTimeKind.Utc)),
            entityTag: new Microsoft.Net.Http.Headers.EntityTagHeaderValue($"\"{img.Sha256}\""));
    }

    private static async Task<List<DisciplinaDto>> ListarDisciplinas(EstudaeDbContext db, CancellationToken ct) =>
        await db.Disciplinas
            .OrderBy(d => d.Nome)
            .Select(d => new DisciplinaDto(
                d.Slug, d.Nome, d.Icone, d.Nivel,
                d.Temas.SelectMany(t => t.Questoes).Count(q => q.Status == StatusQuestao.Publicada)))
            .ToListAsync(ct);

    private static async Task<Results<Ok<List<TemaDto>>, NotFound<ProblemaDto>>> ListarTemas(
        string disciplina, EstudaeDbContext db, CancellationToken ct)
    {
        if (!await db.Disciplinas.AnyAsync(d => d.Slug == disciplina, ct))
            return TypedResults.NotFound(new ProblemaDto($"Disciplina \"{disciplina}\" não encontrada."));

        var temas = await db.Temas
            .Where(t => t.Disciplina.Slug == disciplina)
            .OrderBy(t => t.Ordem)
            .Select(t => new TemaDto(
                t.Slug, t.Titulo, t.Sobre,
                t.Questoes.Count(q => q.Status == StatusQuestao.Publicada),
                t.Videoaulas.OrderBy(v => v.Ordem)
                    .Select(v => new VideoDto(v.Id, v.Titulo, v.YoutubeId, v.DuracaoSegundos,
                        v.Habilidades.OrderBy(h => h.Habilidade.Ordem).Select(h => h.Habilidade.Slug).ToList()))
                    .ToList(),
                t.Habilidades.OrderBy(h => h.Ordem)
                    .Select(h => new HabilidadeDto(h.Slug, h.Titulo, h.Essencial))
                    .ToList()))
            .AsSplitQuery()
            .ToListAsync(ct);
        return TypedResults.Ok(temas);
    }

    private static async Task<Results<Ok<List<QuestaoDto>>, NotFound<ProblemaDto>>> ListarQuestoes(
        string disciplina, string tema, EstudaeDbContext db, CancellationToken ct)
    {
        if (!await db.Temas.AnyAsync(t => t.Slug == tema && t.Disciplina.Slug == disciplina, ct))
            return TypedResults.NotFound(new ProblemaDto($"Tema \"{tema}\" não encontrado em \"{disciplina}\"."));

        var questoes = await db.Questoes
            .Where(q => q.Status == StatusQuestao.Publicada
                        && q.Tema.Slug == tema && q.Tema.Disciplina.Slug == disciplina)
            .OrderBy(q => q.Id)
            .Select(q => new QuestaoDto(
                q.Id, q.Codigo, q.RevisaoConteudo.ToString(), q.TextoBase, q.Enunciado, q.Alternativas,
                q.ProvaAno == null ? null : new ProvaDto(q.ProvaAno, q.ProvaEdicao, q.ProvaNivel, q.ProvaNumero),
                q.ImagemUrl == null ? null : new ImagemDto("conteudo/imagens/" + q.ImagemUrl, q.ImagemDescricao),
                q.Metadados == null ? null : new PedagogiaQuestaoDto(
                    q.Metadados.HabilidadePrincipal.Slug,
                    q.Metadados.Secundarias.Select(s => s.Habilidade.Slug).ToList(),
                    q.Metadados.Familia,
                    q.Metadados.Dificuldade == DificuldadeCuratorial.Introdutoria ? "introdutoria"
                        : q.Metadados.Dificuldade == DificuldadeCuratorial.Intermediaria ? "intermediaria"
                        : q.Metadados.Dificuldade == DificuldadeCuratorial.Avancada ? "avancada" : null,
                    q.Metadados.Tipo,
                    RevisaoTexto(q.Metadados.StatusRevisao),
                    q.Metadados.StatusRevisao == StatusRevisao.Aprovada
                        && q.Metadados.ConteudoConfere
                        && q.Metadados.ElegibilidadeSolicitada
                        && (q.ImagemUrl == null || db.Imagens.Any(i => i.Caminho == q.ImagemUrl)),
                    q.Metadados.Versao)))
            .AsSplitQuery()
            .ToListAsync(ct);

        // Embaralha as alternativas a cada pedido. É seguro porque a correção
        // compara o TEXTO escolhido, não a posição.
        // Exceção: questão com imagem. O recorte da prova mostra as alternativas com
        // as letras originais; embaralhar faria o "A" da imagem não ser o "A" da tela.
        foreach (var q in questoes)
        {
            if (q.Imagem is not null) continue;
            var alts = q.Alternativas.ToArray();
            Random.Shared.Shuffle(alts);
            q.Alternativas.Clear();
            q.Alternativas.AddRange(alts);
        }
        return TypedResults.Ok(questoes);
    }

    // "pendente" | "aprovada" | "rejeitada" — texto fixo do contrato, não o nome do enum.
    private static string RevisaoTexto(StatusRevisao s) => s switch
    {
        StatusRevisao.Aprovada => "aprovada",
        StatusRevisao.Rejeitada => "rejeitada",
        _ => "pendente",
    };

    private static async Task<Results<Ok<PedagogiaDto>, NotFound<ProblemaDto>>> Pedagogia(
        string disciplina, EstudaeDbContext db, CancellationToken ct)
    {
        var d = await db.Disciplinas
            .Where(x => x.Slug == disciplina)
            .Select(x => new
            {
                Matriz = x.Pedagogia == null ? null : new MatrizDto(x.Pedagogia.VersaoMatriz, x.Pedagogia.MatrizValidada),
                Temas = x.Temas.OrderBy(t => t.Ordem).Select(t => new TemaPedagogiaDto(
                    t.Slug,
                    t.Habilidades.OrderBy(h => h.Ordem)
                        .Select(h => new HabilidadeDto(h.Slug, h.Titulo, h.Essencial)).ToList(),
                    t.Questoes.Where(q => q.Status == StatusQuestao.Publicada)
                        .OrderBy(q => q.Id)
                        .Select(q => new QuestaoIndiceDto(
                            q.Codigo, q.RevisaoConteudo.ToString(),
                            q.Metadados == null ? null : new PedagogiaQuestaoDto(
                                q.Metadados.HabilidadePrincipal.Slug,
                                q.Metadados.Secundarias.Select(s => s.Habilidade.Slug).ToList(),
                                q.Metadados.Familia,
                                q.Metadados.Dificuldade == DificuldadeCuratorial.Introdutoria ? "introdutoria"
                                    : q.Metadados.Dificuldade == DificuldadeCuratorial.Intermediaria ? "intermediaria"
                                    : q.Metadados.Dificuldade == DificuldadeCuratorial.Avancada ? "avancada" : null,
                                q.Metadados.Tipo,
                                RevisaoTexto(q.Metadados.StatusRevisao),
                                q.Metadados.StatusRevisao == StatusRevisao.Aprovada
                                    && q.Metadados.ConteudoConfere
                                    && q.Metadados.ElegibilidadeSolicitada
                                    && (q.ImagemUrl == null || db.Imagens.Any(i => i.Caminho == q.ImagemUrl)),
                                q.Metadados.Versao)))
                        .ToList()))
                    .ToList(),
            })
            .AsSplitQuery()
            .SingleOrDefaultAsync(ct);
        if (d is null)
            return TypedResults.NotFound(new ProblemaDto($"Disciplina \"{disciplina}\" não encontrada."));

        return TypedResults.Ok(new PedagogiaDto(disciplina, d.Matriz, d.Temas));
    }

    private static async Task<Results<Ok<CorrecaoDto>, NotFound<ProblemaDto>, BadRequest<ProblemaDto>>> Responder(
        int id, RespostaRequest corpo, EstudaeDbContext db, CancellationToken ct)
    {
        var q = await db.Questoes
            .Where(x => x.Id == id && x.Status == StatusQuestao.Publicada)
            .Select(x => new
            {
                x.Codigo, x.Enunciado, x.Alternativas, x.RespostaCorreta, x.Resolucao,
                x.RevisaoConteudo,
            })
            .SingleOrDefaultAsync(ct);
        if (q is null)
            return TypedResults.NotFound(new ProblemaDto($"Questão {id} não encontrada."));

        var revisaoConteudo = q.RevisaoConteudo.ToString();

        // Mesma normalização do importador (trim, quebras de linha, NFC).
        var escolhida = LeitorConteudo.NormalizarTexto(corpo.Alternativa);
        if (escolhida is null)
            return TypedResults.BadRequest(new ProblemaDto("Campo \"alternativa\" é obrigatório."));
        if (!q.Alternativas.Contains(escolhida, StringComparer.Ordinal))
            return TypedResults.BadRequest(new ProblemaDto("A alternativa enviada não é uma das alternativas desta questão."));

        // Visitante: corrige e devolve; nenhuma tentativa é gravada (fora do MVP).
        return TypedResults.Ok(new CorrecaoDto(
            string.Equals(escolhida, q.RespostaCorreta, StringComparison.Ordinal),
            q.RespostaCorreta,
            q.Resolucao,
            q.Codigo,
            revisaoConteudo));
    }
}
