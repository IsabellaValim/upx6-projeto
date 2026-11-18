using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;

namespace Estudae.Tests.Api;

// API do progresso de ponta a ponta: conta de verdade (cookie), Postgres
// descartável e o conteúdo de exemplo do fixture (matemática: uma questão em
// "porcentagem-e-proporcao", uma em "equacoes" e um vídeo em cada tema).
[Collection(ApiCollection.Nome)]
public class ProgressoApiTests(ApiFixture f)
{
    private const string Senha = "netos da vovó";
    private const string Disciplina = "matematica";
    private const string TemaPorcentagem = "porcentagem-e-proporcao";
    private const string TemaEquacoes = "equacoes";

    private static readonly DateTimeOffset Inicio = DateTimeOffset.UtcNow.AddHours(-2);

    private HttpClient Navegador() =>
        f.Factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

    private static async Task<JsonElement> Json(HttpResponseMessage r) =>
        JsonDocument.Parse(await r.Content.ReadAsStringAsync()).RootElement;

    private static async Task<string> Erro(HttpResponseMessage r) => (await Json(r)).GetProperty("erro").GetString()!;

    // Conta criada, confirmada e logada no navegador devolvido.
    private async Task<(HttpClient Navegador, string Email)> Logado()
    {
        var c = Navegador();
        var email = $"progresso-{Guid.NewGuid():N}@exemplo.com.br";
        Assert.Equal(HttpStatusCode.Accepted,
            (await c.PostAsJsonAsync("/api/conta/cadastro", new { nome = "Maria", email, senha = Senha })).StatusCode);
        var (usuarioId, token) = f.Emails.UltimaConfirmacao(email);
        Assert.Equal(HttpStatusCode.OK,
            (await c.PostAsJsonAsync("/api/conta/confirmar-email", new { usuarioId, token })).StatusCode);
        return (c, email);
    }

    private async Task<int> Questao(string codigo)
    {
        await using var db = f.NovoContexto();
        return await db.Questoes.Where(q => q.Codigo == codigo).Select(q => q.Id).SingleAsync();
    }

    private Task<int> QuestaoPorcentagem() => Questao("exemplo-mat-porcentagem-001");
    private Task<int> QuestaoEquacoes() => Questao("exemplo-mat-equacoes-001");

    private async Task<int> Video(string tema)
    {
        await using var db = f.NovoContexto();
        return await db.Videoaulas.Where(v => v.Tema.Slug == tema).Select(v => v.Id).FirstAsync();
    }

    private static string NovaChave() => $"teste-{Guid.NewGuid():N}";

    private static object Licao(string chave, int questaoId, string alternativa, string tema = TemaPorcentagem) => new
    {
        chave,
        tipo = "licao",
        disciplina = Disciplina,
        tema,
        iniciadaEm = Inicio,
        concluidaEm = Inicio.AddMinutes(3),
        respostas = new[] { new { questaoId, alternativa } },
    };

    private static Task<HttpResponseMessage> Gravar(HttpClient c, object sessao) =>
        c.PostAsJsonAsync("/api/progresso/sessoes", sessao);

    // ---- login ----

    [Fact]
    public async Task Sem_login_tudo_da_401_em_json()
    {
        var c = Navegador();
        var pedidos = new[]
        {
            await c.GetAsync("/api/progresso"),
            await Gravar(c, Licao(NovaChave(), 1, "x")),
            await c.GetAsync("/api/progresso/sessoes/1"),
            await c.PutAsync("/api/progresso/aulas/1", null),
            await c.DeleteAsync("/api/progresso/aulas/1"),
            await c.PostAsJsonAsync("/api/progresso/importar", new { sessoes = Array.Empty<object>() }),
        };
        Assert.All(pedidos, r => Assert.Equal(HttpStatusCode.Unauthorized, r.StatusCode));
        Assert.All(pedidos, r => Assert.Equal("application/json", r.Content.Headers.ContentType?.MediaType));
    }

    [Fact]
    public async Task Conta_nova_comeca_sem_progresso()
    {
        var (c, _) = await Logado();
        var p = await Json(await c.GetAsync("/api/progresso"));
        Assert.Equal(0, p.GetProperty("sessoes").GetArrayLength());
        Assert.Equal(0, p.GetProperty("aulas").GetArrayLength());
    }

