namespace Estudae.Infra.Email;

// Um e-mail pronto para sair: o texto é montado por quem envia (ver
// Estudae.Api/Conta/EmailsConta.cs); aqui só se entrega.
public sealed record MensagemEmail(string Para, string Assunto, string Html, string Texto);

public interface IEnviadorEmail
{
    // Lança EnvioEmailException se o provedor recusar ou estiver fora do ar.
    Task EnviarAsync(MensagemEmail mensagem, CancellationToken ct = default);
}

public sealed class EnvioEmailException(string mensagem, Exception? interna = null) : Exception(mensagem, interna);
