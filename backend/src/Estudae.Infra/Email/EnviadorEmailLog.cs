using Microsoft.Extensions.Logging;

namespace Estudae.Infra.Email;

// Desenvolvimento: nada é enviado, o e-mail (com o link) aparece no log da API.
// Em produção a API não aceita cadastro com este provedor (ver ConfigConta),
// porque o link no log seria um token de acesso lido por quem vê os logs.
public sealed class EnviadorEmailLog(ILogger<EnviadorEmailLog> log) : IEnviadorEmail
{
    public Task EnviarAsync(MensagemEmail m, CancellationToken ct = default)
    {
        log.LogInformation(
            "E-mail NÃO enviado (Email:Provedor = log). Para: {Para} | Assunto: {Assunto}\n{Texto}",
            m.Para, m.Assunto, m.Texto);
        return Task.CompletedTask;
    }
}