    // ---- sessões ----

    [Fact]
    public async Task Licao_gravada_tem_acerto_calculado_no_servidor_e_aparece_na_lista()
    {
        var (c, _) = await Logado();
        var q = await QuestaoPorcentagem();
        var chave = NovaChave();

        var r = await Gravar(c, Licao(chave, q, "  R$ 120,00 "));
        Assert.Equal(HttpStatusCode.Created, r.StatusCode);
        var criada = await Json(r);
        var id = criada.GetProperty("id").GetInt64();
        Assert.Equal($"/api/progresso/sessoes/{id}", r.Headers.Location?.OriginalString);
        Assert.Equal(1, criada.GetProperty("acertos").GetInt32());
        Assert.Equal(TemaPorcentagem, criada.GetProperty("tema").GetString());
        Assert.Equal(Disciplina, criada.GetProperty("disciplina").GetString());

        var lista = (await Json(await c.GetAsync("/api/progresso"))).GetProperty("sessoes");
        var s = Assert.Single(lista.EnumerateArray());
        Assert.Equal(id, s.GetProperty("id").GetInt64());
        Assert.Equal(chave, s.GetProperty("chave").GetString());
        Assert.Equal("licao", s.GetProperty("tipo").GetString());
        Assert.Equal(1, s.GetProperty("total").GetInt32());
        var t = Assert.Single(s.GetProperty("tentativas").EnumerateArray());
        Assert.Equal(q, t.GetProperty("questaoId").GetInt32());
        Assert.Equal(TemaPorcentagem, t.GetProperty("tema").GetString());
        Assert.True(t.GetProperty("acertou").GetBoolean());
        Assert.False(t.GetProperty("emBranco").GetBoolean());
    }

    [Fact]
    public async Task Detalhe_traz_enunciado_escolhida_gabarito_e_resolucao()
    {
        var (c, _) = await Logado();
        var q = await QuestaoPorcentagem();
        var id = (await Json(await Gravar(c, Licao(NovaChave(), q, "R$ 30,00")))).GetProperty("id").GetInt64();

        var r = await c.GetAsync($"/api/progresso/sessoes/{id}");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var d = await Json(r);
        Assert.Equal(0, d.GetProperty("acertos").GetInt32());
        var questao = Assert.Single(d.GetProperty("questoes").EnumerateArray());
        Assert.Equal(1, questao.GetProperty("ordem").GetInt32());
        Assert.Contains("desconto", questao.GetProperty("enunciado").GetString());
        Assert.Equal(4, questao.GetProperty("alternativas").GetArrayLength());
        Assert.Equal("R$ 30,00", questao.GetProperty("escolhida").GetString());
        Assert.Equal("R$ 120,00", questao.GetProperty("respostaCorreta").GetString());
        Assert.Contains("150", questao.GetProperty("resolucao").GetString());
        Assert.False(questao.GetProperty("acertou").GetBoolean());
    }

    [Fact]
    public async Task Simulado_com_questao_em_branco_conta_como_erro()
    {
        var (c, _) = await Logado();
        var (q1, q2) = (await QuestaoPorcentagem(), await QuestaoEquacoes());

        var r = await Gravar(c, new
        {
            chave = NovaChave(),
            tipo = "simulado",
            disciplina = Disciplina,
            treino = true,
            iniciadaEm = Inicio,
            concluidaEm = Inicio.AddMinutes(5),
            tempoLimiteSeg = 360,
            respostas = new object[] { new { questaoId = q2, alternativa = "5" }, new { questaoId = q1, alternativa = (string?)null } },
        });
        Assert.Equal(HttpStatusCode.Created, r.StatusCode);
        var s = await Json(r);
        Assert.Equal(JsonValueKind.Null, s.GetProperty("tema").ValueKind);
        Assert.True(s.GetProperty("treino").GetBoolean());
        Assert.Equal(360, s.GetProperty("tempoLimiteSeg").GetInt32());
        Assert.Equal(1, s.GetProperty("acertos").GetInt32());
        Assert.Equal(2, s.GetProperty("total").GetInt32());
        var t = s.GetProperty("tentativas").EnumerateArray().ToList();
        Assert.Equal([q2, q1], t.Select(x => x.GetProperty("questaoId").GetInt32()));
        Assert.Equal([TemaEquacoes, TemaPorcentagem], t.Select(x => x.GetProperty("tema").GetString()));
        Assert.True(t[1].GetProperty("emBranco").GetBoolean());
        Assert.False(t[1].GetProperty("acertou").GetBoolean());
    }

