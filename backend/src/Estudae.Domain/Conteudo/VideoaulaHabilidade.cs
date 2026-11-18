namespace Estudae.Domain.Conteudo;

// Vínculo revisado "esta aula ensina esta habilidade". Sem ele a recomendação
// pode oferecer a aula do tema, mas sem fingir que ela cobre a habilidade.
public class VideoaulaHabilidade
{
    public int VideoaulaId { get; set; }
    public Videoaula Videoaula { get; set; } = null!;

    public int HabilidadeId { get; set; }
    public Habilidade Habilidade { get; set; } = null!;
}
