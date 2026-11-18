using System.Text;
using Microsoft.AspNetCore.WebUtilities;

namespace Estudae.Api.Conta;

// Links dos e-mails. Apontam para telas do FRONT (que então chamam a API),
// não para a API: quem clica vê uma página do site, e não um JSON.
//
// O token do Identity tem "+", "/" e "=", que quebram numa URL. Por isso ele
// viaja em Base64Url (só letras, números, "-" e "_").
public static class LinksConta
{
    public const string RotaConfirmar = "/confirmar-email";
    public const string RotaRedefinir = "/redefinir-senha";
    public const string RotaEntrar = "/login";
    public const string RotaEsqueci = "/esqueci-senha";

    public static string Confirmacao(string urlPublica, string usuarioId, string token) =>
        $"{urlPublica}{RotaConfirmar}?u={Uri.EscapeDataString(usuarioId)}&t={Codificar(token)}";

    public static string Redefinicao(string urlPublica, string usuarioId, string token) =>
        $"{urlPublica}{RotaRedefinir}?u={Uri.EscapeDataString(usuarioId)}&t={Codificar(token)}";

    public static string Entrar(string urlPublica) => urlPublica + RotaEntrar;
    public static string Esqueci(string urlPublica) => urlPublica + RotaEsqueci;

    public static string Codificar(string token) => WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(token));

    // null = não é um token nosso (link cortado, colado pela metade...).
    public static string? Decodificar(string? tokenUrl)
    {
        if (string.IsNullOrWhiteSpace(tokenUrl)) return null;
        try
        {
            return Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(tokenUrl.Trim()));
        }
        catch (FormatException)
        {
            return null;
        }
    }
}
