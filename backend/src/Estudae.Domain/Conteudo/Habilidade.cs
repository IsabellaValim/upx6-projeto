namespace Estudae.Domain.Conteudo;

// Habilidade dentro de um tema (ex.: "porcentagem de quantidades" em
// Porcentagem e proporção). É o que o motor adaptativo mede: a questão avalia
// uma habilidade principal e pode tocar em secundárias.
// O Slug é único só dentro do tema, como o slug do tema na disciplina.
public class Habilidade
{
    public int Id { get; set; }
    public int TemaId { get; set; }
    public Tema Tema { get; set; } = null!;

    public string Slug { get; set; } = string.Empty;
    public string Titulo { get; set; } = string.Empty;
    // Essencial = precisa de evidência própria para o tema ser considerado
    // dominado. Uma habilidade não essencial ajuda na recomendação, mas não
    // bloqueia a conquista de domínio.
    public bool Essencial { get; set; } = true;
    // Código da competência na matriz oficial do Inep, quando a correspondência
    // já foi conferida pelo revisor (ex.: "H12"). Opcional de propósito.
    public string? ReferenciaOficial { get; set; }
    public int Ordem { get; set; }

    public List<QuestaoHabilidadeSecundaria> Questoes { get; set; } = [];
    public List<VideoaulaHabilidade> Videoaulas { get; set; } = [];
}
