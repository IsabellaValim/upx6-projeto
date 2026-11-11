namespace Estudae.Domain.Conteudo;

// Assunto dentro de uma disciplina. O Slug é único só dentro da disciplina.
public class Tema
{
    public int Id { get; set; }
    public int DisciplinaId { get; set; }
    public Disciplina Disciplina { get; set; } = null!;

    public string Slug { get; set; } = string.Empty;
    public string Titulo { get; set; } = string.Empty;
    public string Sobre { get; set; } = string.Empty;
    public int Ordem { get; set; }

    public List<Videoaula> Videoaulas { get; set; } = [];
    public List<Questao> Questoes { get; set; } = [];
    // Habilidades pedagógicas do tema (curadoria; ver MetadadosQuestao).
    public List<Habilidade> Habilidades { get; set; } = [];
}
