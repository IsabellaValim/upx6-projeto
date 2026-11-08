using Estudae.Infra;
using Estudae.Infra.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Estudae.Api.Cli;

// Subcomando "migrar": aplica as migrations pendentes e sai.
//   docker compose: serviço "migrate" (command: ["migrar"]), que roda uma vez
//   antes da API subir (depends_on: service_completed_successfully).
//
// Fica na mesma imagem da API (como o "importar") em vez de um efbundle: não
// precisa do dotnet-ef no build nem de uma segunda saída no Dockerfile.
// O EF 10 trava a tabela de histórico durante o Migrate, então duas execuções
// ao mesmo tempo não aplicam a mesma migration duas vezes.
public static class MigrarComando
{
    public const string Nome = "migrar";

    public static async Task<int> ExecutarAsync()
    {
        var builder = WebApplication.CreateBuilder();
        builder.Logging.AddFilter<Microsoft.Extensions.Logging.Console.ConsoleLoggerProvider>(null, LogLevel.Warning);
        builder.Services.AddInfra(builder.Configuration);
        await using var app = builder.Build();
        await using var scope = app.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<EstudaeDbContext>();

        var pendentes = (await db.Database.GetPendingMigrationsAsync()).ToList();
        if (pendentes.Count == 0)
        {
            Console.WriteLine("Banco já está atualizado; nenhuma migration pendente.");
            return 0;
        }

        Console.WriteLine($"Aplicando {pendentes.Count} migration(s): {string.Join(", ", pendentes)}");
        await db.Database.MigrateAsync();
        Console.WriteLine("Migrations aplicadas.");
        return 0;
    }
}
