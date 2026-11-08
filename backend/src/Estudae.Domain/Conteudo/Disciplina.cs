namespace Estudae.Domain.Conteudo;

// O que o aluno escolhe estudar (Português, Matemática). O Slug é o nome estável
// usado pelo importador e pelas URLs; o Id muda de um ambiente para outro.
public class Disciplina
{
    public int Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? Icone { get; set; }

    public List<Tema> Temas { get; set; } = [];
}
