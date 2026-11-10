using Estudae.Domain.Conteudo;
using Estudae.Infra.Importacao;
using Estudae.Infra.Persistence;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace Estudae.Tests.Api;

// Sobe a API em memória (WebApplicationFactory) contra um banco DESCARTÁVEL,
// criado do zero pelas migrations e apagado no fim. Precisa de um Postgres:
//   - CI: service container do job, via ConnectionStrings__Estudae;
//   - local: o do docker compose, via os user-secrets da Api (os mesmos do dotnet run).
// Só o nome do banco é trocado, então os dados de desenvolvimento não são tocados.
public sealed class ApiFixture : IAsyncLifetime
{
    public const string CodigoRascunho = "teste-rascunho-001";

    public WebApplicationFactory<Program> Factory { get; private set; } = null!;
    public HttpClient Client { get; private set; } = null!;
    private string _conexao = null!;

    public async Task InitializeAsync()
    {
        var baseConexao = Environment.GetEnvironmentVariable("ConnectionStrings__Estudae")
            ?? new ConfigurationBuilder().AddUserSecrets<Program>(optional: true).Build().GetConnectionString("Estudae")
            ?? throw new InvalidOperationException(
                "Testes de integração precisam de um Postgres. Suba o banco (docker compose up -d --wait db) e " +
                "configure os user-secrets da Api, ou defina ConnectionStrings__Estudae.");

        _conexao = new NpgsqlConnectionStringBuilder(baseConexao)
        {
            Database = $"estudae_teste_{Guid.NewGuid():N}",
        }.ConnectionString;

        // Variável de ambiente vence os user-secrets na configuração da API, e é
        // lida já no WebApplication.CreateBuilder (antes do AddInfra).
        Environment.SetEnvironmentVariable("ConnectionStrings__Estudae", _conexao);

        await using (var db = NovoContexto())
            await db.Database.MigrateAsync(); // cria o banco vazio e aplica todas as migrations

        Factory = new WebApplicationFactory<Program>();
        Client = Factory.CreateClient();

        // Conteúdo: o exemplo da documentação, pelo próprio importador, publicado...
        await using var scope = Factory.Services.CreateAsyncScope();
        var (arquivo, erro) = LeitorConteudo.Ler(Exemplos.Ler("exemplo-valido.json"));
        Assert.Null(erro);
        await scope.ServiceProvider.GetRequiredService<ImportadorConteudo>().ImportarAsync(arquivo!, publicar: true);

        // ...mais uma questão em RASCUNHO, que nunca pode aparecer.
        var ctx = scope.ServiceProvider.GetRequiredService<EstudaeDbContext>();
        var equacoes = await ctx.Temas.SingleAsync(t => t.Slug == "equacoes");
        ctx.Questoes.Add(new Questao
        {
            Codigo = CodigoRascunho,
            Tema = equacoes,
            Enunciado = "RASCUNHO-NAO-PODE-APARECER",
            Alternativas = ["sim", "não"],
            RespostaCorreta = "sim",
            Resolucao = "RESOLUCAO-SECRETA",
            Status = StatusQuestao.Rascunho,
            CriadoEm = DateTime.UtcNow,
        });

        // ...e uma questão AUTORAL publicada (sem prova_*), numa disciplina à parte
        // para não mexer nas contagens dos testes de matemática.
        ctx.Questoes.Add(new Questao
        {
            Codigo = CodigoAutoral,
            Tema = new Tema
            {
                Slug = TemaAutoral, Titulo = "Tema autoral", Sobre = "Teste", Ordem = 1,
                Disciplina = new Disciplina { Slug = DisciplinaAutoral, Nome = "Teste autoral" },
            },
            Enunciado = "Quanto é 2 + 2?",
            Alternativas = ["3", "4"],
            RespostaCorreta = "4",
            Resolucao = "2 + 2 = 4.",
            ImagemUrl = "teste/figura.webp",
            ImagemDescricao = "Figura de teste.",
            Status = StatusQuestao.Publicada,
            CriadoEm = DateTime.UtcNow,
        });
        await ctx.SaveChangesAsync();
    }

    public const string CodigoAutoral = "teste-autoral-001";
    public const string DisciplinaAutoral = "teste-autoral";
    public const string TemaAutoral = "tema-autoral";

    public EstudaeDbContext NovoContexto() => new(
        new DbContextOptionsBuilder<EstudaeDbContext>()
            .UseNpgsql(_conexao)
            .UseSnakeCaseNamingConvention()
            .Options);

    public async Task DisposeAsync()
    {
        Client?.Dispose();
        if (Factory is not null) await Factory.DisposeAsync();
        NpgsqlConnection.ClearAllPools(); // conexões abertas impedem o DROP DATABASE
        await using var db = NovoContexto();
        await db.Database.EnsureDeletedAsync();
    }
}

[CollectionDefinition(Nome)]
public sealed class ApiCollection : ICollectionFixture<ApiFixture>
{
    public const string Nome = "api";
}
