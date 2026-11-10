using System.Text;
using System.Text.Json.Nodes;
using Estudae.Infra.Importacao;

namespace Estudae.Tests.Importacao;

// Cada teste parte do exemplo válido da documentação (docs/conteudo/exemplos/), muda
// UM campo e confere que aparece O erro esperado (questão + campo).
public class ValidadorConteudoTests
{
    private static string Exemplo(string nome) => Exemplos.Ler(nome);

    private static List<ErroImportacao> Validar(string json)
    {
        var (arquivo, erro) = LeitorConteudo.Ler(json);
        return erro is not null ? [erro] : ValidadorConteudo.Validar(arquivo!);
    }

    // Exemplo válido com a primeira questão alterada.
    private static List<ErroImportacao> ValidarComQuestao(Action<JsonObject> mudar)
    {
        var raiz = JsonNode.Parse(Exemplo("exemplo-valido.json"))!.AsObject();
        mudar(raiz["temas"]![0]!["questoes"]![0]!.AsObject());
        return Validar(raiz.ToJsonString());
    }

    private static void AssertUnicoErro(List<ErroImportacao> erros, string campo)
    {
        var erro = Assert.Single(erros);
        Assert.Equal(campo, erro.Campo);
        Assert.Contains("exemplo-mat-porcentagem-001", erro.Onde);
    }

    [Fact]
    public void Exemplo_valido_nao_tem_erros()
    {
        Assert.Empty(Validar(Exemplo("exemplo-valido.json")));
    }

    [Fact]
    public void Exemplo_invalido_aponta_cada_questao_e_campo()
    {
        var erros = Validar(Exemplo("exemplo-invalido.json")).Select(e => (e.Onde, e.Campo)).ToList();

        Assert.Contains(("disciplina", "slug"), erros);
        Assert.Contains(("tema \"porcentagem-e-proporcao\", vídeo nº 1", "youtube"), erros);
        Assert.Contains(("tema \"porcentagem-e-proporcao\", vídeo nº 3", "youtube"), erros);
        Assert.Contains(("questão \"exemplo-erro-resposta\"", "resposta_correta"), erros);
        Assert.Contains(("questão \"exemplo-erro-alternativas\"", "alternativas[1]"), erros);
        Assert.Contains(("questão \"exemplo-erro-alternativas\"", "alternativas[2]"), erros);
        Assert.Contains(("questão \"exemplo-erro-alternativas\"", "alternativas[3]"), erros);
        Assert.Contains(("questão \"exemplo-erro-latex\"", "enunciado"), erros);
        Assert.Contains(("questão \"exemplo-erro-fonte\"", "alternativas"), erros);
        Assert.Contains(("questão \"exemplo-erro-fonte\"", "prova_ano"), erros);
        Assert.Contains(("questão \"exemplo-erro-fonte\"", "prova_numero"), erros);
        Assert.Contains(("questão \"exemplo-erro-resposta\"", "codigo"), erros);
        Assert.Contains(("questão \"exemplo-erro-resposta\"", "resolucao"), erros);
        Assert.Equal(13, erros.Count);
    }

    [Fact]
    public void Campo_desconhecido_e_recusado_na_leitura()
    {
        var erro = Assert.Single(Validar(Exemplo("exemplo-campo-desconhecido.json")));
        Assert.Contains("resposta_corecta", erro.Campo);
        Assert.Contains("campo desconhecido", erro.Mensagem);
    }

    [Fact]
    public void Tipo_errado_vira_erro_com_caminho()
    {
        var erros = ValidarComQuestao(q => q["prova_ano"] = "2019");
        var erro = Assert.Single(erros);
        Assert.Contains("prova_ano", erro.Campo);
    }

    [Theory]
    [InlineData("enunciado")]
    [InlineData("resolucao")]
    [InlineData("resposta_correta")]
    [InlineData("prova_edicao")]
    [InlineData("prova_nivel")]
    [InlineData("prova_numero")]
    [InlineData("prova_ano")]
    public void Campo_obrigatorio_ausente(string campo)
    {
        AssertUnicoErro(ValidarComQuestao(q => q.Remove(campo)), campo);
    }

