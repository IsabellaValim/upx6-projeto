using Estudae.Infra.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace Estudae.Tests.Conta;

// A política de senha é aplicada pelo PasswordValidator do Identity, lendo as
// opções da PoliticaConta. Aqui rodamos o validador de verdade, sem banco.
public class PoliticaContaTests
{
    private static readonly IdentityOptions Opcoes = Montar();

    private static IdentityOptions Montar()
    {
        var o = new IdentityOptions();
        PoliticaConta.Aplicar(o);
        return o;
    }

    private static async Task<IdentityResult> Validar(string senha)
    {
        var erros = new ErrosIdentityPtBr();
        using var usuarios = new UserManager<Usuario>(
            new StoreSemBanco(), Options.Create(Opcoes), new PasswordHasher<Usuario>(),
            [], [new PasswordValidator<Usuario>(erros)],
            new UpperInvariantLookupNormalizer(), erros, null!, NullLogger<UserManager<Usuario>>.Instance);
        return await usuarios.PasswordValidators.Single().ValidateAsync(usuarios, new Usuario(), senha);
    }

    [Theory]
    [InlineData("12345678")] // só números: aceito (sem regra de composição)
    [InlineData("abcdefgh")] // só minúsculas
    [InlineData("netos da vovó")] // frase com espaço e acento
    [InlineData("aaaaaaaa")] // RequiredUniqueChars = 1
    public async Task Senha_com_8_ou_mais_caracteres_passa(string senha) =>
        Assert.True((await Validar(senha)).Succeeded);

    [Fact]
    public async Task Senha_com_7_caracteres_falha_com_mensagem_em_portugues()
    {
        var r = await Validar("1234567");
        Assert.False(r.Succeeded);
        var erro = Assert.Single(r.Errors);
        Assert.Equal("A senha precisa ter pelo menos 8 caracteres.", erro.Description);
    }

    [Fact]
    public void Exige_email_unico_e_confirmado()
    {
        Assert.True(Opcoes.User.RequireUniqueEmail);
        Assert.True(Opcoes.SignIn.RequireConfirmedEmail);
        Assert.Equal(PoliticaConta.ProvedorConfirmacaoEmail, Opcoes.Tokens.EmailConfirmationTokenProvider);
    }

    [Fact]
    public void Bloqueia_por_5_minutos_depois_de_5_erros()
    {
        Assert.True(Opcoes.Lockout.AllowedForNewUsers);
        Assert.Equal(5, Opcoes.Lockout.MaxFailedAccessAttempts);
        Assert.Equal(TimeSpan.FromMinutes(5), Opcoes.Lockout.DefaultLockoutTimeSpan);
    }

    [Fact]
    public void Link_de_confirmacao_dura_mais_que_o_de_senha() =>
        Assert.True(PoliticaConta.ValidadeLinkConfirmacao > PoliticaConta.ValidadeLinkRedefinicao);

    // O UserManager exige um store, mas a validação de senha nunca o usa.
    private sealed class StoreSemBanco : IUserStore<Usuario>
    {
        private static Exception Nao() => new NotSupportedException("Teste sem banco.");
        public Task<IdentityResult> CreateAsync(Usuario u, CancellationToken ct) => throw Nao();
        public Task<IdentityResult> DeleteAsync(Usuario u, CancellationToken ct) => throw Nao();
        public Task<Usuario?> FindByIdAsync(string id, CancellationToken ct) => throw Nao();
        public Task<Usuario?> FindByNameAsync(string nome, CancellationToken ct) => throw Nao();
        public Task<string?> GetNormalizedUserNameAsync(Usuario u, CancellationToken ct) => throw Nao();
        public Task<string> GetUserIdAsync(Usuario u, CancellationToken ct) => throw Nao();
        public Task<string?> GetUserNameAsync(Usuario u, CancellationToken ct) => throw Nao();
        public Task SetNormalizedUserNameAsync(Usuario u, string? n, CancellationToken ct) => throw Nao();
        public Task SetUserNameAsync(Usuario u, string? n, CancellationToken ct) => throw Nao();
        public Task<IdentityResult> UpdateAsync(Usuario u, CancellationToken ct) => throw Nao();
        public void Dispose() { }
    }
}
