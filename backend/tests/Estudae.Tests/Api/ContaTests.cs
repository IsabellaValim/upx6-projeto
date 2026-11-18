using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Estudae.Api.Conta;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;

namespace Estudae.Tests.Api;

// Fluxos de conta de ponta a ponta: API de verdade, Postgres descartável e a
// caixa de entrada em memória do fixture. Cada teste usa um e-mail próprio.
[Collection(ApiCollection.Nome)]
public class ContaTests(ApiFixture f)
{
    private const string Senha = "netos da vovó";

    private static string NovoEmail() => $"teste-{Guid.NewGuid():N}@exemplo.com.br";

    // Cliente próprio por teste: cada um tem o seu "navegador" (pote de cookies).
    private HttpClient Navegador() =>
        f.Factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

    private static async Task<JsonElement> Json(HttpResponseMessage r) =>
        JsonDocument.Parse(await r.Content.ReadAsStringAsync()).RootElement;

    private static async Task<string> Erro(HttpResponseMessage r) => (await Json(r)).GetProperty("erro").GetString()!;

    private static Task<HttpResponseMessage> Cadastrar(HttpClient c, string email, string senha = Senha, string nome = "Maria") =>
        c.PostAsJsonAsync("/api/conta/cadastro", new { nome, email, senha });

    private static Task<HttpResponseMessage> Entrar(HttpClient c, string email, string senha = Senha) =>
        c.PostAsJsonAsync("/api/conta/entrar", new { email, senha });

    private async Task<HttpResponseMessage> Confirmar(HttpClient c, string email)
    {
        var (usuarioId, token) = f.Emails.UltimaConfirmacao(email);
        return await c.PostAsJsonAsync("/api/conta/confirmar-email", new { usuarioId, token });
    }

    // Conta criada, confirmada e logada no navegador devolvido.
    private async Task<(HttpClient Navegador, string Email)> ContaPronta()
    {
        var c = Navegador();
        var email = NovoEmail();
        Assert.Equal(HttpStatusCode.Accepted, (await Cadastrar(c, email)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Confirmar(c, email)).StatusCode);
        return (c, email);
    }

    // ---- cadastro ----

    [Fact]
    public async Task Opcoes_dizem_que_o_cadastro_esta_aberto_em_desenvolvimento()
    {
        var json = await f.Client.GetFromJsonAsync<JsonElement>("/api/conta/opcoes");
        Assert.True(json.GetProperty("cadastroAberto").GetBoolean());
    }

    [Fact]
    public async Task Cadastro_grava_usuario_com_hash_sem_confirmar_e_manda_o_email()
    {
        var email = NovoEmail();
        var r = await Cadastrar(Navegador(), "  " + email.ToUpperInvariant() + " ", nome: "  Maria   da Silva ");
        Assert.Equal(HttpStatusCode.Accepted, r.StatusCode);
        Assert.Contains(email, (await Json(r)).GetProperty("mensagem").GetString());

        await using var db = f.NovoContexto();
        var u = await db.Users.SingleAsync(x => x.Email == email); // gravado em minúsculo e aparado
        Assert.Equal("Maria da Silva", u.Nome);
        Assert.Equal(email, u.UserName);
        Assert.False(u.EmailConfirmed);
        Assert.NotNull(u.PasswordHash);
        Assert.DoesNotContain(Senha, u.PasswordHash); // nunca a senha em texto puro
        Assert.True(u.LockoutEnabled);

        var mensagem = Assert.Single(f.Emails.Para(email));
        Assert.Equal("Confirme seu e-mail no Estudaê", mensagem.Assunto);
        Assert.Contains("http://localhost:8080/confirmar-email?u=" + u.Id, mensagem.Texto); // App:UrlPublica
    }

    [Fact]
    public async Task Senha_curta_da_400_em_portugues_com_ou_sem_conta_existente()
    {
        var (_, existente) = await ContaPronta();
        foreach (var email in new[] { NovoEmail(), existente })
        {
            var r = await Cadastrar(Navegador(), email, senha: "1234567");
            Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
            Assert.Equal("A senha precisa ter pelo menos 8 caracteres.", await Erro(r)); // mesma resposta: não revela a conta
        }
    }

    [Theory]
    [InlineData("", "a@b.com.br", "Digite seu nome.")]
    [InlineData("Maria", "maria@gmail", ValidacaoConta.ErroEmail)]
    [InlineData("Maria", "a@b.com.br", "Digite uma senha.")]
    public async Task Cadastro_invalido_da_400_com_a_mensagem(string nome, string email, string esperado)
    {
        var senha = esperado == "Digite uma senha." ? "" : Senha;
        var r = await Cadastrar(Navegador(), email, senha, nome);
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        Assert.Equal(esperado, await Erro(r));
    }