    private static readonly string[] CamposProva = ["prova_ano", "prova_edicao", "prova_nivel", "prova_numero"];

    [Fact]
    public void Questao_autoral_sem_nenhum_campo_de_prova_e_valida()
    {
        Assert.Empty(ValidarComQuestao(q => { foreach (var c in CamposProva) q.Remove(c); }));
    }

    [Fact]
    public void Origem_incompleta_aponta_cada_campo_que_falta()
    {
        // Só o ano: é tratada como questão do INEP, então os outros três faltam.
        var erros = ValidarComQuestao(q => { foreach (var c in CamposProva[1..]) q.Remove(c); });
        Assert.Equal(CamposProva[1..], erros.Select(e => e.Campo));
        Assert.All(erros, e => Assert.Contains("questão autoral", e.Mensagem));
    }

    [Fact]
    public void Imagem_valida_com_descricao()
    {
        Assert.Empty(ValidarComQuestao(q => q["imagem"] = new JsonObject
        {
            ["arquivo"] = "2022/2022_EM_regular_matematica_47.webp",
            ["descricao"] = "Mapa com um quadrado de 15 cm de lado e escala 1 : 300 000.",
        }));
    }

    [Fact]
    public void Imagem_sem_descricao_e_recusada()
    {
        AssertUnicoErro(ValidarComQuestao(q => q["imagem"] = new JsonObject { ["arquivo"] = "2022/x.webp" }), "imagem.descricao");
    }

    [Theory]
    [InlineData("../segredo.webp")]
    [InlineData("/2022/x.webp")]
    [InlineData("2022/x.svg")]
    [InlineData("2022/com espaço.webp")]
    public void Caminho_de_imagem_inseguro_ou_invalido(string arquivo)
    {
        AssertUnicoErro(ValidarComQuestao(q => q["imagem"] = new JsonObject { ["arquivo"] = arquivo, ["descricao"] = "Figura." }), "imagem.arquivo");
    }

    [Theory]
    [InlineData("medio", true)]
    [InlineData("fundamental", true)]
    [InlineData("superior", false)]
    public void Nivel_da_disciplina(string nivel, bool valido)
    {
        var raiz = JsonNode.Parse(Exemplo("exemplo-valido.json"))!.AsObject();
        raiz["disciplina"]!["nivel"] = nivel;
        var erros = Validar(raiz.ToJsonString());
        if (valido) Assert.Empty(erros);
        else Assert.Equal("nivel", Assert.Single(erros).Campo);
    }

    [Fact]
    public void Texto_so_com_espacos_conta_como_ausente()
    {
        AssertUnicoErro(ValidarComQuestao(q => q["resolucao"] = "   \n "), "resolucao");
    }

    [Fact]
    public void Resposta_correta_precisa_ser_igual_a_uma_alternativa()
    {
        AssertUnicoErro(ValidarComQuestao(q => q["resposta_correta"] = "R$ 120"), "resposta_correta");
    }

    [Fact]
    public void Espacos_nas_pontas_nao_atrapalham_a_resposta()
    {
        Assert.Empty(ValidarComQuestao(q => q["resposta_correta"] = "  R$ 120,00 "));
    }

    [Fact]
    public void Acento_em_forma_decomposta_e_normalizado()
    {
        // "é" como "e" + acento combinado (NFD) precisa casar com "é" (NFC).
        var nfc = "Você está à frente";
        var nfd = nfc.Normalize(NormalizationForm.FormD);
        Assert.NotEqual(nfc, nfd);

        Assert.Empty(ValidarComQuestao(q =>
        {
            q["alternativas"] = new JsonArray(nfc, "Outra");
            q["resposta_correta"] = nfd;
        }));
    }

    [Fact]
    public void Alternativas_repetidas_ignorando_maiusculas()
    {
        AssertUnicoErro(ValidarComQuestao(q =>
        {
            q["alternativas"] = new JsonArray("Sim", "SIM", "Não");
            q["resposta_correta"] = "Sim";
        }), "alternativas[1]");
    }

