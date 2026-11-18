using Estudae.Domain.Conteudo;
using Estudae.Domain.Progresso;
using Estudae.Infra.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Estudae.Api.Progresso;

// O conteúdo que um lote de sessões cita (disciplinas, temas, questões), lido
// de uma vez: gravar uma sessão ou importar 500 custa as mesmas três consultas.
// Monta a SessaoEstudo e calcula o acertou AQUI, no servidor: o front manda só
// o texto escolhido, nunca se acertou.
public sealed class ConteudoDasSessoes
{
    private sealed record QuestaoInfo(int TemaId, int DisciplinaId, string TemaSlug, List<string> Alternativas, string RespostaCorreta);

    private readonly Dictionary<string, int> _disciplinas;
    private readonly Dictionary<(int DisciplinaId, string Slug), int> _temas;
    private readonly Dictionary<int, QuestaoInfo> _questoes;

    private ConteudoDasSessoes(
        Dictionary<string, int> disciplinas, Dictionary<(int, string), int> temas, Dictionary<int, QuestaoInfo> questoes)
    {
        _disciplinas = disciplinas;
        _temas = temas;
        _questoes = questoes;
    }

    public static async Task<ConteudoDasSessoes> CarregarAsync(
        EstudaeDbContext db, IReadOnlyCollection<SessaoValida> sessoes, CancellationToken ct)
    {
        var slugs = sessoes.Select(s => s.Disciplina).Distinct().ToList();
        var ids = sessoes.SelectMany(s => s.Respostas.Select(r => r.QuestaoId)).Distinct().ToList();

        var disciplinas = await db.Disciplinas
            .Where(d => slugs.Contains(d.Slug))
            .ToDictionaryAsync(d => d.Slug, d => d.Id, ct);
        var idsDisciplinas = disciplinas.Values.ToList();
        var temas = await db.Temas
            .Where(t => idsDisciplinas.Contains(t.DisciplinaId))
            .Select(t => new { t.DisciplinaId, t.Slug, t.Id })
            .ToDictionaryAsync(t => (t.DisciplinaId, t.Slug), t => t.Id, ct);
        // Só publicadas: rascunho é como se não existisse, igual à correção.
        var questoes = await db.Questoes
            .Where(q => ids.Contains(q.Id) && q.Status == StatusQuestao.Publicada)
            .Select(q => new { q.Id, q.TemaId, q.Tema.DisciplinaId, TemaSlug = q.Tema.Slug, q.Alternativas, q.RespostaCorreta })
            .ToDictionaryAsync(
                q => q.Id,
                q => new QuestaoInfo(q.TemaId, q.DisciplinaId, q.TemaSlug, q.Alternativas, q.RespostaCorreta),
                ct);

        return new ConteudoDasSessoes(disciplinas, temas, questoes);
    }

    public string TemaDaQuestao(int questaoId) => _questoes[questaoId].TemaSlug;
    public string SlugDisciplina(int id) => _disciplinas.First(d => d.Value == id).Key;
    public string? SlugTema(int? id) => id is null ? null : _temas.First(t => t.Value == id).Key.Slug;

    public (SessaoEstudo? Sessao, string? Erro) Montar(string usuarioId, SessaoValida s)
    {
        if (!_disciplinas.TryGetValue(s.Disciplina, out var disciplinaId))
            return (null, $"Disciplina \"{s.Disciplina}\" não encontrada.");

        int? temaId = null;
        if (s.Tema is not null)
        {
            if (!_temas.TryGetValue((disciplinaId, s.Tema), out var id))
                return (null, $"Tema \"{s.Tema}\" não encontrado em \"{s.Disciplina}\".");
            temaId = id;
        }

        var sessao = new SessaoEstudo
        {
            UsuarioId = usuarioId,
            Chave = s.Chave,
            Tipo = s.Tipo,
            DisciplinaId = disciplinaId,
            TemaId = temaId,
            Treino = s.Treino,
            IniciadaEm = s.IniciadaEm,
            ConcluidaEm = s.ConcluidaEm,
            TempoLimiteSeg = s.TempoLimiteSeg,
        };

        short ordem = 0;
        foreach (var (questaoId, alternativa) in s.Respostas)
        {
            if (!_questoes.TryGetValue(questaoId, out var q))
                return (null, $"Questão {questaoId} não encontrada.");
            if (temaId is not null && q.TemaId != temaId)
                return (null, $"A questão {questaoId} não é do tema \"{s.Tema}\".");
            if (q.DisciplinaId != disciplinaId)
                return (null, $"A questão {questaoId} não é da disciplina \"{s.Disciplina}\".");
            if (alternativa is not null && !q.Alternativas.Contains(alternativa, StringComparer.Ordinal))
                return (null, $"A alternativa enviada para a questão {questaoId} não é uma das alternativas dela.");

            sessao.Tentativas.Add(new Tentativa
            {
                QuestaoId = questaoId,
                Ordem = ++ordem,
                AlternativaEscolhida = alternativa,
                Acertou = alternativa is not null && string.Equals(alternativa, q.RespostaCorreta, StringComparison.Ordinal),
                // O front não guarda a hora de cada resposta: vale a da entrega.
                RespondidaEm = s.ConcluidaEm,
            });
        }
        return (sessao, null);
    }
}
