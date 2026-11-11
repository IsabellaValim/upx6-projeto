using System.Net.Http.Json;

namespace Estudae.Infra.Email;

// Resend (https://resend.com/docs/api-reference/emails/send-email):
//   POST https://api.resend.com/emails
//   Authorization: Bearer <chave>
//   { "from", "to": [...], "subject", "html", "text" }
// O HttpClient chega configurado (endereço base e chave) pelo AddEmail.
public sealed class EnviadorEmailResend(HttpClient http, ConfigEmail config) : IEnviadorEmail
{
    public async Task EnviarAsync(MensagemEmail m, CancellationToken ct = default)
    {
        var corpo = new
        {
            from = config.Remetente,
            to = new[] { m.Para },
            subject = m.Assunto,
            html = m.Html,
            text = m.Texto,
        };

        HttpResponseMessage resposta;
        try
        {
            resposta = await http.PostAsJsonAsync("emails", corpo, ct);
        }
        catch (HttpRequestException ex)
        {
            throw new EnvioEmailException("Não foi possível falar com o Resend.", ex);
        }

        using (resposta)
        {
            if (!resposta.IsSuccessStatusCode)
            {
                var detalhe = await resposta.Content.ReadAsStringAsync(ct);
                throw new EnvioEmailException($"O Resend recusou o e-mail ({(int)resposta.StatusCode}): {detalhe}");
            }
        }
    }
}
