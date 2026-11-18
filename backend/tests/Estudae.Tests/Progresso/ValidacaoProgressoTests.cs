using Estudae.Api.Progresso;
using Estudae.Domain.Progresso;

namespace Estudae.Tests.Progresso;

// Unidade: o formato de uma sessão enviada pelo front, sem banco. O que depende
// do conteúdo (questão existe, é do tema...) está em Api/ProgressoApiTests.cs.
public class ValidacaoProgressoTests
{
    private static readonly DateTime Agora = new(2026, 11, 17, 15, 0, 0, DateTimeKind.Utc);
    private static readonly DateTimeOffset Inicio = new(Agora.AddHours(-1));

    private static SessaoRequest Licao(params RespostaSessaoRequest[] respostas) => new(
        Chave: "licao-1", Tipo: TipoSessao.Licao, Disciplina: "matematica", Tema: "equacoes", Treino: false,
        IniciadaEm: Inicio, ConcluidaEm: Inicio.AddMinutes(4), TempoLimiteSeg: null,
        Respostas: respostas.Length > 0 ? [.. respostas] : [new(1, "5")]);

    private static SessaoRequest Simulado() => Licao() with
    {
        Tipo = TipoSessao.Simulado, Tema = null, Treino = true, TempoLimiteSeg = 5400,
        Respostas = [new(1, "5"), new(2, null)],
    };

    private static string Erro(SessaoRequest r)
    {
        var (sessao, erro) = ValidacaoProgresso.Sessao(r, Agora);
        Assert.Null(sessao);
        return Assert.IsType<string>(erro);
    }

    private static SessaoValida Ok(SessaoRequest r)
    {
        var (sessao, erro) = ValidacaoProgresso.Sessao(r, Agora);
        Assert.Null(erro);
        return sessao!;
    }

    [Fact]
    public void Licao_valida_passa_com_os_campos_normalizados()
    {
        var s = Ok(Licao(new RespostaSessaoRequest(7, "  R$ 120,00 \r\n"), new(3, "5")) with
        {
            Disciplina = " matematica ", Tema = " equacoes ",
        });
        Assert.Equal("matematica", s.Disciplina);
        Assert.Equal("equacoes", s.Tema);
        Assert.Equal(new List<(int, string?)> { (7, "R$ 120,00"), (3, "5") }, s.Respostas);
        Assert.Equal(DateTimeKind.Utc, s.IniciadaEm.Kind);
    }

    [Fact]
    public void Simulado_valido_aceita_em_branco_treino_e_tempo_limite()
    {
        var s = Ok(Simulado());
        Assert.Null(s.Tema);
        Assert.True(s.Treino);
        Assert.Equal(5400, s.TempoLimiteSeg);
        Assert.Null(s.Respostas[1].Alternativa);
    }

    [Fact]
    public void Data_com_fuso_vira_utc()
    {
        var brasilia = new DateTimeOffset(2026, 11, 17, 11, 0, 0, TimeSpan.FromHours(-3));
        var s = Ok(Licao() with { IniciadaEm = brasilia, ConcluidaEm = brasilia.AddMinutes(1) });
        Assert.Equal(new DateTime(2026, 11, 17, 14, 0, 0, DateTimeKind.Utc), s.IniciadaEm);
        Assert.Equal(DateTimeKind.Utc, s.IniciadaEm.Kind);
    }

