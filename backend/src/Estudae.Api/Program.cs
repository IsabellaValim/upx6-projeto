using Estudae.Api.Cli;
using Estudae.Api.Endpoints;
using Estudae.Infra;
using Estudae.Infra.Identity;
using Estudae.Infra.Persistence;
using Microsoft.AspNetCore.Identity;

// Subcomandos: rodam e saem, sem subir o servidor web (ver Cli/).
//   dotnet Estudae.Api.dll importar <arquivo.json> [--publicar] [--validar]
//   dotnet Estudae.Api.dll importar-imagens <pasta>
//   dotnet Estudae.Api.dll importar-pedagogia <arquivo.json> [--validar] [--aplicar]
//   dotnet Estudae.Api.dll impressoes <disciplina>
//   dotnet Estudae.Api.dll migrar
if (args is [ImportarComando.Nome, .. var argsImportar])
    return await ImportarComando.ExecutarAsync(argsImportar);
if (args is [ImportarImagensComando.Nome, .. var argsImagens])
    return await ImportarImagensComando.ExecutarAsync(argsImagens);
if (args is [ImportarPedagogiaComando.Nome, .. var argsPedagogia])
    return await ImportarPedagogiaComando.ExecutarAsync(argsPedagogia);
if (args is [ImpressoesComando.Nome, .. var argsImpressoes])
    return await ImpressoesComando.ExecutarAsync(argsImpressoes);
if (args is [MigrarComando.Nome])
    return await MigrarComando.ExecutarAsync();

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

builder.Services.AddErrosPadronizados();

// Só em desenvolvimento: libera o front servido em outra porta do localhost
// (python -m http.server, npx serve). Em produção o front sai do wwwroot da
// própria API, mesma origem, e CORS não é necessário.
const string CorsDev = "front-local";
if (builder.Environment.IsDevelopment())
{
    builder.Services.AddCors(o => o.AddPolicy(CorsDev, p => p
        .SetIsOriginAllowed(origem => Uri.TryCreate(origem, UriKind.Absolute, out var u) && u.IsLoopback)
        .AllowAnyHeader()
        .AllowAnyMethod()));
}

var app = builder.Build();

app.UseErrosPadronizados();

if (app.Environment.IsDevelopment()) app.UseCors(CorsDev);

// Front (app React+Vite) servido do wwwroot: na imagem, o Dockerfile copia o
// frontend/dist para lá. Mesma origem da API, então sem CORS.
// /assets/* saem do build do Vite com hash no nome: cache longo e imutável.
// O resto (index.html, /branding/*) fica no-cache = revalida (ETag/304) a cada
// carga: ninguém fica com o shell velho após um deploy.
app.UseDefaultFiles();
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = ctx => ctx.Context.Response.Headers.CacheControl =
        ctx.Context.Request.Path.StartsWithSegments("/assets")
            ? "public, max-age=31536000, immutable"
            : "no-cache",
});

app.UseAuthentication();
app.UseAuthorization();

app.MapHealthChecks("/health");
app.MapConteudo();

// /api/* que não casou com endpoint nenhum: 404 de verdade — nunca o index.html
// do fallback de SPA. Endpoints exatos de /api ganham deste catch-all pela
// precedência de rotas (literal > parâmetro > catch-all).
app.Map("/api/{**_}", () => Results.NotFound());

// O front usa URLs limpas (React Router): qualquer caminho sem arquivo que não
// seja /api devolve o index.html (a restrição "nonfile" já vem no fallback) e
// o router do front decide a tela. no-cache como o resto do shell.
app.MapFallbackToFile("index.html", new StaticFileOptions
{
    OnPrepareResponse = ctx => ctx.Context.Response.Headers.CacheControl = "no-cache",
});

app.Run();
return 0;

// Exposto para os testes de integração (WebApplicationFactory<Program>).
public partial class Program;
