using Estudae.Api.Conta;

namespace Estudae.Tests.Conta;

public class LinksContaTests
{
    // Token com os caracteres que quebram numa URL.
    private const string TokenFeio = "CfDJ8+abc/def==xyz+/";

    [Fact]
    public void Token_vai_e_volta_sem_perder_nada()
    {
        var codificado = LinksConta.Codificar(TokenFeio);
        Assert.DoesNotContain('+', codificado);
        Assert.DoesNotContain('/', codificado);
        Assert.DoesNotContain('=', codificado);
        Assert.Equal(TokenFeio, LinksConta.Decodificar(codificado));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("isto não é base64url!")]
    [InlineData("a")] // comprimento impossível em base64
    public void Token_invalido_vira_null(string? tokenUrl) =>
        Assert.Null(LinksConta.Decodificar(tokenUrl));

    [Fact]
    public void Link_de_confirmacao_aponta_para_a_tela_do_front()
    {
        var link = LinksConta.Confirmacao("https://estudae.com.br", "id-1", TokenFeio);
        Assert.StartsWith("https://estudae.com.br/confirmar-email?u=id-1&t=", link);
        var t = link[(link.IndexOf("&t=", StringComparison.Ordinal) + 3)..];
        Assert.Equal(TokenFeio, LinksConta.Decodificar(t));
    }

    [Fact]
    public void Link_de_redefinicao_aponta_para_a_tela_do_front() =>
        Assert.StartsWith("https://estudae.com.br/redefinir-senha?u=id-1&t=",
            LinksConta.Redefinicao("https://estudae.com.br", "id-1", TokenFeio));
}

public class ConfigContaTests
{
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("estudae.com.br")] // sem esquema
    [InlineData("ftp://estudae.com.br")]
    public void Url_publica_invalida_impede_a_api_de_subir(string? url) =>
        Assert.Throws<InvalidOperationException>(() => ConfigConta.Montar(url, entregaDeVerdade: false, desenvolvimento: true));

    [Fact]
    public void Email_de_verdade_exige_https()
    {
        Assert.Throws<InvalidOperationException>(() =>
            ConfigConta.Montar("http://estudae.com.br", entregaDeVerdade: true, desenvolvimento: false));
        Assert.True(ConfigConta.Montar("https://estudae.com.br", true, false).CadastroAberto);
    }

    [Theory]
    [InlineData(false, true, true)] // dev com e-mail no log: aberto
    [InlineData(false, false, false)] // produção sem Resend: fechado (só visitante)
    [InlineData(true, false, true)] // produção com Resend: aberto
    public void Cadastro_so_abre_quando_o_email_sai_ou_em_dev(bool entrega, bool dev, bool aberto) =>
        Assert.Equal(aberto, ConfigConta.Montar("https://estudae.com.br", entrega, dev).CadastroAberto);

    [Fact]
    public void Barra_no_fim_da_url_e_removida() =>
        Assert.Equal("https://estudae.com.br", ConfigConta.Montar("https://estudae.com.br/", false, true).UrlPublica);
}

public class EmailsContaTests
{
    private const string Link = "https://estudae.com.br/confirmar-email?u=1&t=abc";

    [Fact]
    public void Confirmacao_tem_o_link_no_html_e_no_texto()
    {
        var m = EmailsConta.Confirmacao("Maria", "maria@gmail.com", Link);
        Assert.Equal("maria@gmail.com", m.Para);
        Assert.Equal("Confirme seu e-mail no Estudaê", m.Assunto);
        Assert.Contains(Link, m.Texto);
        Assert.Contains("Olá, Maria!", m.Texto);
        Assert.Contains("lang=\"pt-BR\"", m.Html);
    }

    [Fact]
    public void Nome_com_html_e_escapado_no_html()
    {
        // Quem se cadastrasse com este "nome" injetaria um link no e-mail.
        var m = EmailsConta.Confirmacao("<a href=\"https://golpe.com\">Clique</a>", "x@y.com", Link);
        Assert.DoesNotContain("<a href=\"https://golpe.com\"", m.Html);
        Assert.Contains("&lt;a href=", m.Html);
    }

    [Fact]
    public void Link_com_e_comercial_fica_valido_no_html()
    {
        var m = EmailsConta.Confirmacao("Maria", "x@y.com", Link);
        Assert.Contains("u=1&amp;t=abc", m.Html); // & escapado dentro do href
        Assert.Contains("u=1&t=abc", m.Texto); // texto puro fica como está
    }

    [Fact]
    public void Aviso_de_conta_existente_leva_para_entrar_e_para_esqueci()
    {
        var m = EmailsConta.ContaJaExiste("Maria", "x@y.com", "https://e.com/login", "https://e.com/esqueci-senha");
        Assert.Contains("https://e.com/login", m.Texto);
        Assert.Contains("https://e.com/esqueci-senha", m.Texto);
    }

    [Fact]
    public void Redefinicao_diz_quanto_tempo_o_link_vale() =>
        Assert.Contains("1 dia", EmailsConta.Redefinicao("Maria", "x@y.com", Link).Texto);
}
