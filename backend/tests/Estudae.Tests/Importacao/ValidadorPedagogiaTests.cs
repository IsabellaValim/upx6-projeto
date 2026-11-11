using System.Text.Json.Nodes;
using Estudae.Infra.Importacao;

namespace Estudae.Tests.Importacao;

// Cada teste parte do exemplo de pedagogia válido, muda UM campo e confere que
// aparece O erro esperado (mesmo padrão do ValidadorConteudoTests).
public class ValidadorPedagogiaTests
{
    private static List<ErroImportacao> Validar(string json)
    {
        var (arquivo, erro) = LeitorPedagogia.Ler(json);
        return erro is not null ? [erro] : ValidadorPedagogia.Validar(arquivo!);
    }

    private static List<ErroImportacao> ValidarComRaiz(Action<JsonObject> mudar)
    {
        var raiz = JsonNode.Parse(Exemplos.LerPedagogia())!.AsObject();
        mudar(raiz);
        return Validar(raiz.ToJsonString());
    }

    private static JsonObject PrimeiraQuestao(JsonObject raiz) =>
        raiz["temas"]![0]!["questoes"]![0]!.AsObject();

    [Fact]
    public void Exemplo_valido_nao_tem_erros()
    {
        Assert.Empty(Validar(Exemplos.LerPedagogia()));
        Assert.Empty(Validar(Exemplos.Ler("exemplo-pedagogia.json")));
        var raiz = JsonNode.Parse(Exemplos.Ler("exemplo-pedagogia.json"))!.AsObject();
        Assert.Equal("pendente", PrimeiraQuestao(raiz)["revisao"]!.GetValue<string>());
        Assert.False(PrimeiraQuestao(raiz)["elegivel"]!.GetValue<bool>());
    }

    [Fact]
    public void Aprovacao_exige_impressao_esperada()
    {
        var erros = ValidarComRaiz(r => PrimeiraQuestao(r).Remove("impressao"));
        Assert.Equal("impressao", Assert.Single(erros).Campo);
    }

    [Fact]
    public void Impressao_nao_confunde_separadores_com_limites_de_campos()
    {
        static string Hash(string? texto, string enunciado, string[] alternativas) =>
            Estudae.Domain.Conteudo.ImpressaoConteudo.Calcular(
                "mat", "tema", texto, enunciado, alternativas, "a", "r", null, null, null);
        Assert.NotEqual(Hash("a\u001fb", "c", ["a"]), Hash("a", "b\u001fc", ["a"]));
        Assert.NotEqual(Hash(null, "c", ["a\u001eb", "c"]), Hash(null, "c", ["a", "b\u001ec"]));
        Assert.NotEqual(Hash(null, "c", ["a"]), Hash("", "c", ["a"]));
    }

    [Fact]
    public void Formato_errado_ou_ausente_e_erro()
    {
        var erros = ValidarComRaiz(r => r["formato"] = 2);
        Assert.Contains(erros, e => e.Campo == "formato");
    }

    [Fact]
    public void Campo_desconhecido_e_erro_de_leitura()
    {
        var erros = ValidarComRaiz(r => r["habilidadez"] = "x");
        Assert.Single(erros);
        Assert.Contains("campo desconhecido", erros[0].Mensagem);
    }

    [Fact]
    public void Aprovacao_sem_revisor_e_erro()
    {
        var erros = ValidarComRaiz(r => r.Remove("revisor"));
        var erro = Assert.Single(erros);
        Assert.Equal("revisor", erro.Campo);
    }

    [Fact]
    public void Sem_aprovacao_revisor_pode_faltar()
    {
        var erros = ValidarComRaiz(r =>
        {
            r.Remove("revisor");
            PrimeiraQuestao(r)["revisao"] = "pendente";
        });
        Assert.Empty(erros);
    }

    [Fact]
    public void Dificuldade_fora_da_lista_e_erro()
    {
        var erros = ValidarComRaiz(r => PrimeiraQuestao(r)["dificuldade"] = "dificil");
        var erro = Assert.Single(erros);
        Assert.Equal("dificuldade", erro.Campo);
    }

    [Fact]
    public void Revisao_fora_da_lista_e_erro()
    {
        var erros = ValidarComRaiz(r => PrimeiraQuestao(r)["revisao"] = "ok");
        var erro = Assert.Single(erros);
        Assert.Equal("revisao", erro.Campo);
    }

    [Fact]
    public void Principal_repetida_como_secundaria_e_erro()
    {
        var erros = ValidarComRaiz(r =>
            PrimeiraQuestao(r)["secundarias"] = new JsonArray("porcentagem-de-quantidades"));
        var erro = Assert.Single(erros);
        Assert.Equal("secundarias", erro.Campo);
    }

    [Fact]
    public void Codigo_repetido_no_arquivo_e_erro()
    {
        var erros = ValidarComRaiz(r =>
            PrimeiraQuestao(r)["codigo"] = "exemplo-mat-equacoes-001");
        var erro = Assert.Single(erros);
        Assert.Equal("codigo", erro.Campo);
    }

    [Fact]
    public void Impressao_com_formato_errado_e_erro()
    {
        var erros = ValidarComRaiz(r => PrimeiraQuestao(r)["impressao"] = "abc123");
        var erro = Assert.Single(erros);
        Assert.Equal("impressao", erro.Campo);
    }

    [Fact]
    public void Habilidade_slug_invalido_e_erro()
    {
        var erros = ValidarComRaiz(r =>
            r["temas"]![0]!["habilidades"]![0]!["slug"] = "Porcentagem Ruim!");
        Assert.Contains(erros, e => e.Campo == "slug");
    }
}
