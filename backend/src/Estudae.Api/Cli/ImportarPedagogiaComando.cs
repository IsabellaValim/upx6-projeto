using Estudae.Infra.Importacao;

namespace Estudae.Api.Cli;

// Subcomando "importar-pedagogia": aplica o arquivo de curadoria (habilidades,
// famílias, dificuldade, revisão) SEM tocar no conteúdo oficial das questões.
//   dotnet run --project src/Estudae.Api -- importar-pedagogia /caminho/pedagogia.json --aplicar
//   docker compose run --rm -v "$PWD/novo:/novo:ro" api importar-pedagogia /novo/pedagogia.json --aplicar
//
//   --validar  confere o arquivo e TODAS as referências no banco, sem gravar
//   --aplicar  confere e grava numa transação só (arquivo aprovado pelo revisor)
//
// Sem flag: só validação de formato, sem conectar no banco.
// Saída: 0 = ok, 1 = erros (nada foi gravado), 2 = uso errado.
public static class ImportarPedagogiaComando
{
    public const string Nome = "importar-pedagogia";

    private const string Uso =
        "Uso: importar-pedagogia <arquivo.json> [--validar] [--aplicar]\n" +
        "  --validar  confere o arquivo e as referências no banco, sem gravar\n" +
        "  --aplicar  confere e grava (transação única; só para arquivo aprovado)";

    public static async Task<int> ExecutarAsync(string[] args)
    {
        var flags = args.Where(a => a.StartsWith("--")).ToHashSet();
        var arquivos = args.Where(a => !a.StartsWith("--")).ToList();
        var desconhecidas = flags.Except(["--validar", "--aplicar"]).ToList();

        if (arquivos.Count != 1 || desconhecidas.Count > 0 || (flags.Contains("--validar") && flags.Contains("--aplicar")))
        {
            if (desconhecidas.Count > 0) Console.Error.WriteLine($"Opção desconhecida: {string.Join(", ", desconhecidas)}");
            Console.Error.WriteLine(Uso);
            return 2;
        }

        var caminho = arquivos[0];
        var soValidar = flags.Contains("--validar");
        var aplicar = flags.Contains("--aplicar");

        if (!File.Exists(caminho))
        {
            Console.Error.WriteLine($"Arquivo não encontrado: {Path.GetFullPath(caminho)}");
            return 2;
        }

        var (arquivo, erroLeitura) = LeitorPedagogia.Ler(await File.ReadAllTextAsync(caminho));
        var erros = erroLeitura is not null ? [erroLeitura] : ValidadorPedagogia.Validar(arquivo!);

        if (erros.Count > 0)
        {
            Console.Error.WriteLine($"{caminho}: {erros.Count} erro(s). NADA foi gravado.");
            foreach (var e in erros) Console.Error.WriteLine($"  - {e}");
            return 1;
        }

        Console.WriteLine($"{caminho}: formato válido. Disciplina \"{arquivo!.Disciplina}\".");
        if (!soValidar && !aplicar)
        {
            Console.WriteLine("Sem --validar nem --aplicar: apenas o formato foi conferido (sem conectar no banco).");
            return 0;
        }

        await using var app = CliHost.Criar();
        await using var scope = app.Services.CreateAsyncScope();
        var importador = scope.ServiceProvider.GetRequiredService<ImportadorPedagogia>();

        if (soValidar)
        {
            var errosBanco = await importador.ValidarAsync(arquivo);
            if (errosBanco.Count > 0)
            {
                Console.Error.WriteLine($"{caminho}: {errosBanco.Count} erro(s) de referência. NADA foi gravado.");
                foreach (var e in errosBanco) Console.Error.WriteLine($"  - {e}");
                return 1;
            }
            Console.WriteLine("Todas as referências conferem com o banco. Pronto para --aplicar.");
            return 0;
        }

        try
        {
            var r = await importador.AplicarAsync(arquivo);
            Console.WriteLine("Curadoria pedagógica aplicada:");
            Console.WriteLine($"  habilidades: {r.HabilidadesCriadas} nova(s), {r.HabilidadesAtualizadas} atualizada(s)");
            Console.WriteLine($"  metadados:   {r.MetadadosCriados} novo(s), {r.MetadadosAtualizados} atualizado(s)");
            Console.WriteLine($"  vínculos de vídeo: {r.VinculosVideo} novo(s)");
            if (r.MatrizAtualizada) Console.WriteLine("  matriz da disciplina: atualizada");
            foreach (var aviso in r.Avisos) Console.WriteLine($"  AVISO: {aviso}");
            return 0;
        }
        catch (InvalidOperationException ex)
        {
            Console.Error.WriteLine($"{caminho}: {ex.Message}");
            return 1;
        }
    }
}
