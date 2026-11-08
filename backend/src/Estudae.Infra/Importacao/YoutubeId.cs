using System.Text.RegularExpressions;

namespace Estudae.Infra.Importacao;

// Extrai o ID de 11 caracteres de um vídeo do YouTube. Aceita o ID puro ou os
// formatos de link mais comuns:
//   https://www.youtube.com/watch?v=ID&t=30s   https://youtu.be/ID?si=...
//   https://www.youtube.com/embed/ID           https://www.youtube.com/shorts/ID
//   https://www.youtube-nocookie.com/embed/ID  https://m.youtube.com/watch?v=ID
public static partial class YoutubeId
{
    [GeneratedRegex("^[A-Za-z0-9_-]{11}$")]
    private static partial Regex FormatoId();

    public static bool TentarExtrair(string? entrada, out string id)
    {
        id = string.Empty;
        if (string.IsNullOrWhiteSpace(entrada)) return false;
        var texto = entrada.Trim();

        if (FormatoId().IsMatch(texto))
        {
            id = texto;
            return true;
        }

        // Link sem esquema ("youtu.be/ID") também vale.
        if (!texto.Contains("://")) texto = "https://" + texto;
        if (!Uri.TryCreate(texto, UriKind.Absolute, out var uri)) return false;

        var host = uri.Host.ToLowerInvariant();
        if (host.StartsWith("www.")) host = host[4..];
        if (host.StartsWith("m.")) host = host[2..];

        var segmentos = uri.AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries);
        string? candidato = host switch
        {
            "youtu.be" => segmentos.FirstOrDefault(),
            "youtube.com" or "youtube-nocookie.com" => segmentos switch
            {
                ["watch"] => ParametroV(uri.Query),
                ["embed" or "shorts" or "live" or "v", var s, ..] => s,
                _ => null,
            },
            _ => null,
        };

        if (candidato is null || !FormatoId().IsMatch(candidato)) return false;
        id = candidato;
        return true;
    }

    private static string? ParametroV(string query)
    {
        foreach (var par in query.TrimStart('?').Split('&'))
        {
            var partes = par.Split('=', 2);
            if (partes.Length == 2 && partes[0] == "v") return Uri.UnescapeDataString(partes[1]);
        }
        return null;
    }
}
