using Estudae.Domain.Conteudo;

namespace Estudae.Domain.Progresso;

// Resposta a uma questão dentro de uma sessão. Sem UsuarioId: o dono vem da
// sessão, para os dois nunca discordarem.
public class Tentativa
{
    public long Id { get; set; }

    public long SessaoEstudoId { get; set; }
    public SessaoEstudo SessaoEstudo { get; set; } = null!;

    public int QuestaoId { get; set; }
    public Questao Questao { get; set; } = null!;

    // Posição da questão na sessão (1, 2, 3...), para o Resultado na mesma ordem.
    public short Ordem { get; set; }

    // Texto da alternativa, não a posição (a ordem é embaralhada na exibição).
    // Nulo = deixada em branco no simulado, e conta como erro.
    public string? AlternativaEscolhida { get; set; }

    // Gravado na hora: se a questão for corrigida depois, a tentativa não muda.
    public bool Acertou { get; set; }

    public DateTime RespondidaEm { get; set; }
}
