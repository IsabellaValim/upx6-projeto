using System.Net.Mail;
using System.Text;
using System.Text.RegularExpressions;
using Estudae.Infra.Identity;

namespace Estudae.Api.Conta;

// Validação e normalização do que a pessoa digita. Pura (sem banco, sem DI),
// para ser testada direto. O comprimento mínimo da senha NÃO é checado aqui:
// quem decide é o PasswordValidator do Identity, com a PoliticaConta.
public static partial class ValidacaoConta
{
    public const string ErroEmail = "Digite um e-mail válido, como maria@gmail.com.";

    // "  Maria   da  Silva " -> "Maria da Silva" (e Unicode NFC, como o importador).
    public static (string? Nome, string? Erro) Nome(string? bruto)
    {
        var nome = Espacos().Replace(bruto ?? "", " ").Trim().Normalize(NormalizationForm.FormC);
        if (nome.Length == 0) return (null, "Digite seu nome.");
        if (nome.Length > PoliticaConta.NomeMaximo)
            return (null, $"O nome pode ter no máximo {PoliticaConta.NomeMaximo} letras.");
        return (nome, null);
    }

    // Minúsculo e sem espaços nas pontas: "Maria@Gmail.com " e "maria@gmail.com"
    // são a mesma conta. Exige domínio com ponto ("maria@gmail" quase sempre é
    // erro de digitação, e o MailAddress aceitaria).
    public static (string? Email, string? Erro) Email(string? bruto)
    {
        var email = (bruto ?? "").Trim().ToLowerInvariant();
        if (email.Length == 0) return (null, "Digite seu e-mail.");
        if (email.Length > PoliticaConta.EmailMaximo || email.Any(char.IsWhiteSpace)) return (null, ErroEmail);

        if (!MailAddress.TryCreate(email, out var endereco) || endereco.Address != email) return (null, ErroEmail);
        var dominio = endereco.Host;
        if (!dominio.Contains('.') || dominio.StartsWith('.') || dominio.EndsWith('.')) return (null, ErroEmail);

        return (email, null);
    }

    // Senha não é normalizada nem aparada: espaço no fim faz parte dela.
    public static string? Senha(string? senha)
    {
        if (string.IsNullOrEmpty(senha)) return "Digite uma senha.";
        if (senha.Length > PoliticaConta.SenhaMaximo)
            return $"A senha pode ter no máximo {PoliticaConta.SenhaMaximo} caracteres.";
        return null;
    }

    [GeneratedRegex(@"\s+")]
    private static partial Regex Espacos();
}
