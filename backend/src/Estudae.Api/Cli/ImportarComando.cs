using Estudae.Infra.Importacao;

namespace Estudae.Api.Cli;

// Subcomando "importar" da própria API. Vive aqui para já ir junto na imagem:
//   dotnet run --project src/Estudae.Api -- importar /caminho/matematica.json [--publicar]
//   docker compose run --rm -v "$PWD/novo:/novo:ro" api importar /novo/matematica.json --publicar
//
//   --publicar  grava as questões como "publicada" (sem a flag: "rascunho")
//   --validar   só valida o arquivo; não conecta no banco
//
// O conteúdo mora no banco, não no repositório: o JSON é só o meio de entrada.
// Imagens: se o arquivo estiver em imagens/ ao lado do JSON, vai para a tabela
// imagem na mesma transação das questões; se não estiver, precisa já estar no banco.
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

        // Imagens citadas: separa as que estão na pasta imagens/ ao lado do JSON.
        var pasta = Path.Combine(Path.GetDirectoryName(Path.GetFullPath(caminho))!, "imagens");
        var citadas = arquivo!.Temas!.SelectMany(t => t.Questoes ?? [])
            .Select(q => q.Imagem?.Arquivo).OfType<string>().Distinct().ToList();
        var naPasta = citadas.Where(a => File.Exists(Path.Combine(pasta, a))).ToList();
        var foraDaPasta = citadas.Except(naPasta).ToList();

        var nQuestoes = arquivo.Temas!.Sum(t => t.Questoes?.Count ?? 0);
        var nVideos = arquivo.Temas!.Sum(t => t.Videos?.Count ?? 0);
        Console.WriteLine($"{caminho}: válido. Disciplina \"{arquivo.Disciplina!.Slug}\", " +
                          $"{arquivo.Temas!.Count} tema(s), {nVideos} vídeo(s), {nQuestoes} questão(ões), " +
                          $"{citadas.Count} imagem(ns) ({naPasta.Count} na pasta imagens/).");
        if (soValidar)
        {
            if (foraDaPasta.Count > 0)
                Console.WriteLine($"  AVISO: {foraDaPasta.Count} imagem(ns) fora de {pasta}; na importação, precisam já estar no banco.");
            return 0;
        }

        await using var app = CliHost.Criar();
        await using var scope = app.Services.CreateAsyncScope();
        var gravador = scope.ServiceProvider.GetRequiredService<GravadorImagens>();

        var faltando = await gravador.FaltandoAsync(foraDaPasta);
        if (faltando.Count > 0)
        {
            Console.Error.WriteLine($"{caminho}: {faltando.Count} imagem(ns) nem em {pasta} nem no banco. NADA foi gravado.");
            foreach (var f in faltando) Console.Error.WriteLine($"  - {f}");
            return 1;
        }

        var resumoImagens = new ResumoImagens();
        var bytes = new List<(string, byte[])>();
        foreach (var a in naPasta) bytes.Add((a, await File.ReadAllBytesAsync(Path.Combine(pasta, a))));
        await gravador.GravarAsync(bytes, resumoImagens);

        // O SaveChanges do importador grava questões e imagens numa transação só.
        var r = await scope.ServiceProvider.GetRequiredService<ImportadorConteudo>().ImportarAsync(arquivo, publicar);

        Console.WriteLine($"Gravado como {(publicar ? "PUBLICADA" : "RASCUNHO")}:");
        Console.WriteLine($"  disciplina criada: {r.DisciplinasCriadas}");
        Console.WriteLine($"  temas:    {r.TemasCriados} novo(s), {r.TemasAtualizados} atualizado(s)");
        Console.WriteLine($"  vídeos:   {r.VideosCriados} novo(s), {r.VideosAtualizados} atualizado(s)");
        Console.WriteLine($"  questões: {r.QuestoesCriadas} nova(s), {r.QuestoesAtualizadas} atualizada(s)");
        Console.WriteLine($"  imagens:  {resumoImagens.Criadas} nova(s), {resumoImagens.Atualizadas} atualizada(s), {resumoImagens.Iguais} sem mudança");
        foreach (var aviso in r.Avisos) Console.WriteLine($"  AVISO: {aviso}");
        return 0;
    }
}
