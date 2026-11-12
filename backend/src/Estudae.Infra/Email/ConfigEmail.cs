using Microsoft.Extensions.Configuration;

namespace Estudae.Infra.Email;

// Seção "Email" da configuração (em container: Email__Provedor etc., via .env):
//   Provedor       "log" (padrão: só escreve no log, nada sai) ou "resend"
//   Remetente      ex.: "Estudaê <nao-responda@seudominio.com.br>" (domínio verificado no Resend)
//   ResendApiKey   segredo; NUNCA em arquivo versionado
public sealed record ConfigEmail(string Provedor, string? Remetente, string? ResendApiKey)
{
    public const string Log = "log";
    public const string Resend = "resend";

    // Só o Resend entrega de verdade. Com "log", os links ficam no log do
    // servidor, o que só é aceitável em desenvolvimento.
    public bool EntregaDeVerdade => Provedor == Resend;

    public static ConfigEmail Ler(IConfiguration config)
    {
        var provedor = (config["Email:Provedor"] ?? Log).Trim().ToLowerInvariant();
        var remetente = Vazio(config["Email:Remetente"]);
        var chave = Vazio(config["Email:ResendApiKey"]);

        if (provedor is not (Log or Resend))
            throw new InvalidOperationException(
                $"Email:Provedor \"{provedor}\" desconhecido. Use \"{Log}\" ou \"{Resend}\".");
        if (provedor == Resend && (chave is null || remetente is null))
            throw new InvalidOperationException(
                "Com Email:Provedor = resend, defina Email:ResendApiKey e Email:Remetente " +
                "(em container: Email__ResendApiKey e Email__Remetente no .env).");

        return new ConfigEmail(provedor, remetente, chave);
    }

    private static string? Vazio(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}
