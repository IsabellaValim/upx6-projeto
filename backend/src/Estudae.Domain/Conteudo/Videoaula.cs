namespace Estudae.Domain.Conteudo;

// Vídeo do YouTube ligado a um tema. Guardamos só o ID de 11 caracteres; o player
// é montado com https://www.youtube-nocookie.com/embed/{YoutubeId}.
public class Videoaula
{
    public int Id { get; set; }
    public int TemaId { get; set; }
    public Tema Tema { get; set; } = null!;

    public string Titulo { get; set; } = string.Empty;
    public string YoutubeId { get; set; } = string.Empty;
    public string? Tipo { get; set; }
    public int? DuracaoSegundos { get; set; }
    public int Ordem { get; set; }

    // Habilidades que a aula cobre (vínculo revisado; ver VideoaulaHabilidade).
    public List<VideoaulaHabilidade> Habilidades { get; set; } = [];
}
