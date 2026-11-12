using Estudae.Api.Conta;
using Estudae.Infra.Identity;

namespace Estudae.Tests.Conta;

public class ValidacaoContaTests
{
    // ---- nome ----

    [Theory]
    [InlineData("Maria", "Maria")]
    [InlineData("  Maria   da\tSilva  ", "Maria da Silva")]
    [InlineData("José", "José")] // "e" + acento combinante vira "é" (NFC)
    public void Nome_e_aparado_e_normalizado(string bruto, string esperado)
    {
        var (nome, erro) = ValidacaoConta.Nome(bruto);
        Assert.Null(erro);
        Assert.Equal(esperado, nome);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Nome_vazio_e_erro(string? bruto)
    {
        var (nome, erro) = ValidacaoConta.Nome(bruto);
        Assert.Null(nome);
        Assert.Equal("Digite seu nome.", erro);
    }

    [Fact]
    public void Nome_acima_do_limite_e_erro()
    {
        Assert.Null(ValidacaoConta.Nome(new string('a', PoliticaConta.NomeMaximo)).Erro);
        Assert.NotNull(ValidacaoConta.Nome(new string('a', PoliticaConta.NomeMaximo + 1)).Erro);
    }

    // ---- e-mail ----

    [Theory]
    [InlineData("maria@gmail.com", "maria@gmail.com")]
    [InlineData("  Maria.Silva@Gmail.COM ", "maria.silva@gmail.com")]
    [InlineData("joao+estudo@uol.com.br", "joao+estudo@uol.com.br")]
    public void Email_valido_vira_minusculo_e_aparado(string bruto, string esperado)
    {
        var (email, erro) = ValidacaoConta.Email(bruto);
        Assert.Null(erro);
        Assert.Equal(esperado, email);
    }

    [Theory]
    [InlineData("maria")]
    [InlineData("maria@")]
    [InlineData("@gmail.com")]
    [InlineData("maria@gmail")] // sem ponto no domínio: quase sempre erro de digitação
    [InlineData("maria@gmail.")]
    [InlineData("maria silva@gmail.com")]
    [InlineData("Maria <maria@gmail.com>")] // MailAddress aceitaria; aqui não
    [InlineData("maria@@gmail.com")]
    public void Email_invalido_e_erro(string bruto)
    {
        var (email, erro) = ValidacaoConta.Email(bruto);
        Assert.Null(email);
        Assert.Equal(ValidacaoConta.ErroEmail, erro);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("  ")]
    public void Email_vazio_pede_o_email(string? bruto) =>
        Assert.Equal("Digite seu e-mail.", ValidacaoConta.Email(bruto).Erro);

    // ---- senha ----

    [Fact]
    public void Senha_vazia_e_erro()
    {
        Assert.Equal("Digite uma senha.", ValidacaoConta.Senha(null));
        Assert.Equal("Digite uma senha.", ValidacaoConta.Senha(""));
    }

    [Fact]
    public void Senha_acima_do_teto_e_erro()
    {
        Assert.Null(ValidacaoConta.Senha(new string('x', PoliticaConta.SenhaMaximo)));
        Assert.NotNull(ValidacaoConta.Senha(new string('x', PoliticaConta.SenhaMaximo + 1)));
    }

    [Fact]
    public void Senha_nao_e_aparada_nem_alterada()
    {
        // Espaço faz parte da senha; o comprimento mínimo é do Identity (ver PoliticaContaTests).
        Assert.Null(ValidacaoConta.Senha("  frase com espaços  "));
    }
}
