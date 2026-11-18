using Microsoft.AspNetCore.Identity;

namespace Estudae.Infra.Identity;

// Mensagens do Identity em português, escritas para quem vai ler na tela.
// Só as que podem chegar ao usuário com a nossa política; as demais caem no
// DefaultError. Os códigos (Code) continuam os do Identity.
public sealed class ErrosIdentityPtBr : IdentityErrorDescriber
{
    private static IdentityError Erro(string codigo, string mensagem) => new() { Code = codigo, Description = mensagem };

    public override IdentityError DefaultError() =>
        Erro(nameof(DefaultError), "Não foi possível concluir. Tente de novo em instantes.");

    public override IdentityError PasswordTooShort(int length) =>
        Erro(nameof(PasswordTooShort), $"A senha precisa ter pelo menos {length} caracteres.");

    public override IdentityError PasswordMismatch() =>
        Erro(nameof(PasswordMismatch), "Senha incorreta.");

    public override IdentityError InvalidToken() =>
        Erro(nameof(InvalidToken), "Este link não vale mais. Peça um novo e-mail.");

    public override IdentityError InvalidEmail(string? email) =>
        Erro(nameof(InvalidEmail), "Digite um e-mail válido, como maria@gmail.com.");

    public override IdentityError InvalidUserName(string? userName) =>
        Erro(nameof(InvalidUserName), "Digite um e-mail válido, como maria@gmail.com.");

    // Só acontece numa corrida (dois cadastros iguais ao mesmo tempo): o fluxo
    // normal nunca diz que o e-mail já existe (ver ContaEndpoints).
    public override IdentityError DuplicateEmail(string? email) =>
        Erro(nameof(DuplicateEmail), "Não foi possível concluir. Tente de novo em instantes.");

    public override IdentityError DuplicateUserName(string? userName) =>
        Erro(nameof(DuplicateUserName), "Não foi possível concluir. Tente de novo em instantes.");

    public override IdentityError ConcurrencyFailure() =>
        Erro(nameof(ConcurrencyFailure), "Seus dados mudaram enquanto você salvava. Tente de novo.");
}