    [Fact]
    public async Task Cadastro_repetido_nao_duplica_nao_troca_a_senha_e_avisa_o_dono()
    {
        var (_, email) = await ContaPronta();

        // Mesmo e-mail com outra caixa, outro nome e outra senha: a resposta é igual à de um e-mail novo.
        var r = await Cadastrar(Navegador(), email.ToUpperInvariant(), senha: "outra senha qualquer", nome: "Intruso");
        Assert.Equal(HttpStatusCode.Accepted, r.StatusCode);

        await using var db = f.NovoContexto();
        var u = await db.Users.SingleAsync(x => x.NormalizedEmail == email.ToUpperInvariant());
        Assert.Equal("Maria", u.Nome);
        Assert.Equal(HttpStatusCode.OK, (await Entrar(Navegador(), email)).StatusCode); // senha antiga vale
        Assert.Equal(HttpStatusCode.Unauthorized, (await Entrar(Navegador(), email, "outra senha qualquer")).StatusCode);

        Assert.Equal("Você já tem uma conta no Estudaê", f.Emails.Para(email).Last().Assunto);
    }

    [Fact]
    public async Task Cadastro_repetido_sem_confirmar_reenvia_a_confirmacao()
    {
        var email = NovoEmail();
        await Cadastrar(Navegador(), email);
        await Cadastrar(Navegador(), email);
        Assert.Equal(2, f.Emails.Para(email).Count(m => m.Assunto == "Confirme seu e-mail no Estudaê"));
    }

    // ---- confirmação e sessão ----

