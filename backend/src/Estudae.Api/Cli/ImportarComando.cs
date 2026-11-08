using Estudae.Infra;
using Estudae.Infra.Importacao;

namespace Estudae.Api.Cli;

// Subcomando "importar" da própria API. Vive aqui para já ir junto na imagem:
//   dotnet run --project src/Estudae.Api -- importar ../conteudo/matematica.json [--publicar]
//   docker compose run --rm api importar /conteudo/matematica.json --publicar
//
//   --publicar  grava as questões como "publicada" (sem a flag: "rascunho")
//   --validar   só valida o arquivo; não conecta no banco
//
// Saída: 0 = ok, 1 = arquivo com erros (nada foi gravado), 2 = uso errado.
public static class ImportarComando
{
    public const string Nome = "importar";

    private const string Uso =
        "Uso: importar <arquivo.json> [--publicar] [--validar]\n" +
        "  --publicar  grava as questões como publicadas (sem a flag, como rascunho)\n" +
        "  --validar   só confere o arquivo, sem gravar nem conectar no banco";

    public static async Task<int> ExecutarAsync(string[] args)
    {
        var flags = args.Where(a => a.StartsWith("--")).ToHashSet();
        var arquivos = args.Where(a => !a.StartsWith("--")).ToList();
        var desconhecidas = flags.Except(["--publicar", "--validar"]).ToList();

        if (arquivos.Count != 1 || desconhecidas.Count > 0)
        {
            if (desconhecidas.Count > 0) Console.Error.WriteLine($"Opção desconhecida: {string.Join(", ", desconhecidas)}");
            Console.Error.WriteLine(Uso);
            return 2;
        }

        var caminho = arquivos[0];
        var publicar = flags.Contains("--publicar");
        var soValidar = flags.Contains("--validar");

        if (!File.Exists(caminho))
        {
            Console.Error.WriteLine($"Arquivo não encontrado: {Path.GetFullPath(caminho)}");
            return 2;
        }

        var (arquivo, erroLeitura) = LeitorConteudo.Ler(await File.ReadAllTextAsync(caminho));
        var erros = erroLeitura is not null ? [erroLeitura] : ValidadorConteudo.Validar(arquivo!);

        if (erros.Count > 0)
        {
            Console.Error.WriteLine($"{caminho}: {erros.Count} erro(s). NADA foi gravado.");
            foreach (var e in erros) Console.Error.WriteLine($"  - {e}");
            return 1;
        }

        var nQuestoes = arquivo!.Temas!.Sum(t => t.Questoes?.Count ?? 0);
        var nVideos = arquivo.Temas!.Sum(t => t.Videos?.Count ?? 0);
        Console.WriteLine($"{caminho}: válido. Disciplina \"{arquivo.Disciplina!.Slug}\", " +
                          $"{arquivo.Temas!.Count} tema(s), {nVideos} vídeo(s), {nQuestoes} questão(ões).");
        if (soValidar) return 0;

        // Só monta os serviços (e exige a connection string) se for gravar.
        var builder = WebApplication.CreateBuilder();
        // Sem o SQL de cada comando na tela. Regra por provedor (Console) porque ela
        // tem precedência sobre o "Logging:LogLevel" do appsettings.
        builder.Logging.AddFilter<Microsoft.Extensions.Logging.Console.ConsoleLoggerProvider>(null, LogLevel.Warning);
        builder.Services.AddInfra(builder.Configuration);
        await using var app = builder.Build();
        await using var scope = app.Services.CreateAsyncScope();

        var r = await scope.ServiceProvider.GetRequiredService<ImportadorConteudo>().ImportarAsync(arquivo, publicar);

        Console.WriteLine($"Gravado como {(publicar ? "PUBLICADA" : "RASCUNHO")}:");
        Console.WriteLine($"  disciplina criada: {r.DisciplinasCriadas}");
        Console.WriteLine($"  temas:    {r.TemasCriados} novo(s), {r.TemasAtualizados} atualizado(s)");
        Console.WriteLine($"  vídeos:   {r.VideosCriados} novo(s), {r.VideosAtualizados} atualizado(s)");
        Console.WriteLine($"  questões: {r.QuestoesCriadas} nova(s), {r.QuestoesAtualizadas} atualizada(s)");
        foreach (var aviso in r.Avisos) Console.WriteLine($"  AVISO: {aviso}");
        return 0;
    }
}
