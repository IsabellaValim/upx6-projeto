using Estudae.Api.Cli;
using Estudae.Api.Endpoints;
using Estudae.Infra;
using Estudae.Infra.Identity;
using Estudae.Infra.Persistence;
using Microsoft.AspNetCore.Identity;

// Subcomandos: rodam e saem, sem subir o servidor web (ver Cli/).
//   dotnet Estudae.Api.dll importar <arquivo.json> [--publicar] [--validar]
//   dotnet Estudae.Api.dll migrar
if (args is [ImportarComando.Nome, .. var argsImportar])
    return await ImportarComando.ExecutarAsync(argsImportar);
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

// Front (index.html + src/) servido do wwwroot: na imagem, o Dockerfile copia
// para lá os arquivos da raiz do repo. Mesma origem da API, então sem CORS.
// no-cache = o navegador revalida (ETag/304) a cada carga: sem bundler gerando
// nomes com hash, é o que garante que ninguém fica com o JS velho após um deploy.
app.UseDefaultFiles();
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = ctx => ctx.Context.Response.Headers.CacheControl = "no-cache",
});

// Imagens das questões (recortes da prova): servidas de conteudo/imagens/, a
// mesma pasta que o importador confere. Na imagem Docker é /app/conteudo/imagens;
// no dotnet run, a pasta conteudo/ da raiz do repo. A URL é a mesma do front
// servido por python -m http.server na raiz: /conteudo/imagens/<arquivo>.
var pastaImagens = new[]
{
    Path.Combine(app.Environment.ContentRootPath, "conteudo", "imagens"),
    Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, "..", "..", "..", "conteudo", "imagens")),
}.FirstOrDefault(Directory.Exists);
if (pastaImagens is not null)
{
    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(pastaImagens),
        RequestPath = "/conteudo/imagens",
        OnPrepareResponse = ctx => ctx.Context.Response.Headers.CacheControl = "no-cache",
    });
}

app.UseAuthentication();
app.UseAuthorization();

app.MapHealthChecks("/health");
app.MapConteudo();

app.Run();
return 0;

// Exposto para os testes de integração (WebApplicationFactory<Program>).
public partial class Program;
