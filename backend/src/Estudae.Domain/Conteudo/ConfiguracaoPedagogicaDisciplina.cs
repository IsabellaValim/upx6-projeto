namespace Estudae.Domain.Conteudo;

// Configuração pedagógica da disciplina inteira (uma linha por disciplina):
// em que versão da matriz oficial a curadoria se baseia e se a cobertura da
// área foi conferida. A matriz representa a área toda — não só os temas que
// já têm questão no banco. Sem matriz validada, a avaliação de preparação da
// área fica "indeterminada", nunca negativa.
public class ConfiguracaoPedagogicaDisciplina
{
    public int DisciplinaId { get; set; }
    public Disciplina Disciplina { get; set; } = null!;

    public string? VersaoMatriz { get; set; }
    public bool MatrizValidada { get; set; }
    public string? Revisor { get; set; }
    public DateTime? RevisadoEm { get; set; }
}
