using Microsoft.AspNetCore.Identity;

namespace Estudae.Infra.Identity;

// Regras de conta num lugar só (decididas em 10/11/2026, ver CLAUDE.md).
//
// Senha: só comprimento, sem regra de composição. É a recomendação atual do
// NIST (SP 800-63B): "Senha@123" é pior que uma frase longa, e exigir símbolo
// e maiúscula atrapalha justamente o nosso público (pessoas idosas).
public static class PoliticaConta
{
    public const int SenhaMinimo = 8;
    // Teto só para ninguém mandar 1 MB de "senha" para o hash calcular.
    public const int SenhaMaximo = 128;
    public const int NomeMaximo = 150; // = tamanho da coluna usuario.nome
    public const int EmailMaximo = 254; // limite prático de um endereço (RFC 5321)

    public const int TentativasAteBloquear = 5;
    public static readonly TimeSpan TempoBloqueio = TimeSpan.FromMinutes(5);

    // Sessão longa e renovada a cada uso: ninguém precisa entrar toda vez.
    public static readonly TimeSpan DuracaoSessao = TimeSpan.FromDays(30);

    // Link de confirmação dura mais que o de redefinir senha: a pessoa pode
    // demorar dias para abrir o e-mail. O de senha é mais sensível (troca o
    // acesso à conta), então fica com o padrão de 1 dia.
    public const string ProvedorConfirmacaoEmail = "ConfirmacaoEmail";
    public static readonly TimeSpan ValidadeLinkConfirmacao = TimeSpan.FromDays(3);
    public static readonly TimeSpan ValidadeLinkRedefinicao = TimeSpan.FromDays(1);

    public static void Aplicar(IdentityOptions o)
    {
        o.Password.RequiredLength = SenhaMinimo;
        o.Password.RequireDigit = false;
        o.Password.RequireLowercase = false;
        o.Password.RequireUppercase = false;
        o.Password.RequireNonAlphanumeric = false;
        o.Password.RequiredUniqueChars = 1;

        // O nome de usuário é o próprio e-mail. A lista padrão de caracteres
        // permitidos recusaria e-mails válidos; quem valida o e-mail é a
        // ValidacaoConta (string vazia desliga a checagem do Identity).
        o.User.AllowedUserNameCharacters = string.Empty;
        o.User.RequireUniqueEmail = true;

        o.SignIn.RequireConfirmedEmail = true;

        o.Lockout.AllowedForNewUsers = true;
        o.Lockout.MaxFailedAccessAttempts = TentativasAteBloquear;
        o.Lockout.DefaultLockoutTimeSpan = TempoBloqueio;

        o.Tokens.EmailConfirmationTokenProvider = ProvedorConfirmacaoEmail;
    }
}