    [Fact]
    public async Task Fluxo_completo_cadastro_confirmacao_eu_e_sair()
    {
        var c = Navegador();
        var email = NovoEmail();
        await Cadastrar(c, email);

        Assert.Equal(HttpStatusCode.Unauthorized, (await c.GetAsync("/api/conta/eu")).StatusCode); // ainda não entrou

        var confirmado = await Confirmar(c, email); // o link já deixa logado
        Assert.Equal(HttpStatusCode.OK, confirmado.StatusCode);
        Assert.Equal(email, (await Json(confirmado)).GetProperty("email").GetString());

        var eu = await Json(await c.GetAsync("/api/conta/eu"));
        Assert.Equal("Maria", eu.GetProperty("nome").GetString());
        Assert.Equal(email, eu.GetProperty("email").GetString());

        Assert.Equal(HttpStatusCode.NoContent, (await c.PostAsync("/api/conta/sair", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await c.GetAsync("/api/conta/eu")).StatusCode);

        await using var db = f.NovoContexto();
        Assert.True((await db.Users.SingleAsync(x => x.Email == email)).EmailConfirmed);
    }

    [Fact]
    public async Task Cookie_de_sessao_e_HttpOnly_SameSite_Lax_e_persistente()
    {
        var (_, email) = await ContaPronta();
        using var semCookies = f.Factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });
        var r = await Entrar(semCookies, email);
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);

        var cookie = Assert.Single(r.Headers.GetValues("Set-Cookie"), v => v.StartsWith(ConfiguracaoConta.NomeCookie + "="));
        Assert.Contains("httponly", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("samesite=lax", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("expires=", cookie, StringComparison.OrdinalIgnoreCase); // persistente: sobrevive a fechar o navegador
    }

    [Fact]
    public async Task Rota_protegida_sem_login_da_401_em_json_e_nao_redireciona()
    {
        var r = await Navegador().GetAsync("/api/conta/eu");
        Assert.Equal(HttpStatusCode.Unauthorized, r.StatusCode);
        Assert.Equal("Você precisa entrar na sua conta.", await Erro(r));
    }

    [Fact]
    public async Task Link_de_confirmacao_adulterado_ou_de_outra_pessoa_da_400()
    {
        var email = NovoEmail();
        await Cadastrar(Navegador(), email);
        var (usuarioId, token) = f.Emails.UltimaConfirmacao(email);
        var (_, outroEmail) = await ContaPronta();
        var (outroId, _) = f.Emails.UltimaConfirmacao(outroEmail);

        foreach (var corpo in new object[]
                 {
                     new { usuarioId, token = token[..^4] + "AAAA" },
                     new { usuarioId = outroId, token }, // token de um, usuário de outro
                     new { usuarioId = "nao-existe", token },
                     new { usuarioId, token = "" },
                 })
        {
            var r = await Navegador().PostAsJsonAsync("/api/conta/confirmar-email", corpo);
            Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
            Assert.Equal("Este link não vale mais. Peça um novo e-mail.", await Erro(r));
        }
    }

    [Fact]
    public async Task Token_de_redefinir_senha_nao_serve_para_confirmar_email()
    {
        var c = Navegador();
        var email = NovoEmail();
        await Cadastrar(c, email);
        await c.PostAsJsonAsync("/api/conta/esqueci-senha", new { email });
        var (usuarioId, tokenSenha) = f.Emails.UltimaRedefinicao(email);

        var r = await c.PostAsJsonAsync("/api/conta/confirmar-email", new { usuarioId, token = tokenSenha });
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
    }

    // ---- login ----

    [Fact]
    public async Task Antes_de_confirmar_senha_certa_da_403_com_codigo_e_senha_errada_da_401()
    {
        var email = NovoEmail();
        await Cadastrar(Navegador(), email);

        var certa = await Entrar(Navegador(), email);
        Assert.Equal(HttpStatusCode.Forbidden, certa.StatusCode);
        Assert.Equal(ContaEndpoints.CodigoEmailNaoConfirmado, (await Json(certa)).GetProperty("codigo").GetString());

        // Com a senha errada, nada revela que a conta existe e falta confirmar.
        var errada = await Entrar(Navegador(), email, "senha errada!!");
        Assert.Equal(HttpStatusCode.Unauthorized, errada.StatusCode);
        Assert.Equal("E-mail ou senha incorretos.", await Erro(errada));
    }

    [Fact]
    public async Task Email_inexistente_e_senha_errada_dao_a_mesma_resposta()
    {
        var (_, email) = await ContaPronta();
        var inexistente = await Entrar(Navegador(), NovoEmail());
        var errada = await Entrar(Navegador(), email, "senha errada!!");

        Assert.Equal(HttpStatusCode.Unauthorized, inexistente.StatusCode);
        Assert.Equal(inexistente.StatusCode, errada.StatusCode);
        Assert.Equal(await Erro(inexistente), await Erro(errada));
    }

    [Fact]
    public async Task Login_aceita_o_email_com_maiusculas_e_espacos()
    {
        var (_, email) = await ContaPronta();
        Assert.Equal(HttpStatusCode.OK, (await Entrar(Navegador(), $"  {email.ToUpperInvariant()} ")).StatusCode);
    }

    [Fact]
    public async Task Cinco_senhas_erradas_bloqueiam_a_conta_por_5_minutos()
    {
        var (_, email) = await ContaPronta();
        var c = Navegador();
        for (var i = 1; i <= 4; i++)
            Assert.Equal(HttpStatusCode.Unauthorized, (await Entrar(c, email, "senha errada!!")).StatusCode);

        var quinta = await Entrar(c, email, "senha errada!!");
        Assert.Equal(HttpStatusCode.TooManyRequests, quinta.StatusCode);
        Assert.Contains("5 minutos", await Erro(quinta));

        // Bloqueada, nem a senha certa entra.
        Assert.Equal(HttpStatusCode.TooManyRequests, (await Entrar(c, email)).StatusCode);

        await using var db = f.NovoContexto();
        var u = await db.Users.SingleAsync(x => x.Email == email);
        Assert.True(u.LockoutEnd > DateTimeOffset.UtcNow.AddMinutes(4));
    }

    [Fact]
    public async Task Login_certo_zera_a_contagem_de_erros()
    {
        var (_, email) = await ContaPronta();
        var c = Navegador();
        for (var i = 0; i < 3; i++) await Entrar(c, email, "senha errada!!");
        Assert.Equal(HttpStatusCode.OK, (await Entrar(c, email)).StatusCode);

        await using var db = f.NovoContexto();
        Assert.Equal(0, (await db.Users.SingleAsync(x => x.Email == email)).AccessFailedCount);
    }

    // ---- esqueci / redefinir senha ----

    [Fact]
    public async Task Esqueci_a_senha_responde_igual_com_ou_sem_conta_e_so_envia_se_existir()
    {
        var (_, email) = await ContaPronta();
        var inexistente = NovoEmail();

        var r1 = await Navegador().PostAsJsonAsync("/api/conta/esqueci-senha", new { email });
        var r2 = await Navegador().PostAsJsonAsync("/api/conta/esqueci-senha", new { email = inexistente });
        Assert.Equal(HttpStatusCode.Accepted, r1.StatusCode);
        Assert.Equal(HttpStatusCode.Accepted, r2.StatusCode);

        Assert.Equal("Crie uma senha nova no Estudaê", f.Emails.Para(email).Last().Assunto);
        Assert.Empty(f.Emails.Para(inexistente));
    }

    [Fact]
    public async Task Redefinir_troca_a_senha_desbloqueia_e_ja_entra()
    {
        var (_, email) = await ContaPronta();
        for (var i = 0; i < 5; i++) await Entrar(Navegador(), email, "senha errada!!"); // bloqueada

        await Navegador().PostAsJsonAsync("/api/conta/esqueci-senha", new { email });
        var (usuarioId, token) = f.Emails.UltimaRedefinicao(email);

        var c = Navegador();
        var curta = await c.PostAsJsonAsync("/api/conta/redefinir-senha", new { usuarioId, token, senha = "curta" });
        Assert.Equal("A senha precisa ter pelo menos 8 caracteres.", await Erro(curta));

        var r = await c.PostAsJsonAsync("/api/conta/redefinir-senha", new { usuarioId, token, senha = "senha nova da maria" });
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await c.GetAsync("/api/conta/eu")).StatusCode); // já entrou

        Assert.Equal(HttpStatusCode.Unauthorized, (await Entrar(Navegador(), email)).StatusCode); // senha antiga morreu
        Assert.Equal(HttpStatusCode.OK, (await Entrar(Navegador(), email, "senha nova da maria")).StatusCode);

        // O token é de uso único: trocar a senha muda o security stamp.
        var deNovo = await Navegador().PostAsJsonAsync("/api/conta/redefinir-senha", new { usuarioId, token, senha = "mais uma senha nova" });
        Assert.Equal(HttpStatusCode.BadRequest, deNovo.StatusCode);
    }

    [Fact]
    public async Task Redefinir_senha_confirma_o_email_de_quem_nao_tinha_confirmado()
    {
        var email = NovoEmail();
        await Cadastrar(Navegador(), email);
        await Navegador().PostAsJsonAsync("/api/conta/esqueci-senha", new { email });
        var (usuarioId, token) = f.Emails.UltimaRedefinicao(email);

        await Navegador().PostAsJsonAsync("/api/conta/redefinir-senha", new { usuarioId, token, senha = "senha nova da maria" });
        Assert.Equal(HttpStatusCode.OK, (await Entrar(Navegador(), email, "senha nova da maria")).StatusCode);
    }

    [Fact]
    public async Task Reenviar_confirmacao_so_envia_para_conta_nao_confirmada()
    {
        var pendente = NovoEmail();
        await Cadastrar(Navegador(), pendente);
        var (_, confirmada) = await ContaPronta();
        var antes = f.Emails.Para(confirmada).Count;

        foreach (var email in new[] { pendente, confirmada, NovoEmail() })
            Assert.Equal(HttpStatusCode.Accepted,
                (await Navegador().PostAsJsonAsync("/api/conta/reenviar-confirmacao", new { email })).StatusCode);

        Assert.Equal(2, f.Emails.Para(pendente).Count);
        Assert.Equal(antes, f.Emails.Para(confirmada).Count);
    }

    // ---- excluir conta ----

    [Fact]
    public async Task Excluir_conta_pede_a_senha_apaga_do_banco_e_derruba_outras_sessoes()
    {
        var (c, email) = await ContaPronta();
        var outroAparelho = Navegador();
        await Entrar(outroAparelho, email);

        var errada = await c.PostAsJsonAsync("/api/conta/excluir", new { senha = "senha errada!!" });
        Assert.Equal(HttpStatusCode.Unauthorized, errada.StatusCode);

        Assert.Equal(HttpStatusCode.NoContent, (await c.PostAsJsonAsync("/api/conta/excluir", new { senha = Senha })).StatusCode);

        await using var db = f.NovoContexto();
        Assert.False(await db.Users.AnyAsync(x => x.Email == email));
        Assert.Equal(HttpStatusCode.Unauthorized, (await c.GetAsync("/api/conta/eu")).StatusCode);
        // O cookie do outro aparelho ainda é válido, mas a conta não existe mais.
        Assert.Equal(HttpStatusCode.Unauthorized, (await outroAparelho.GetAsync("/api/conta/eu")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Entrar(Navegador(), email)).StatusCode);
    }

    [Fact]
    public async Task Excluir_sem_login_da_401()
    {
        var r = await Navegador().PostAsJsonAsync("/api/conta/excluir", new { senha = Senha });
        Assert.Equal(HttpStatusCode.Unauthorized, r.StatusCode);
    }

    // ---- chaves de proteção ----

    [Fact]
    public async Task Chaves_que_assinam_o_cookie_ficam_no_banco()
    {
        await ContaPronta(); // gerar token e cookie obriga a existir uma chave
        await using var db = f.NovoContexto();
        var chave = await db.DataProtectionKeys.FirstAsync();
        Assert.Contains("<key", chave.Xml);
    }
}
