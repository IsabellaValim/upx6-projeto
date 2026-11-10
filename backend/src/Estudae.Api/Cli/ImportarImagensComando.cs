using Estudae.Infra.Importacao;

namespace Estudae.Api.Cli;

// Subcomando "importar-imagens": grava no banco todas as imagens de uma pasta
// (e subpastas), mesmo as que nenhuma questão usa ainda.
//   docker compose run --rm -v "$PWD/imagens:/imagens:ro" api importar-imagens /imagens
//
// O caminho no banco é o relativo à pasta, com "/": /imagens/2022/x.webp vira
// "2022/x.webp", o mesmo texto que o JSON das questões põe em imagem.arquivo.
// Tudo numa transação: um arquivo inválido aborta todos.
//
// Saída: 0 = ok, 1 = arquivo inválido (nada foi gravado), 2 = uso errado.
public static class ImportarImagensComando
{
    public const string Nome = "importar-imagens";

    public static async Task<int> ExecutarAsync(string[] args)
    {
        if (args.Length != 1 || !Directory.Exists(args[0]))
        {
            Console.Error.WriteLine("Uso: importar-imagens <pasta>  (a pasta precisa existir)");
            return 2;
        }

        var raiz = Path.GetFullPath(args[0]);
        var arquivos = Directory.EnumerateFiles(raiz, "*", SearchOption.AllDirectories)
            .Where(f => GravadorImagens.TipoMime(f) is not null)
            .Order(StringComparer.Ordinal)
            .ToList();

        var erros = new List<string>();
        var imagens = new List<(string, byte[])>();
        foreach (var f in arquivos)
        {
            var rel = Path.GetRelativePath(raiz, f).Replace('\\', '/');
            var tamanho = new FileInfo(f).Length;
            if (!ValidadorConteudo.CaminhoDeImagemValido(rel))
                erros.Add($"{rel}: nome inválido (só letras, números, \"_\", \"-\", \"/\"; .webp, .png ou .jpg)");
            else if (tamanho == 0 || tamanho > GravadorImagens.TamanhoMaximo)
                erros.Add($"{rel}: tamanho inválido ({tamanho} bytes; máximo {GravadorImagens.TamanhoMaximo})");
            else
                imagens.Add((rel, await File.ReadAllBytesAsync(f)));
        }

        if (erros.Count > 0)
        {
            Console.Error.WriteLine($"{raiz}: {erros.Count} erro(s). NADA foi gravado.");
            foreach (var e in erros) Console.Error.WriteLine($"  - {e}");
            return 1;
        }
        if (imagens.Count == 0)
        {
            Console.Error.WriteLine($"{raiz}: nenhuma imagem .webp, .png ou .jpg.");
            return 1;
        }

        await using var app = CliHost.Criar();
        await using var scope = app.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<Estudae.Infra.Persistence.EstudaeDbContext>();
        var resumo = new ResumoImagens();
        await scope.ServiceProvider.GetRequiredService<GravadorImagens>().GravarAsync(imagens, resumo);
        await db.SaveChangesAsync();

        Console.WriteLine($"{raiz}: {imagens.Count} imagem(ns). " +
                          $"{resumo.Criadas} nova(s), {resumo.Atualizadas} atualizada(s), {resumo.Iguais} sem mudança.");
        return 0;
    }
}
