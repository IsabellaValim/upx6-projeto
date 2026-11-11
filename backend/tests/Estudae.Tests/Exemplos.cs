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

    public static string LerPedagogia()
    {
        var raiz = System.Text.Json.Nodes.JsonNode.Parse(Ler("exemplo-pedagogia.json"))!;
        var (conteudo, _) = Estudae.Infra.Importacao.LeitorConteudo.Ler(Ler("exemplo-valido.json"));
        raiz["temas"]![0]!["questoes"]![0]!["revisao"] = "aprovada";
        raiz["temas"]![0]!["questoes"]![0]!["elegivel"] = true;
        var tema = conteudo!.Temas![0];
        var q = tema.Questoes![0];
        raiz["temas"]![0]!["questoes"]![0]!["impressao"] =
            Estudae.Domain.Conteudo.ImpressaoConteudo.Calcular(
                conteudo.Disciplina!.Slug!, tema.Slug!, q.TextoBase, q.Enunciado!,
                q.Alternativas!.Select(a => a!).ToList(), q.RespostaCorreta!, q.Resolucao!, null, null, null);
        return raiz.ToJsonString();
    }
}
