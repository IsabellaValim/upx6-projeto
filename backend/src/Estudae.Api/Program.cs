using Estudae.Api.Cli;
using Estudae.Infra;
using Estudae.Infra.Identity;
using Estudae.Infra.Persistence;
using Microsoft.AspNetCore.Identity;

// "dotnet Estudae.Api.dll importar ..." roda o importador de conteúdo e sai,
// sem subir o servidor web (ver Cli/ImportarComando.cs).
if (args is [ImportarComando.Nome, .. var argsImportar])
    return await ImportarComando.ExecutarAsync(argsImportar);

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddInfra(builder.Configuration);

// Identity com autenticação por cookie (HttpOnly por padrão). Endpoints de login e
// cadastro ficam para o ticket de autenticação.
builder.Services
    .AddIdentity<Usuario, IdentityRole>()
    .AddEntityFrameworkStores<EstudaeDbContext>();

// AddIdentity registra a autenticação, mas não a autorização (exigida por UseAuthorization).
builder.Services.AddAuthorization();

// /health também confere o banco: 200 "Healthy" com o Postgres de pé, 503
// "Unhealthy" sem ele. A resposta padrão não expõe detalhes internos.
builder.Services
    .AddHealthChecks()
    .AddDbContextCheck<EstudaeDbContext>();

var app = builder.Build();

app.UseAuthentication();
app.UseAuthorization();

app.MapHealthChecks("/health");

app.Run();
return 0;
