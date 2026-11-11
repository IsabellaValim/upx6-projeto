using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using Estudae.Infra.Email;
using Microsoft.Extensions.Configuration;

namespace Estudae.Tests.Conta;

public class EnviadorEmailResendTests
{
    private static readonly ConfigEmail Config = new(ConfigEmail.Resend, "Estudaê <nao-responda@estudae.com.br>", "re_teste");
    private static readonly MensagemEmail Mensagem = new("maria@gmail.com", "Assunto", "<p>Oi</p>", "Oi");

    // Handler falso: guarda a requisição e devolve a resposta escolhida. Nada sai para a internet.
    private sealed class HandlerFalso(HttpStatusCode status, string corpo = "{\"id\":\"1\"}") : HttpMessageHandler
    {
        public HttpRequestMessage? Requisicao { get; private set; }
        public string? CorpoEnviado { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage r, CancellationToken ct)
        {
            Requisicao = r;
            CorpoEnviado = r.Content is null ? null : await r.Content.ReadAsStringAsync(ct);
            return new HttpResponseMessage(status) { Content = new StringContent(corpo) };
        }
    }

    private static (EnviadorEmailResend, HandlerFalso) Montar(HttpStatusCode status, string corpo = "{\"id\":\"1\"}")
    {
        var handler = new HandlerFalso(status, corpo);
        var http = new HttpClient(handler) { BaseAddress = new Uri("https://api.resend.com/") };
        http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", Config.ResendApiKey);
        return (new EnviadorEmailResend(http, Config), handler);
    }

    [Fact]
    public async Task Envia_post_para_emails_com_o_formato_do_resend()
    {
        var (enviador, handler) = Montar(HttpStatusCode.OK);
        await enviador.EnviarAsync(Mensagem);

        Assert.Equal(HttpMethod.Post, handler.Requisicao!.Method);
        Assert.Equal("https://api.resend.com/emails", handler.Requisicao.RequestUri!.ToString());
        Assert.Equal("Bearer re_teste", handler.Requisicao.Headers.Authorization!.ToString());

        var json = JsonDocument.Parse(handler.CorpoEnviado!).RootElement;
        Assert.Equal("Estudaê <nao-responda@estudae.com.br>", json.GetProperty("from").GetString());
        Assert.Equal(["maria@gmail.com"], json.GetProperty("to").EnumerateArray().Select(e => e.GetString()));
        Assert.Equal("Assunto", json.GetProperty("subject").GetString());
        Assert.Equal("<p>Oi</p>", json.GetProperty("html").GetString());
        Assert.Equal("Oi", json.GetProperty("text").GetString());
    }

    [Fact]
    public async Task Recusa_do_resend_vira_EnvioEmailException_com_o_motivo()
    {
        var (enviador, _) = Montar(HttpStatusCode.Forbidden, "{\"message\":\"domain not verified\"}");
        var ex = await Assert.ThrowsAsync<EnvioEmailException>(() => enviador.EnviarAsync(Mensagem));
        Assert.Contains("403", ex.Message);
        Assert.Contains("domain not verified", ex.Message);
    }
}

public class ConfigEmailTests
{
    private static ConfigEmail Ler(params (string Chave, string? Valor)[] valores) =>
        ConfigEmail.Ler(new ConfigurationBuilder()
            .AddInMemoryCollection(valores.Select(v => KeyValuePair.Create(v.Chave, v.Valor)))
            .Build());

    [Fact]
    public void Sem_configuracao_o_padrao_e_log()
    {
        var c = Ler();
        Assert.Equal(ConfigEmail.Log, c.Provedor);
        Assert.False(c.EntregaDeVerdade);
    }

    [Fact]
    public void Resend_completo_entrega_de_verdade()
    {
        var c = Ler(("Email:Provedor", "Resend"), ("Email:Remetente", "a@b.com"), ("Email:ResendApiKey", "re_x"));
        Assert.True(c.EntregaDeVerdade);
    }

    [Theory]
    [InlineData(null, "a@b.com")]
    [InlineData("re_x", null)]
    [InlineData("  ", "a@b.com")]
    public void Resend_sem_chave_ou_remetente_impede_a_api_de_subir(string? chave, string? remetente) =>
        Assert.Throws<InvalidOperationException>(() =>
            Ler(("Email:Provedor", "resend"), ("Email:Remetente", remetente), ("Email:ResendApiKey", chave)));

    [Fact]
    public void Provedor_desconhecido_impede_a_api_de_subir() =>
        Assert.Throws<InvalidOperationException>(() => Ler(("Email:Provedor", "smtp")));
}
