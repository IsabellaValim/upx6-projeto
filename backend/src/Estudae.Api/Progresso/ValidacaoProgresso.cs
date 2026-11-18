using System.Text.RegularExpressions;
using Estudae.Domain.Progresso;
using Estudae.Infra.Importacao;

namespace Estudae.Api.Progresso;

// O que chega do front para gravar uma sessão (contrato em docs/api.md,
// "Progresso do aluno"). Datas com fuso (DateTimeOffset): o DateTime do
// System.Text.Json converteria "…-03:00" para a hora local do servidor.
public sealed record RespostaSessaoRequest(int QuestaoId, string? Alternativa);

public sealed record SessaoRequest(
    string? Chave,
    string? Tipo,
    string? Disciplina,
    string? Tema,
    bool Treino,
    DateTimeOffset? IniciadaEm,
    DateTimeOffset? ConcluidaEm,
    int? TempoLimiteSeg,
    List<RespostaSessaoRequest>? Respostas);

// Sessão que passou na validação de formato. Ainda falta conferir contra o
// conteúdo (disciplina, tema e questões existem e combinam): ConteudoDasSessoes.
public sealed record SessaoValida(
    string Chave,
    string Tipo,
    string Disciplina,
    string? Tema,
    bool Treino,
    DateTime IniciadaEm,
    DateTime ConcluidaEm,
    int? TempoLimiteSeg,
    List<(int QuestaoId, string? Alternativa)> Respostas);

// Validação de formato, pura (sem banco), como a ValidacaoConta.
public static partial class ValidacaoProgresso
{
    public const int MaxRespostas = 100;
    public const int MaxTempoLimiteSeg = 24 * 60 * 60;
    public static readonly TimeSpan MaxDuracao = TimeSpan.FromHours(24);
    // Relógio do celular um pouco adiantado não pode recusar a sessão.
    public static readonly TimeSpan FolgaRelogio = TimeSpan.FromMinutes(10);
    // Antes disso o Estudaê não existia: data assim é relógio errado ou lixo.
    public static readonly DateTime DataMinima = new(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

    [GeneratedRegex("^[A-Za-z0-9_.:-]{1,64}$")]
    private static partial Regex FormatoChave();

    public static bool ChaveValida(string? chave) => chave is not null && FormatoChave().IsMatch(chave);

    public static string? Data(DateTime utc, DateTime agoraUtc, string campo)
    {
        if (utc < DataMinima) return $"Campo \"{campo}\" tem uma data antiga demais.";
        if (utc > agoraUtc + FolgaRelogio) return $"Campo \"{campo}\" tem uma data no futuro.";
        return null;
    }

    public static (SessaoValida? Sessao, string? Erro) Sessao(SessaoRequest? r, DateTime agoraUtc)
    {
        if (r is null) return (null, "Envie a sessão no corpo do pedido.");

        if (!ChaveValida(r.Chave))
            return (null, "Campo \"chave\" é obrigatório: de 1 a 64 letras, números ou _ . : -");

        if (r.Tipo is not (TipoSessao.Licao or TipoSessao.Simulado))
            return (null, "Campo \"tipo\" precisa ser \"licao\" ou \"simulado\".");
        var licao = r.Tipo == TipoSessao.Licao;

        var disciplina = r.Disciplina?.Trim();
        if (string.IsNullOrEmpty(disciplina)) return (null, "Campo \"disciplina\" é obrigatório.");

        var tema = string.IsNullOrWhiteSpace(r.Tema) ? null : r.Tema.Trim();
        if (licao && tema is null) return (null, "A lição precisa do campo \"tema\".");
        if (!licao && tema is not null) return (null, "O simulado é da disciplina inteira: não envie \"tema\".");
        if (licao && r.Treino) return (null, "Campo \"treino\" só vale para simulado.");

        if (r.IniciadaEm is null || r.ConcluidaEm is null)
            return (null, "Campos \"iniciadaEm\" e \"concluidaEm\" são obrigatórios.");
        var inicio = r.IniciadaEm.Value.UtcDateTime;
        var fim = r.ConcluidaEm.Value.UtcDateTime;
        var erroData = Data(inicio, agoraUtc, "iniciadaEm") ?? Data(fim, agoraUtc, "concluidaEm");
        if (erroData is not null) return (null, erroData);
        if (fim < inicio) return (null, "\"concluidaEm\" não pode ser antes de \"iniciadaEm\".");
        if (fim - inicio > MaxDuracao) return (null, "A sessão não pode durar mais de 24 horas.");

        if (r.TempoLimiteSeg is not null)
        {
            if (licao) return (null, "Campo \"tempoLimiteSeg\" só vale para simulado.");
            if (r.TempoLimiteSeg is <= 0 or > MaxTempoLimiteSeg)
                return (null, "Campo \"tempoLimiteSeg\" precisa estar entre 1 e 86400.");
        }

        if (r.Respostas is not { Count: > 0 }) return (null, "Envie ao menos uma resposta em \"respostas\".");
        if (r.Respostas.Count > MaxRespostas) return (null, $"Uma sessão tem no máximo {MaxRespostas} respostas.");

        var respostas = new List<(int, string?)>(r.Respostas.Count);
        var vistas = new HashSet<int>();
        foreach (var resp in r.Respostas)
        {
            if (resp is null || resp.QuestaoId <= 0) return (null, "Toda resposta precisa de um \"questaoId\" válido.");
            if (!vistas.Add(resp.QuestaoId)) return (null, $"A questão {resp.QuestaoId} aparece duas vezes na sessão.");
            // Mesma normalização da correção e do importador; só espaços = em branco.
            var alternativa = LeitorConteudo.NormalizarTexto(resp.Alternativa);
            if (alternativa is null && licao)
                return (null, $"Na lição toda questão é respondida: falta a alternativa da questão {resp.QuestaoId}.");
            respostas.Add((resp.QuestaoId, alternativa));
        }

        return (new SessaoValida(r.Chave!, r.Tipo, disciplina, tema, r.Treino, inicio, fim, r.TempoLimiteSeg, respostas), null);
    }
}
