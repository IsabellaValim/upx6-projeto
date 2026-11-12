using System.Net.Http.Headers;
using Estudae.Infra.Email;
using Estudae.Infra.Importacao;
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

        services.AddScoped<ImportadorConteudo>();
        services.AddScoped<GravadorImagens>();

        services.AddEmail(config);

        return services;
    }

    // Provedor de e-mail escolhido pela configuração (ver ConfigEmail).
    public static IServiceCollection AddEmail(this IServiceCollection services, IConfiguration config)
    {
        var email = ConfigEmail.Ler(config);
        services.AddSingleton(email);

        if (email.EntregaDeVerdade)
        {
            // AddHttpClient: o HttpClient vem de uma fábrica que reaproveita as
            // conexões (criar um "new HttpClient()" por envio esgota as portas).
            services.AddHttpClient<IEnviadorEmail, EnviadorEmailResend>(http =>
            {
                http.BaseAddress = new Uri("https://api.resend.com/");
                http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", email.ResendApiKey);
                http.Timeout = TimeSpan.FromSeconds(15);
            });
        }
        else
        {
            services.AddSingleton<IEnviadorEmail, EnviadorEmailLog>();
        }

        return services;
    }
}
