using System.Text.Json;
using Estudae.Domain.Conteudo;
using Estudae.Infra.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Estudae.Api.Cli;

// Subcomando "impressoes": exporta as impressões de conteúdo (SHA-256) das
// questões de uma disciplina, por codigo — o mesmo cálculo do importador de
// pedagogia. O revisor cola o hash no arquivo de curadoria ao aprovar a
// classificação: se o conteúdo mudar depois, o importador recusa a aprovação.
//   dotnet run --project src/Estudae.Api -- impressoes matematica > impressoes.json
public static class ImpressoesComando
{
    public const string Nome = "impressoes";

    public static async Task<int> ExecutarAsync(string[] args)
    {
        if (args is not [var slug])
        {
            Console.Error.WriteLine("Uso: impressoes <disciplina>");
            return 2;
        }

        await using var app = CliHost.Criar();
        await using var scope = app.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<EstudaeDbContext>();

        var disciplina = await db.Disciplinas
            .Include(d => d.Temas).ThenInclude(t => t.Questoes)
            .AsSplitQuery()
            .SingleOrDefaultAsync(d => d.Slug == slug);
        if (disciplina is null)
        {
            Console.Error.WriteLine($"Disciplina \"{slug}\" não existe no banco.");
            return 1;
        }

        var questoes = disciplina.Temas
            .SelectMany(t => t.Questoes.Select(q => (t, q)))
            .OrderBy(x => x.t.Slug).ThenBy(x => x.q.Codigo)
            .ToList();
        var caminhos = questoes.Select(x => x.q.ImagemUrl).OfType<string>().ToList();
        var shas = await db.Imagens
            .Where(i => caminhos.Contains(i.Caminho))
            .ToDictionaryAsync(i => i.Caminho, i => i.Sha256);

        var saida = questoes.Select(x => new
        {
            codigo = x.q.Codigo,
            tema = x.t.Slug,
            impressao = ImpressaoConteudo.Calcular(
                x.q, disciplina.Slug, x.t.Slug,
                x.q.ImagemUrl is null ? null : shas.GetValueOrDefault(x.q.ImagemUrl)),
        });
        Console.WriteLine(JsonSerializer.Serialize(
            saida, new JsonSerializerOptions { WriteIndented = true }));
        return 0;
    }
}
