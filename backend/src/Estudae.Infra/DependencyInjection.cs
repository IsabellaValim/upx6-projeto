using Estudae.Infra.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Estudae.Infra;

public static class DependencyInjection
{
    // Registra a persistência. Assim a Api não precisa saber que existe Npgsql
    // nem convenção de nomes.
    public static IServiceCollection AddInfra(this IServiceCollection services, IConfiguration config)
    {
        // Sem fallback de propósito: nenhum arquivo versionado tem a connection string.
        // Em desenvolvimento ela vem dos user-secrets; em container, da variável
        // de ambiente ConnectionStrings__Estudae.
        var connectionString = config.GetConnectionString("Estudae")
            ?? throw new InvalidOperationException(
                "Connection string 'Estudae' não configurada. Em desenvolvimento, rode na pasta backend/: " +
                "dotnet user-secrets set ConnectionStrings:Estudae \"Host=localhost;Port=<DB_PORT>;" +
                "Database=estudae;Username=estudae;Password=<senha>\" --project src/Estudae.Api");

        services.AddDbContext<EstudaeDbContext>(options => options
            .UseNpgsql(connectionString)
            .UseSnakeCaseNamingConvention());

        return services;
    }
}
