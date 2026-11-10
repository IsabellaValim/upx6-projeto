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
    public sealed record DisciplinaDto(string Slug, string Nome, string? Icone, int TotalQuestoes);
    public sealed record VideoDto(int Id, string Titulo, string YoutubeId, int? DuracaoSegundos);
    public sealed record TemaDto(string Slug, string Titulo, string Sobre, int TotalQuestoes, List<VideoDto> Videos);
    public sealed record ProvaDto(int? Ano, string? Edicao, string? Nivel, int? Numero);
    // Prova = null: questão autoral (sem origem no INEP).
    public sealed record QuestaoDto(int Id, string? TextoBase, string Enunciado, List<string> Alternativas, ProvaDto? Prova);
    public sealed record RespostaRequest(string? Alternativa);
    public sealed record CorrecaoDto(bool Acertou, string RespostaCorreta, string Resolucao);

    public static void MapConteudo(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("/api");
        api.MapGet("/disciplinas", ListarDisciplinas);
        api.MapGet("/disciplinas/{disciplina}/temas", ListarTemas);
        api.MapGet("/disciplinas/{disciplina}/temas/{tema}/questoes", ListarQuestoes);
        api.MapPost("/questoes/{id:int}/resposta", Responder);
    }

    private static async Task<List<DisciplinaDto>> ListarDisciplinas(EstudaeDbContext db, CancellationToken ct) =>
        await db.Disciplinas
            .OrderBy(d => d.Nome)
            .Select(d => new DisciplinaDto(
                d.Slug, d.Nome, d.Icone,
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
                    .Select(v => new VideoDto(v.Id, v.Titulo, v.YoutubeId, v.DuracaoSegundos))
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
                q.Id, q.TextoBase, q.Enunciado, q.Alternativas,
                q.ProvaAno == null ? null : new ProvaDto(q.ProvaAno, q.ProvaEdicao, q.ProvaNivel, q.ProvaNumero)))
            .ToListAsync(ct);

        // Embaralha as alternativas a cada pedido. É seguro porque a correção
        // compara o TEXTO escolhido, não a posição.
        foreach (var q in questoes)
        {
            var alts = q.Alternativas.ToArray();
            Random.Shared.Shuffle(alts);
            q.Alternativas.Clear();
            q.Alternativas.AddRange(alts);
        }
        return TypedResults.Ok(questoes);
    }

    private static async Task<Results<Ok<CorrecaoDto>, NotFound<ProblemaDto>, BadRequest<ProblemaDto>>> Responder(
        int id, RespostaRequest corpo, EstudaeDbContext db, CancellationToken ct)
    {
        var q = await db.Questoes
            .Where(x => x.Id == id && x.Status == StatusQuestao.Publicada)
            .Select(x => new { x.Alternativas, x.RespostaCorreta, x.Resolucao })
            .SingleOrDefaultAsync(ct);
        if (q is null)
            return TypedResults.NotFound(new ProblemaDto($"Questão {id} não encontrada."));

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
            q.Resolucao));
    }
}