    [Fact]
    public async Task Reenviar_a_mesma_chave_nao_duplica()
    {
        var (c, email) = await Logado();
        var q = await QuestaoPorcentagem();
        var chave = NovaChave();

        var primeira = await Gravar(c, Licao(chave, q, "R$ 120,00"));
        // O reenvio vale o que já foi gravado, mesmo que o corpo venha diferente.
        var segunda = await Gravar(c, Licao(chave, q, "R$ 30,00"));

        Assert.Equal(HttpStatusCode.Created, primeira.StatusCode);
        Assert.Equal(HttpStatusCode.OK, segunda.StatusCode);
        var (a, b) = (await Json(primeira), await Json(segunda));
        Assert.Equal(a.GetProperty("id").GetInt64(), b.GetProperty("id").GetInt64());
        Assert.Equal(1, b.GetProperty("acertos").GetInt32());

        await using var db = f.NovoContexto();
        Assert.Equal(1, await db.SessoesEstudo.CountAsync(s => s.Chave == chave));
    }

    [Fact]
    public async Task Datas_com_fuso_sao_gravadas_em_utc()
    {
        var (c, _) = await Logado();
        var q = await QuestaoPorcentagem();
        // Uma hora atrás, no horário de Brasília (-03:00), sem frações de segundo.
        var agora = DateTimeOffset.UtcNow.AddHours(-1);
        var local = new DateTimeOffset(agora.Ticks - agora.Ticks % TimeSpan.TicksPerSecond, TimeSpan.Zero)
            .ToOffset(TimeSpan.FromHours(-3));

        var r = await Gravar(c, new
        {
            chave = NovaChave(), tipo = "licao", disciplina = Disciplina, tema = TemaPorcentagem,
            iniciadaEm = local, concluidaEm = local.AddMinutes(2),
            respostas = new[] { new { questaoId = q, alternativa = "R$ 120,00" } },
        });
        Assert.Equal(HttpStatusCode.Created, r.StatusCode);
        var inicio = (await Json(r)).GetProperty("iniciadaEm").GetDateTimeOffset();
        Assert.Equal(TimeSpan.Zero, inicio.Offset);
        Assert.Equal(local.UtcDateTime, inicio.UtcDateTime);
    }

    [Theory]
    [InlineData("disciplina-que-nao-existe", TemaPorcentagem, "não encontrada")]
    [InlineData(Disciplina, "tema-que-nao-existe", "não encontrado")]
    [InlineData(Disciplina, TemaEquacoes, "não é do tema")]
    public async Task Sessao_que_nao_combina_com_o_conteudo_da_400(string disciplina, string tema, string trecho)
    {
        var (c, _) = await Logado();
        var q = await QuestaoPorcentagem();
        var r = await Gravar(c, new
        {
            chave = NovaChave(), tipo = "licao", disciplina, tema,
            iniciadaEm = Inicio, concluidaEm = Inicio.AddMinutes(1),
            respostas = new[] { new { questaoId = q, alternativa = "R$ 120,00" } },
        });
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        Assert.Contains(trecho, await Erro(r));
    }

    [Fact]
    public async Task Alternativa_que_nao_existe_rascunho_e_questao_de_outra_disciplina_dao_400()
    {
        var (c, _) = await Logado();
        var q = await QuestaoPorcentagem();

        var alternativa = await Gravar(c, Licao(NovaChave(), q, "R$ 999,00"));
        Assert.Equal(HttpStatusCode.BadRequest, alternativa.StatusCode);
        Assert.Contains("não é uma das alternativas", await Erro(alternativa));

        var rascunho = await Gravar(c, Licao(NovaChave(), await Questao(ApiFixture.CodigoRascunho), "sim", TemaEquacoes));
        Assert.Equal(HttpStatusCode.BadRequest, rascunho.StatusCode);
        Assert.Contains("não encontrada", await Erro(rascunho));

        var outraDisciplina = await Gravar(c, new
        {
            chave = NovaChave(), tipo = "simulado", disciplina = Disciplina,
            iniciadaEm = Inicio, concluidaEm = Inicio.AddMinutes(1),
            respostas = new[] { new { questaoId = await Questao(ApiFixture.CodigoAutoral), alternativa = "4" } },
        });
        Assert.Equal(HttpStatusCode.BadRequest, outraDisciplina.StatusCode);
        Assert.Contains("não é da disciplina", await Erro(outraDisciplina));

        await using var db = f.NovoContexto();
        Assert.False(await db.SessoesEstudo.AnyAsync(s => s.Tentativas.Any(t => t.AlternativaEscolhida == "R$ 999,00")));
    }

