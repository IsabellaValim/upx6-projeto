using System.Threading.RateLimiting;
using Estudae.Api.Endpoints;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;

namespace Estudae.Api.Conta;

// Seção "Limites" (em container: Limites__EnvioEmailPorIp etc.).
public sealed class OpcoesLimites
{
    // cadastro, reenviar-confirmacao e esqueci-senha (os que mandam e-mail).
    public int EnvioEmailPorIp { get; set; } = 5;
    public int EnvioEmailJanelaMinutos { get; set; } = 15;

    // entrar, confirmar-email e redefinir-senha, por minuto. O bloqueio do
    // Identity protege cada conta; este freia quem testa senhas em várias.
    public int ContaPorIpPorMinuto { get; set; } = 20;
}

// Limite de requisições por IP nas rotas de conta. É a primeira barreira; a que
// não depende do IP (forjável) fica no envio de e-mail (Infra/Email/EnviadorEmailLimitado).
public static class LimitesConta
{
    public const string EnvioEmail = "envio-email";
    public const string Conta = "conta";

    private const string Mensagem = "Muitas tentativas. Espere alguns minutos e tente de novo.";

    public static IServiceCollection AddLimitesConta(this IServiceCollection services, IConfiguration config)
    {
        services.Configure<OpcoesLimites>(config.GetSection("Limites"));

        // Caminho em produção: navegador → Vercel → Render → container. O IP do
        // aluno chega no X-Forwarded-For. Saltos = quantos proxies contar do fim
        // da lista (Proxy:Saltos; padrão 1). Os proxies não têm IP fixo, então
        // nenhum é "conhecido": a lista inteira é aceita.
        services.Configure<ForwardedHeadersOptions>(o =>
        {
            o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
            o.ForwardLimit = config.GetValue("Proxy:Saltos", 1);
            o.KnownIPNetworks.Clear();
            o.KnownProxies.Clear();
        });

        services.AddRateLimiter(o =>
        {
            o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            o.OnRejected = async (ctx, ct) =>
            {
                if (ctx.Lease.TryGetMetadata(MetadataName.RetryAfter, out var espera))
                    ctx.HttpContext.Response.Headers.RetryAfter = ((int)Math.Ceiling(espera.TotalSeconds)).ToString();
                await ctx.HttpContext.Response.WriteAsJsonAsync(new ProblemaDto(Mensagem), ct);
            };

            o.AddPolicy(EnvioEmail, ctx => PorIp(ctx, l =>
                (l.EnvioEmailPorIp, TimeSpan.FromMinutes(l.EnvioEmailJanelaMinutos))));
            o.AddPolicy(Conta, ctx => PorIp(ctx, l => (l.ContaPorIpPorMinuto, TimeSpan.FromMinutes(1))));
        });

        return services;
    }

    // Os números são lidos quando a partição do IP nasce (no primeiro pedido dele).
    private static RateLimitPartition<string> PorIp(
        HttpContext ctx, Func<OpcoesLimites, (int Limite, TimeSpan Janela)> escolher)
    {
        var ip = ctx.Connection.RemoteIpAddress?.ToString() ?? "sem-ip";
        return RateLimitPartition.GetFixedWindowLimiter(ip, _ =>
        {
            var (limite, janela) = escolher(ctx.RequestServices.GetRequiredService<IOptions<OpcoesLimites>>().Value);
            return new FixedWindowRateLimiterOptions
            {
                PermitLimit = limite,
                Window = janela,
                QueueLimit = 0,
                AutoReplenishment = true,
            };
        });
    }
}
