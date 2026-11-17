using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Estudae.Api.Conta;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace Estudae.Tests.Api;

// Limite por IP nas rotas de conta e o cookie Secure fora de desenvolvimento.
// Cada teste sobe a própria API (WithWebHostBuilder): os contadores do limite
// moram na instância, então um teste não gasta a cota do outro.
[Collection(ApiCollection.Nome)]
public class LimitesContaTests(ApiFixture f)
{
    private WebApplicationFactory<Program> ApiCom(Action<OpcoesLimites> limites) =>
        f.Factory.WithWebHostBuilder(b => b.ConfigureTestServices(s => s.Configure(limites)));

    private static Task<HttpResponseMessage> Esqueci(HttpClient c, string? ip = null)
    {
        var r = new HttpRequestMessage(HttpMethod.Post, "/api/conta/esqueci-senha")
        {
            Content = JsonContent.Create(new { email = "ninguem@exemplo.com.br" }),
        };
        if (ip is not null) r.Headers.Add("X-Forwarded-For", ip);
        return c.SendAsync(r);
    }

    [Fact]
    public async Task Acima_do_limite_de_envio_por_ip_responde_429_com_erro_e_retry_after()
    {
        await using var api = ApiCom(o => o.EnvioEmailPorIp = 2);
        var c = api.CreateClient();

        Assert.Equal(HttpStatusCode.Accepted, (await Esqueci(c)).StatusCode);
        Assert.Equal(HttpStatusCode.Accepted, (await Esqueci(c)).StatusCode);
        var r = await Esqueci(c);

        Assert.Equal(HttpStatusCode.TooManyRequests, r.StatusCode);
        Assert.NotNull(r.Headers.RetryAfter);
        var json = JsonDocument.Parse(await r.Content.ReadAsStringAsync()).RootElement;
        Assert.Contains("Muitas tentativas", json.GetProperty("erro").GetString());
    }

    [Fact]
    public async Task Limite_de_envio_vale_para_cadastro_e_reenviar_somados()
    {
        await using var api = ApiCom(o => o.EnvioEmailPorIp = 2);
        var c = api.CreateClient();

        await c.PostAsJsonAsync("/api/conta/reenviar-confirmacao", new { email = "a@exemplo.com.br" });
        await c.PostAsJsonAsync("/api/conta/cadastro", new { nome = "A", email = "a@exemplo.com.br", senha = "netos da vovó" });
        var r = await Esqueci(c);

        Assert.Equal(HttpStatusCode.TooManyRequests, r.StatusCode);
    }

    [Fact]
    public async Task Cada_ip_do_x_forwarded_for_tem_o_proprio_limite()
    {
        await using var api = ApiCom(o => o.EnvioEmailPorIp = 1);
        var c = api.CreateClient();

        Assert.Equal(HttpStatusCode.Accepted, (await Esqueci(c, "203.0.113.1")).StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests, (await Esqueci(c, "203.0.113.1")).StatusCode);
        Assert.Equal(HttpStatusCode.Accepted, (await Esqueci(c, "203.0.113.2")).StatusCode);
    }

    [Fact]
    public async Task Entrar_tem_limite_proprio_por_ip()
    {
        await using var api = ApiCom(o => o.ContaPorIpPorMinuto = 1);
        var c = api.CreateClient();
        var corpo = new { email = "ninguem@exemplo.com.br", senha = "senha errada" };

        Assert.Equal(HttpStatusCode.Unauthorized, (await c.PostAsJsonAsync("/api/conta/entrar", corpo)).StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests, (await c.PostAsJsonAsync("/api/conta/entrar", corpo)).StatusCode);
    }

    [Theory]
    [InlineData("Development", CookieSecurePolicy.SameAsRequest)]
    [InlineData("Production", CookieSecurePolicy.Always)]
    public async Task Cookie_de_sessao_e_sempre_secure_fora_de_desenvolvimento(string ambiente, CookieSecurePolicy esperado)
    {
        await using var api = f.Factory.WithWebHostBuilder(b => b.UseEnvironment(ambiente));
        var opcoes = api.Services.GetRequiredService<IOptionsMonitor<CookieAuthenticationOptions>>()
            .Get(IdentityConstants.ApplicationScheme);

        Assert.Equal(ConfiguracaoConta.NomeCookie, opcoes.Cookie.Name);
        Assert.Equal(esperado, opcoes.Cookie.SecurePolicy);
    }
}
