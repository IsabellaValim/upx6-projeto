using Estudae.Domain.Conteudo;

namespace Estudae.Domain.Progresso;

// Marca de "já vi esta aula". Uma só por aluno e vídeo, sem histórico:
// desmarcar apaga a linha, como o liga/desliga da tela.
public class AulaAssistida
{
    public string UsuarioId { get; set; } = string.Empty;

    public int VideoaulaId { get; set; }
    public Videoaula Videoaula { get; set; } = null!;

    public DateTime AssistidaEm { get; set; }
}