    [Fact]
    public async Task Formato_invalido_da_400_com_a_mensagem()
    {
        var (c, _) = await Logado();
        var r = await Gravar(c, new { chave = "com espaço", tipo = "licao" });
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        Assert.Contains("chave", await Erro(r));

        var futuro = await Gravar(c, new
        {
            chave = NovaChave(), tipo = "licao", disciplina = Disciplina, tema = TemaPorcentagem,
            iniciadaEm = DateTimeOffset.UtcNow.AddDays(1), concluidaEm = DateTimeOffset.UtcNow.AddDays(1),
            respostas = new[] { new { questaoId = 1, alternativa = "x" } },
        });
        Assert.Equal(HttpStatusCode.BadRequest, futuro.StatusCode);
        Assert.Contains("futuro", await Erro(futuro));
    }

    [Fact]
    public async Task Cada_aluno_so_ve_o_proprio_progresso_e_a_chave_e_por_aluno()
    {
        var (maria, _) = await Logado();
        var (joao, _) = await Logado();
        var q = await QuestaoPorcentagem();
        var chave = NovaChave();

        var daMaria = (await Json(await Gravar(maria, Licao(chave, q, "R$ 120,00")))).GetProperty("id").GetInt64();
        // A mesma chave em outra conta é outra sessão.
        var r = await Gravar(joao, Licao(chave, q, "R$ 30,00"));
        Assert.Equal(HttpStatusCode.Created, r.StatusCode);
        Assert.NotEqual(daMaria, (await Json(r)).GetProperty("id").GetInt64());

        var doJoao = (await Json(await joao.GetAsync("/api/progresso"))).GetProperty("sessoes");
        Assert.Equal(0, Assert.Single(doJoao.EnumerateArray()).GetProperty("acertos").GetInt32());
        Assert.Equal(HttpStatusCode.NotFound, (await joao.GetAsync($"/api/progresso/sessoes/{daMaria}")).StatusCode);
    }

