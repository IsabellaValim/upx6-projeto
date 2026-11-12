namespace Estudae.Api.Conta;

// UrlPublica: endereço do site, usado nos links dos e-mails (App:UrlPublica).
// Vem da configuração e NUNCA do cabeçalho Host da requisição: quem manda a
// requisição escolhe o Host, e um "esqueci minha senha" com Host forjado
// mandaria para a vítima um link verdadeiro apontando para o site do atacante.
//
// CadastroAberto: cadastro, reenvio e "esqueci a senha" só funcionam quando o
// e-mail sai de verdade (Resend), ou em desenvolvimento. Em produção sem
// Resend, o site segue só com visitante, e nenhum token vai parar no log.
public sealed record ConfigConta(string UrlPublica, bool CadastroAberto)
{
    public static ConfigConta Montar(string? urlPublica, bool entregaDeVerdade, bool desenvolvimento)
    {
        if (!Uri.TryCreate(urlPublica?.Trim(), UriKind.Absolute, out var uri)
            || uri.Scheme is not ("http" or "https"))
            throw new InvalidOperationException(
                "App:UrlPublica precisa ser o endereço do site, como https://estudae.com.br " +
                "(em container: App__UrlPublica no .env).");

        // Link de senha por http em produção vazaria o token na rede.
        if (entregaDeVerdade && uri.Scheme != "https")
            throw new InvalidOperationException(
                "Com o e-mail de verdade ligado, App:UrlPublica precisa começar com https://.");

        return new ConfigConta(uri.GetLeftPart(UriPartial.Path).TrimEnd('/'), entregaDeVerdade || desenvolvimento);
    }
}