    [Fact]
    public void Corpo_vazio_e_recusado() =>
        Assert.Contains("corpo", ValidacaoProgresso.Sessao(null, Agora).Erro);

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("com espaço")]
    [InlineData("acentuação")]
    [InlineData("barra/no/meio")]
    public void Chave_fora_do_formato_e_recusada(string? chave) =>
        Assert.Contains("chave", Erro(Licao() with { Chave = chave }));

    [Theory]
    [InlineData("local:1731850000000")]
    [InlineData("3f2a9c1e-7b4d-4e8a-9f00-1c2d3e4f5a6b")]
    [InlineData("licao_matematica.2")]
    public void Chave_no_formato_passa(string chave) => Ok(Licao() with { Chave = chave });

    [Fact]
    public void Chave_de_64_passa_e_de_65_nao()
    {
        Assert.True(ValidacaoProgresso.ChaveValida(new string('a', 64)));
        Assert.False(ValidacaoProgresso.ChaveValida(new string('a', 65)));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("prova")]
    [InlineData("Licao")]
    public void Tipo_desconhecido_e_recusado(string? tipo) =>
        Assert.Contains("tipo", Erro(Licao() with { Tipo = tipo }));

    [Theory]
    [InlineData(null)]
    [InlineData("   ")]
    public void Disciplina_e_obrigatoria(string? disciplina) =>
        Assert.Contains("disciplina", Erro(Licao() with { Disciplina = disciplina }));

    [Fact]
    public void Licao_sem_tema_e_recusada() =>
        Assert.Contains("tema", Erro(Licao() with { Tema = "  " }));

    [Fact]
    public void Simulado_com_tema_e_recusado() =>
        Assert.Contains("tema", Erro(Simulado() with { Tema = "equacoes" }));

    [Fact]
    public void Treino_e_tempo_limite_so_valem_no_simulado()
    {
        Assert.Contains("treino", Erro(Licao() with { Treino = true }));
        Assert.Contains("tempoLimiteSeg", Erro(Licao() with { TempoLimiteSeg = 60 }));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(86401)]
    public void Tempo_limite_fora_do_intervalo_e_recusado(int segundos) =>
        Assert.Contains("tempoLimiteSeg", Erro(Simulado() with { TempoLimiteSeg = segundos }));

    [Fact]
    public void Datas_sao_obrigatorias()
    {
        Assert.Contains("iniciadaEm", Erro(Licao() with { IniciadaEm = null }));
        Assert.Contains("concluidaEm", Erro(Licao() with { ConcluidaEm = null }));
    }

    [Fact]
    public void Concluir_antes_de_comecar_e_recusado() =>
        Assert.Contains("antes", Erro(Licao() with { ConcluidaEm = Inicio.AddSeconds(-1) }));

    [Fact]
    public void Sessao_de_mais_de_24_horas_e_recusada() =>
        Assert.Contains("24 horas",
            Erro(Licao() with { IniciadaEm = Inicio.AddHours(-25), ConcluidaEm = Inicio }));

    [Fact]
    public void Relogio_um_pouco_adiantado_passa_e_data_no_futuro_nao()
    {
        var adiantado = new DateTimeOffset(Agora.AddMinutes(9));
        Ok(Licao() with { IniciadaEm = adiantado, ConcluidaEm = adiantado });

        var futuro = new DateTimeOffset(Agora.AddMinutes(11));
        Assert.Contains("futuro", Erro(Licao() with { IniciadaEm = futuro, ConcluidaEm = futuro }));
    }

    [Fact]
    public void Data_de_antes_do_estudae_existir_e_recusada()
    {
        var antiga = new DateTimeOffset(ValidacaoProgresso.DataMinima.AddSeconds(-1));
        Assert.Contains("antiga", Erro(Licao() with { IniciadaEm = antiga, ConcluidaEm = antiga }));
    }

    [Fact]
    public void Precisa_de_ao_menos_uma_resposta()
    {
        Assert.Contains("resposta", Erro(Licao() with { Respostas = null }));
        Assert.Contains("resposta", Erro(Licao() with { Respostas = [] }));
    }

    [Fact]
    public void Mais_respostas_que_o_maximo_e_recusado()
    {
        var muitas = Enumerable.Range(1, ValidacaoProgresso.MaxRespostas + 1).Select(i => new RespostaSessaoRequest(i, "x")).ToList();
        Assert.Contains("no máximo", Erro(Licao() with { Respostas = muitas }));
        Ok(Licao() with { Respostas = muitas[..ValidacaoProgresso.MaxRespostas] });
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-5)]
    public void Questao_sem_id_valido_e_recusada(int id) =>
        Assert.Contains("questaoId", Erro(Licao(new RespostaSessaoRequest(id, "5"))));

    [Fact]
    public void Questao_repetida_na_sessao_e_recusada() =>
        Assert.Contains("duas vezes", Erro(Licao(new RespostaSessaoRequest(4, "5"), new(4, "3"))));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Na_licao_nao_existe_questao_em_branco(string? alternativa) =>
        Assert.Contains("falta a alternativa", Erro(Licao(new RespostaSessaoRequest(9, alternativa))));

    [Fact]
    public void No_simulado_so_espacos_conta_como_em_branco() =>
        Assert.Null(Ok(Simulado() with { Respostas = [new(1, "   ")] }).Respostas[0].Alternativa);

    [Fact]
    public void Data_avulsa_de_aula_usa_as_mesmas_regras()
    {
        Assert.Null(ValidacaoProgresso.Data(Agora, Agora, "assistidaEm"));
        Assert.Contains("assistidaEm", ValidacaoProgresso.Data(Agora.AddDays(1), Agora, "assistidaEm"));
        Assert.Contains("antiga", ValidacaoProgresso.Data(ValidacaoProgresso.DataMinima.AddDays(-1), Agora, "assistidaEm"));
    }
}
