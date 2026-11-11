namespace Estudae.Domain.Conteudo;

// O que o aluno escolhe estudar (Português, Matemática). O Slug é o nome estável
// usado pelo importador e pelas URLs; o Id muda de um ambiente para outro.
public class Disciplina
{
    public int Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? Icone { get; set; }

    // Nível do Encceja a que a disciplina pertence: "fundamental" ou "medio".
    // A mesma matéria nos dois níveis são duas disciplinas (slugs diferentes).
    public string Nivel { get; set; } = NivelEnsino.Medio;

    public List<Tema> Temas { get; set; } = [];

    // Configuração pedagógica da área (1:1; ver ConfiguracaoPedagogicaDisciplina).
    public ConfiguracaoPedagogicaDisciplina? Pedagogia { get; set; }
}

public static class NivelEnsino
{
    public const string Fundamental = "fundamental";
    public const string Medio = "medio";
    public static readonly string[] Todos = [Fundamental, Medio];
}