    [Fact]
    public async Task Cookie_de_conta_excluida_nao_grava()
    {
        var (c, email) = await Logado();
        var outroAparelho = Navegador();
        Assert.Equal(HttpStatusCode.OK,
            (await outroAparelho.PostAsJsonAsync("/api/conta/entrar", new { email, senha = Senha })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent,
            (await c.PostAsJsonAsync("/api/conta/excluir", new { senha = Senha })).StatusCode);

        var r = await Gravar(outroAparelho, Licao(NovaChave(), await QuestaoPorcentagem(), "R$ 120,00"));
        Assert.Equal(HttpStatusCode.Unauthorized, r.StatusCode);
    }

    // ---- aulas ----

    [Fact]
    public async Task Marcar_aula_e_liga_desliga_idempotente()
    {
        var (c, _) = await Logado();
        var video = await Video(TemaPorcentagem);

        Assert.Equal(HttpStatusCode.NoContent, (await c.PutAsync($"/api/progresso/aulas/{video}", null)).StatusCode);
        var primeira = (await Json(await c.GetAsync("/api/progresso"))).GetProperty("aulas");
        var quando = Assert.Single(primeira.EnumerateArray()).GetProperty("assistidaEm").GetDateTime();

        // Marcar de novo não duplica nem troca a data.
        Assert.Equal(HttpStatusCode.NoContent, (await c.PutAsync($"/api/progresso/aulas/{video}", null)).StatusCode);
        var aula = Assert.Single((await Json(await c.GetAsync("/api/progresso"))).GetProperty("aulas").EnumerateArray());
        Assert.Equal(video, aula.GetProperty("videoaulaId").GetInt32());
        Assert.Equal(quando, aula.GetProperty("assistidaEm").GetDateTime());

        Assert.Equal(HttpStatusCode.NoContent, (await c.DeleteAsync($"/api/progresso/aulas/{video}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await c.DeleteAsync($"/api/progresso/aulas/{video}")).StatusCode);
        Assert.Equal(0, (await Json(await c.GetAsync("/api/progresso"))).GetProperty("aulas").GetArrayLength());
    }

    [Fact]
    public async Task Marcar_aula_que_nao_existe_da_404()
    {
        var (c, _) = await Logado();
        var r = await c.PutAsync("/api/progresso/aulas/999999", null);
        Assert.Equal(HttpStatusCode.NotFound, r.StatusCode);
        Assert.Contains("não encontrada", await Erro(r));
    }

    // ---- importar o localStorage ----

    [Fact]
    public async Task Importar_grava_o_que_vale_lista_o_que_nao_vale_e_repetir_nao_duplica()
    {
        var (c, _) = await Logado();
        var q = await QuestaoPorcentagem();
        var (v1, v2) = (await Video(TemaPorcentagem), await Video(TemaEquacoes));
        var (boa, outra) = (NovaChave(), NovaChave());

        var pedido = new
        {
            sessoes = new[]
            {
                Licao(boa, q, "R$ 120,00"),
                Licao(NovaChave(), q, "R$ 999,00"),                // alternativa que não existe
                new { chave = "", tipo = "licao" } as object,       // formato inválido
                Licao(boa, q, "R$ 30,00"),                          // mesma chave no lote
                Licao(outra, q, "R$ 30,00"),
            },
            aulas = new object[]
            {
                new { videoaulaId = v1, assistidaEm = Inicio },
                new { videoaulaId = v1, assistidaEm = Inicio },     // repetida
                new { videoaulaId = 999999, assistidaEm = Inicio }, // não existe
                new { videoaulaId = v2, assistidaEm = DateTimeOffset.UtcNow.AddYears(1) }, // futuro
            },
        };

        var r = await c.PostAsJsonAsync("/api/progresso/importar", pedido);
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var resumo = await Json(r);
        Assert.Equal(2, resumo.GetProperty("sessoesNovas").GetInt32());
        Assert.Equal(1, resumo.GetProperty("sessoesRepetidas").GetInt32());
        var ignoradas = resumo.GetProperty("sessoesIgnoradas").EnumerateArray().ToList();
        Assert.Equal([1, 2], ignoradas.Select(i => i.GetProperty("posicao").GetInt32()));
        Assert.Contains("alternativas", ignoradas[0].GetProperty("erro").GetString());
        Assert.Equal(1, resumo.GetProperty("aulasNovas").GetInt32());
        Assert.Equal(2, resumo.GetProperty("aulasIgnoradas").GetInt32());

        var progresso = await Json(await c.GetAsync("/api/progresso"));
        var chaves = progresso.GetProperty("sessoes").EnumerateArray().Select(s => s.GetProperty("chave").GetString()).ToList();
        Assert.Equal(2, chaves.Count);
        Assert.Contains(boa, chaves);
        Assert.Contains(outra, chaves);
        Assert.Equal(Inicio.UtcDateTime,
            Assert.Single(progresso.GetProperty("aulas").EnumerateArray()).GetProperty("assistidaEm").GetDateTime(),
            TimeSpan.FromMilliseconds(1));

        // Segundo aparelho, ou a mesma migração de novo: nada novo entra.
        var denovo = await Json(await c.PostAsJsonAsync("/api/progresso/importar", pedido));
        Assert.Equal(0, denovo.GetProperty("sessoesNovas").GetInt32());
        Assert.Equal(3, denovo.GetProperty("sessoesRepetidas").GetInt32());
        Assert.Equal(0, denovo.GetProperty("aulasNovas").GetInt32());
        Assert.Equal(2, (await Json(await c.GetAsync("/api/progresso"))).GetProperty("sessoes").GetArrayLength());
    }

    [Fact]
    public async Task Importar_lote_grande_demais_da_400()
    {
        var (c, _) = await Logado();
        var sessoes = Enumerable.Range(0, 501).Select(_ => new { chave = NovaChave() }).ToArray();
        var r = await c.PostAsJsonAsync("/api/progresso/importar", new { sessoes });
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        Assert.Contains("500", await Erro(r));
    }
}
