using Estudae.Infra;
using Estudae.Infra.Identity;
using Estudae.Infra.Persistence;
using Microsoft.AspNetCore.Identity;

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
