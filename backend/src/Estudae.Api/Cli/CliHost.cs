using Estudae.Infra;

namespace Estudae.Api.Cli;

// Monta só os serviços de que os subcomandos precisam (DbContext e importadores),
// sem subir o servidor web. Exige a connection string, como a API.
public static class CliHost
{
    public static WebApplication Criar()
    {
        var builder = WebApplication.CreateBuilder();
        // Sem o SQL de cada comando na tela. Regra por provedor (Console) porque ela
        // tem precedência sobre o "Logging:LogLevel" do appsettings.
        builder.Logging.AddFilter<Microsoft.Extensions.Logging.Console.ConsoleLoggerProvider>(null, LogLevel.Warning);
        builder.Services.AddInfra(builder.Configuration);
        return builder.Build();
    }
}
