namespace Estudae.Tests;

// Acesso aos arquivos de docs/conteudo/exemplos/ do repositório (dados inventados,
// só para testes e documentação), procurando a pasta a partir de onde o teste
// roda (bin/...), para funcionar local e no CI.
internal static class Exemplos
{
    private static readonly Lazy<string> Pasta = new(() =>
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
        {
            var candidata = Path.Combine(dir.FullName, "docs", "conteudo", "exemplos");
            if (Directory.Exists(candidata)) return candidata;
        }
        throw new DirectoryNotFoundException("Pasta docs/conteudo/exemplos não encontrada acima de " + AppContext.BaseDirectory);
    });

    public static string Ler(string nome) => File.ReadAllText(Path.Combine(Pasta.Value, nome));
}
