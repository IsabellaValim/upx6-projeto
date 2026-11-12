using System.Net;
using Estudae.Infra.Email;

namespace Estudae.Api.Conta;

// Texto dos e-mails de conta. Escrito para pessoas idosas: frases curtas, um
// botão grande só, e o link também por extenso (há leitor de e-mail que
// esconde botões). Toda versão tem HTML e texto puro.
//
// O nome vem do usuário: no HTML ele passa por HtmlEncode, senão quem se
// cadastrasse como "<a href=...>" injetaria um link no e-mail.
public static class EmailsConta
{
    public static MensagemEmail Confirmacao(string nome, string email, string link) => Montar(
        email,
        "Confirme seu e-mail no Estudaê",
        $"Olá, {nome}!",
        [
            "Falta só um passo para criar sua conta no Estudaê.",
            "Toque no botão abaixo para confirmar seu e-mail.",
        ],
        "Confirmar meu e-mail",
        link,
        "O link vale por 3 dias. Se não foi você que pediu, pode apagar este e-mail.");

    public static MensagemEmail Redefinicao(string nome, string email, string link) => Montar(
        email,
        "Crie uma senha nova no Estudaê",
        $"Olá, {nome}!",
        [
            "Recebemos um pedido para trocar a senha da sua conta.",
            "Toque no botão abaixo para criar uma senha nova.",
        ],
        "Criar senha nova",
        link,
        "O link vale por 1 dia. Se não foi você que pediu, pode apagar este e-mail: sua senha continua a mesma.");

    // Alguém tentou se cadastrar com um e-mail que já tem conta. Avisamos o DONO
    // (e não quem tentou), para a tela de cadastro não revelar quem tem conta.
    public static MensagemEmail ContaJaExiste(string nome, string email, string linkEntrar, string linkEsqueci) => Montar(
        email,
        "Você já tem uma conta no Estudaê",
        $"Olá, {nome}!",
        [
            "Alguém tentou criar uma conta nova com este e-mail, mas você já tem uma.",
            "Para estudar, é só entrar com seu e-mail e sua senha.",
            $"Esqueceu a senha? Crie uma nova aqui: {linkEsqueci}",
        ],
        "Entrar no Estudaê",
        linkEntrar,
        "Se não foi você, pode apagar este e-mail. Nada mudou na sua conta.");

    private static MensagemEmail Montar(
        string para, string assunto, string saudacao, string[] paragrafos, string botao, string link, string rodape)
    {
        Func<string, string> h = s => WebUtility.HtmlEncode(s);
        var corpoHtml = string.Concat(paragrafos.Select(p => $"<p style=\"margin:0 0 16px\">{h(p)}</p>"));
        var html = $"""
            <!doctype html>
            <html lang="pt-BR"><body style="margin:0;padding:24px;background:#ffffff;color:#2f2335;font-family:Arial,Helvetica,sans-serif;font-size:20px;line-height:1.5">
            <p style="margin:0 0 16px;font-size:24px"><strong>{h(saudacao)}</strong></p>
            {corpoHtml}
            <p style="margin:24px 0"><a href="{h(link)}" style="display:inline-block;padding:16px 28px;background:#4d3159;color:#ffffff;text-decoration:none;border-radius:8px;font-size:22px;font-weight:bold">{h(botao)}</a></p>
            <p style="margin:0 0 16px">Se o botão não funcionar, copie este endereço no navegador:<br><a href="{h(link)}" style="color:#4d3159;word-break:break-all">{h(link)}</a></p>
            <p style="margin:24px 0 0;font-size:16px;color:#6f6275">{h(rodape)}</p>
            </body></html>
            """;

        var texto = string.Join("\n\n", [saudacao, .. paragrafos, $"{botao}: {link}", rodape]);
        return new MensagemEmail(para, assunto, html, texto);
    }
}
