using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Estudae.Api.Endpoints;
using Microsoft.EntityFrameworkCore;

namespace Estudae.Tests.Api;

[Collection(ApiCollection.Nome)]
public class ApiTests(ApiFixture f)
{
    private sealed record Correcao(bool Acertou, string RespostaCorreta, string Resolucao);

    // ---- infraestrutura ----

    [Fact]
    public async Task Health_responde_healthy_com_o_banco_de_pe()
    {
        var r = await f.Client.GetAsync("/health");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        Assert.Equal("Healthy", await r.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Todas_as_migrations_aplicam_num_banco_vazio()
    {
        // O banco do fixture nasceu vazio e foi montado só pelas migrations.
        await using var db = f.NovoContexto();
        Assert.Empty(await db.Database.GetPendingMigrationsAsync());
        Assert.Equal(db.Database.GetMigrations(), await db.Database.GetAppliedMigrationsAsync());
    }

    [Fact]
    public void Modelo_nao_tem_mudanca_sem_migration()
    {
        // Falha se alguém mudou uma entidade/mapeamento e esqueceu o "migrations add".
        using var db = f.NovoContexto();
        Assert.False(db.Database.HasPendingModelChanges());
    }

    // ---- leitura ----

    [Fact]
    public async Task Lista_disciplinas_contando_so_publicadas()
    {
        var json = await f.Client.GetFromJsonAsync<JsonElement>("/api/disciplinas");
        var mat = Assert.Single(json.EnumerateArray(), d => d.GetProperty("slug").GetString() == "matematica");
        Assert.Equal(2, mat.GetProperty("totalQuestoes").GetInt32()); // o rascunho não conta
    }

    [Fact]
    public async Task Lista_temas_na_ordem_com_videos()
    {
        var temas = (await f.Client.GetFromJsonAsync<JsonElement>("/api/disciplinas/matematica/temas")).EnumerateArray().ToList();
        Assert.Equal(["porcentagem-e-proporcao", "equacoes"], temas.Select(t => t.GetProperty("slug").GetString()));
        var video = Assert.Single(temas[0].GetProperty("videos").EnumerateArray());
        Assert.Equal("AAAAAAAAAAA", video.GetProperty("youtubeId").GetString()); // extraído do link completo
    }

    [Fact]
    public async Task Questoes_nao_trazem_gabarito_resolucao_nem_rascunho()
    {
        var bruto = await f.Client.GetStringAsync("/api/disciplinas/matematica/temas/equacoes/questoes");

        Assert.DoesNotContain("respostaCorreta", bruto, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("resolucao", bruto, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("RASCUNHO-NAO-PODE-APARECER", bruto);
        Assert.DoesNotContain("status", bruto, StringComparison.OrdinalIgnoreCase);

        var questao = Assert.Single(JsonDocument.Parse(bruto).RootElement.EnumerateArray());
        Assert.Equal(["15", "25", "3", "5"],
            questao.GetProperty("alternativas").EnumerateArray().Select(a => a.GetString()).Order());
    }

    [Theory]
    [InlineData("/api/disciplinas/historia/temas")]
    [InlineData("/api/disciplinas/matematica/temas/nao-existe/questoes")]
    [InlineData("/api/disciplinas/historia/temas/equacoes/questoes")]
    public async Task Disciplina_ou_tema_inexistente_da_404_com_mensagem(string url)
    {
        var r = await f.Client.GetAsync(url);
        Assert.Equal(HttpStatusCode.NotFound, r.StatusCode);
        Assert.False(string.IsNullOrWhiteSpace((await r.Content.ReadFromJsonAsync<ProblemaDto>())!.Erro));
    }

    // ---- correção ----

    private async Task<int> IdDe(string codigo)
    {
        await using var db = f.NovoContexto();
        return await db.Questoes.Where(q => q.Codigo == codigo).Select(q => q.Id).SingleAsync();
    }

    [Theory]
    [InlineData("5", true)]
    [InlineData("  5  ", true)]
    [InlineData("15", false)]
    public async Task Corrige_a_resposta_pelo_texto(string alternativa, bool acertou)
    {
        var id = await IdDe("exemplo-mat-equacoes-001");
        var r = await f.Client.PostAsJsonAsync($"/api/questoes/{id}/resposta", new { alternativa });
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);

        var c = (await r.Content.ReadFromJsonAsync<Correcao>())!;
        Assert.Equal(acertou, c.Acertou);
        Assert.Equal("5", c.RespostaCorreta);
        Assert.Contains("3x + 5 = 20", c.Resolucao);
    }

    [Theory]
    [InlineData("""{"alternativa":"7"}""")]
    [InlineData("""{}""")]
    [InlineData("""{"alternativa":5}""")]
    [InlineData("isso não é json")]
    public async Task Resposta_invalida_da_400_com_mensagem(string corpo)
    {
        var id = await IdDe("exemplo-mat-equacoes-001");
        var r = await f.Client.PostAsync($"/api/questoes/{id}/resposta",
            new StringContent(corpo, System.Text.Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        Assert.False(string.IsNullOrWhiteSpace((await r.Content.ReadFromJsonAsync<ProblemaDto>())!.Erro));
    }

    [Fact]
    public async Task Questao_em_rascunho_nao_pode_ser_respondida()
    {
        var id = await IdDe(ApiFixture.CodigoRascunho);
        var r = await f.Client.PostAsJsonAsync($"/api/questoes/{id}/resposta", new { alternativa = "sim" });
        Assert.Equal(HttpStatusCode.NotFound, r.StatusCode);
        Assert.DoesNotContain("RESOLUCAO-SECRETA", await r.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Reimportar_nao_duplica()
    {
        // O fixture já importou o exemplo; importar de novo mantém as mesmas linhas.
        await using var db = f.NovoContexto();
        var antes = await db.Questoes.CountAsync();

        var (arquivo, _) = Estudae.Infra.Importacao.LeitorConteudo.Ler(Exemplos.Ler("exemplo-valido.json"));
        await new Estudae.Infra.Importacao.ImportadorConteudo(db).ImportarAsync(arquivo!, publicar: true);

        await using var db2 = f.NovoContexto();
        Assert.Equal(antes, await db2.Questoes.CountAsync());
        Assert.Equal(2, await db2.Videoaulas.CountAsync());
        Assert.Equal(2, await db2.Temas.CountAsync(t => t.Disciplina.Slug == "matematica"));
    }

    // ---- origem da questão ----

    [Fact]
    public async Task Questao_oficial_traz_a_prova_de_origem()
    {
        var json = await f.Client.GetFromJsonAsync<JsonElement>("/api/disciplinas/matematica/temas/equacoes/questoes");
        var prova = Assert.Single(json.EnumerateArray()).GetProperty("prova");
        Assert.Equal(JsonValueKind.Object, prova.ValueKind);
        Assert.True(prova.GetProperty("ano").GetInt32() >= 2002);
    }

    [Fact]
    public async Task Questao_autoral_vem_com_prova_null_e_pode_ser_respondida()
    {
        var json = await f.Client.GetFromJsonAsync<JsonElement>(
            $"/api/disciplinas/{ApiFixture.DisciplinaAutoral}/temas/{ApiFixture.TemaAutoral}/questoes");
        var q = Assert.Single(json.EnumerateArray());
        Assert.Equal(JsonValueKind.Null, q.GetProperty("prova").ValueKind);

        var r = await f.Client.PostAsJsonAsync($"/api/questoes/{q.GetProperty("id").GetInt32()}/resposta", new { alternativa = "4" });
        Assert.True((await r.Content.ReadFromJsonAsync<Correcao>())!.Acertou);
    }
}
