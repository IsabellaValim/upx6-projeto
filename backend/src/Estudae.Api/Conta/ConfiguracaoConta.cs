using Estudae.Api.Endpoints;
using Estudae.Infra.Email;
using Estudae.Infra.Identity;
using Estudae.Infra.Persistence;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;

namespace Estudae.Api.Conta;

// Token de confirmação de e-mail com validade própria (3 dias). O provedor
// padrão do Identity serve a todos os tokens com uma validade só, e o link de
// redefinir senha deve durar menos. O Name diferente também separa os dois
// propósitos: um token de confirmação não serve para trocar a senha.
public sealed class OpcoesTokenConfirmacao : DataProtectionTokenProviderOptions;

public sealed class TokenConfirmacaoEmail(
    IDataProtectionProvider protecao,
    IOptions<OpcoesTokenConfirmacao> opcoes,
    ILogger<DataProtectorTokenProvider<Usuario>> log)
    : DataProtectorTokenProvider<Usuario>(protecao, opcoes, log);

public static class ConfiguracaoConta
{
    public const string NomeCookie = "estudae_sessao";

    public static IServiceCollection AddConta(
        this IServiceCollection services, IConfiguration config, IHostEnvironment ambiente)
    {
        var email = ConfigEmail.Ler(config);
        services.AddSingleton(ConfigConta.Montar(config["App:UrlPublica"], email.EntregaDeVerdade, ambiente.IsDevelopment()));

        // Identity: usuário, senha com hash (PBKDF2), bloqueio, tokens. As regras
        // estão todas na PoliticaConta.
        services
            .AddIdentity<Usuario, IdentityRole>(PoliticaConta.Aplicar)
            .AddEntityFrameworkStores<EstudaeDbContext>()
            .AddErrorDescriber<ErrosIdentityPtBr>()
            .AddDefaultTokenProviders() // redefinir senha (e trocar e-mail, no futuro)
            .AddTokenProvider<TokenConfirmacaoEmail>(PoliticaConta.ProvedorConfirmacaoEmail);

        services.Configure<DataProtectionTokenProviderOptions>(o =>
            o.TokenLifespan = PoliticaConta.ValidadeLinkRedefinicao);
        services.Configure<OpcoesTokenConfirmacao>(o =>
        {
            o.Name = PoliticaConta.ProvedorConfirmacaoEmail;
            o.TokenLifespan = PoliticaConta.ValidadeLinkConfirmacao;
        });

        // Chaves no banco (tabela chave_protecao): sobrevivem ao container
        // recriado em cada deploy. Sem isso, todo deploy deslogaria todo mundo.
        services.AddDataProtection()
            .SetApplicationName("Estudae")
            .PersistKeysToDbContext<EstudaeDbContext>();

        services.ConfigureApplicationCookie(o =>
        {
            o.Cookie.Name = NomeCookie;
            o.Cookie.HttpOnly = true; // o JavaScript da página não lê o cookie
            // Lax: o navegador não manda o cookie em POST disparado por outro site
            // (defesa principal contra CSRF; os POSTs também exigem corpo JSON).
            o.Cookie.SameSite = SameSiteMode.Lax;
            // Secure quando a requisição é HTTPS. Atrás do Caddy, a API precisa
            // saber que a requisição original era HTTPS (ForwardedHeaders, no deploy).
            o.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
            o.ExpireTimeSpan = PoliticaConta.DuracaoSessao;
            o.SlidingExpiration = true;

            // O padrão é redirecionar para /Account/Login (feito para MVC). Numa API
            // o fetch seguiria o 302 e receberia HTML; aqui é 401/403 com JSON.
            o.Events.OnRedirectToLogin = ctx => Responder(ctx.Response, StatusCodes.Status401Unauthorized,
                "Você precisa entrar na sua conta.");
            o.Events.OnRedirectToAccessDenied = ctx => Responder(ctx.Response, StatusCodes.Status403Forbidden,
                "Você não tem acesso a esta área.");
        });

        return services;
    }

    private static Task Responder(HttpResponse resposta, int status, string mensagem)
    {
        resposta.StatusCode = status;
        return resposta.WriteAsJsonAsync(new ProblemaDto(mensagem));
    }
}