    [Theory]
    [InlineData(1)]
    [InlineData(6)]
    public void Quantidade_de_alternativas_fora_do_limite(int quantidade)
    {
        AssertUnicoErro(ValidarComQuestao(q =>
        {
            q["alternativas"] = new JsonArray(Enumerable.Range(1, quantidade).Select(i => (JsonNode)$"opção {i}").ToArray());
            q["resposta_correta"] = "opção 1";
        }), "alternativas");
    }

    [Theory]
    [InlineData("As alternativas A e B")]
    [InlineData("A, C")]
    [InlineData("B ou D")]
    [InlineData("Alternativa C")]
    [InlineData("Todas as anteriores")]
    [InlineData("nenhuma das alternativas anteriores")]
    [InlineData("Todas as alternativas acima")]
    public void Alternativa_que_cita_posicao(string alternativa)
    {
        var erros = ValidarComQuestao(q =>
        {
            q["alternativas"] = new JsonArray(alternativa, "Outra");
            q["resposta_correta"] = "Outra";
        });
        AssertUnicoErro(erros, "alternativas[0]");
    }

    [Theory]
    [InlineData("Ela comprou a casa e o carro")]
    [InlineData("Nos anos anteriores, a produção caiu")]
    [InlineData("Vitamina A e ferro")]
    [InlineData("Escreva a letra a com capricho")]
    public void Texto_comum_nao_e_confundido_com_posicao(string alternativa)
    {
        // As letras de alternativa só contam em maiúscula: "A e f" e "letra a" são texto comum.
        Assert.Empty(ValidarComQuestao(q =>
        {
            q["alternativas"] = new JsonArray(alternativa, "Outra");
            q["resposta_correta"] = "Outra";
        }));
    }

    [Theory]
    [InlineData("Custa R$ 10,00")]
    [InlineData("Custa US$ 5")]
    [InlineData("Fórmula \\( x^2 \\) certa")]
    public void Cifrao_de_dinheiro_e_permitido(string enunciado)
    {
        Assert.Empty(ValidarComQuestao(q => q["enunciado"] = enunciado));
    }

    [Theory]
    [InlineData("Quanto é $x^2$?")]
    [InlineData("$$ x = 2 $$")]
    public void Cifrao_como_delimitador_de_latex_e_recusado(string enunciado)
    {
        AssertUnicoErro(ValidarComQuestao(q => q["enunciado"] = enunciado), "enunciado");
    }

    [Theory]
    [InlineData(2001)]
    [InlineData(3000)]
    public void Ano_da_prova_fora_do_intervalo(int ano)
    {
        AssertUnicoErro(ValidarComQuestao(q => q["prova_ano"] = ano), "prova_ano");
    }

    [Theory]
    [InlineData("Mat-001")]
    [InlineData("mat 001")]
    [InlineData("mat--001")]
    [InlineData("questão-1")]
    public void Codigo_precisa_ser_slug(string codigo)
    {
        var erro = Assert.Single(ValidarComQuestao(q => q["codigo"] = codigo));
        Assert.Equal("codigo", erro.Campo);
    }

    [Fact]
    public void Codigo_repetido_entre_temas()
    {
        var raiz = JsonNode.Parse(Exemplo("exemplo-valido.json"))!.AsObject();
        raiz["temas"]![1]!["questoes"]![0]!["codigo"] = "exemplo-mat-porcentagem-001";
        var erro = Assert.Single(Validar(raiz.ToJsonString()));
        Assert.Equal("codigo", erro.Campo);
    }

    [Fact]
    public void Tema_com_slug_repetido()
    {
        var raiz = JsonNode.Parse(Exemplo("exemplo-valido.json"))!.AsObject();
        raiz["temas"]![1]!["slug"] = "porcentagem-e-proporcao";
        var erro = Assert.Single(Validar(raiz.ToJsonString()));
        Assert.Equal("slug", erro.Campo);
    }
}
