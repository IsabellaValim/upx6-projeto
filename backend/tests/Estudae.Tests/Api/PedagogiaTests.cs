using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using Estudae.Domain.Conteudo;
using Estudae.Infra.Importacao;
using Microsoft.EntityFrameworkCore;

namespace Estudae.Tests.Api;

// Curadoria pedagógica (Fase 1b): formato separado do conteúdo, referências por
// slug/codigo, aplicação transacional e invalidação quando o conteúdo muda.
[Collection(ApiCollection.Nome)]
public class PedagogiaTests(ApiFixture f)
{
    private static ArquivoPedagogia CarregarExemplo()
    {
        var (arquivo, erro) = LeitorPedagogia.Ler(Exemplos.LerPedagogia());
        Assert.Null(erro);
        Assert.Empty(ValidadorPedagogia.Validar(arquivo!));
        return arquivo!;
    }

    private async Task AplicarExemploAsync()
    {
        var arquivo = CarregarExemplo();
        await using var db = f.NovoContexto();
        var importador = new ImportadorPedagogia(db);
        Assert.Empty(await importador.ValidarAsync(arquivo));
        await importador.AplicarAsync(arquivo);
    }

    [Fact]
    public async Task Servico_valida_formato_sem_gravar()
    {
        await using var db = f.NovoContexto();
        var importador = new ImportadorPedagogia(db);
        var arquivo = new ArquivoPedagogia();
        Assert.Contains(await importador.ValidarAsync(arquivo), e => e.Campo == "formato");
        await Assert.ThrowsAsync<InvalidOperationException>(() => importador.AplicarAsync(arquivo));
        Assert.False(db.ChangeTracker.HasChanges());
    }

    [Fact]
    public async Task Omissao_de_elegibilidade_nao_aprova_pedido_e_alteracao_sobe_versao()
    {
        await AplicarExemploAsync();
        var arquivo = CarregarExemplo();
        arquivo.Temas![0].Questoes![0].Elegivel = null;
        await using (var db = f.NovoContexto())
        {
            var resumo = await new ImportadorPedagogia(db).AplicarAsync(arquivo);
            Assert.Equal(1, resumo.MetadadosAtualizados);
            var meta = await db.MetadadosQuestoes.Include(m => m.Questao)
                .SingleAsync(m => m.Questao.Codigo == "exemplo-mat-porcentagem-001");
            Assert.False(meta.ElegibilidadeSolicitada);
        }
        await AplicarExemploAsync();
    }

    [Fact]
    public async Task Lista_vazia_remove_vinculos_obrigatorios_de_video()
    {
        await AplicarExemploAsync();
        var arquivo = CarregarExemplo();
        arquivo.Temas![0].Videos![0].Habilidades = [];
        await using (var db = f.NovoContexto())
            await new ImportadorPedagogia(db).AplicarAsync(arquivo);
        await using (var db = f.NovoContexto())
            Assert.Empty(await db.VideoaulaHabilidades.ToListAsync());
        await AplicarExemploAsync();
    }

    private async Task EsperarBloqueioAsync(CancellationToken ct)
    {
        await using var observador = f.NovoContexto();
        while (await observador.Database.SqlQueryRaw<int>(
                   "SELECT count(*)::int AS \"Value\" FROM pg_locks WHERE locktype = 'advisory' AND NOT granted")
                   .SingleAsync(ct) == 0)
            await Task.Delay(20, ct);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Aprovacao_espera_gravador_e_rejeita_impressao_antiga_mesmo_com_contexto_rastreado(bool imagem)
    {
        using var limite = new CancellationTokenSource(TimeSpan.FromSeconds(30));
        var ct = limite.Token;
        var (original, _) = LeitorConteudo.Ler(Exemplos.Ler("exemplo-valido.json"));
        var (alterado, _) = LeitorConteudo.Ler(Exemplos.Ler("exemplo-valido.json"));
        if (imagem)
            alterado!.Temas![0].Questoes![0].Imagem = new ImagemJson
            {
                Arquivo = ApiFixture.CaminhoImagem, Descricao = "Imagem para concorrência",
            };
        try
        {
            await using (var inicio = f.NovoContexto())
                await new ImportadorConteudo(inicio).ImportarAsync(alterado!, true, ct);
            var arquivo = CarregarExemplo();
            await using (var leitura = f.NovoContexto())
            {
                var q = await leitura.Questoes.SingleAsync(q => q.Codigo == "exemplo-mat-porcentagem-001", ct);
                var sha = imagem ? await leitura.Imagens.Where(i => i.Caminho == ApiFixture.CaminhoImagem)
                    .Select(i => i.Sha256).SingleAsync(ct) : null;
                arquivo.Temas![0].Questoes![0].Impressao = ImpressaoConteudo.Calcular(
                    q, "matematica", "porcentagem-e-proporcao", sha);
            }
            await using (var inicio = f.NovoContexto())
                await new ImportadorPedagogia(inicio).AplicarAsync(arquivo, ct);
            await using (var aprovadorDb = f.NovoContexto())
            await using (var gravadorDb = f.NovoContexto())
            {
                var aprovador = new ImportadorPedagogia(aprovadorDb);
                Assert.Empty(await aprovador.ValidarAsync(arquivo, ct));
                await using var transacao = await gravadorDb.Database.BeginTransactionAsync(ct);
                if (imagem)
                {
                    await new GravadorImagens(gravadorDb).GravarAsync(
                        [(ApiFixture.CaminhoImagem, new byte[] { 1, 4, 7, 9 })], new ResumoImagens(), ct);
                    await gravadorDb.SaveChangesAsync(ct);
                }
                else
                {
                    alterado!.Temas![0].Questoes![0].Resolucao = "Alteração concorrente";
                    await new ImportadorConteudo(gravadorDb).ImportarAsync(alterado, true, ct);
                }
                var aprovacao = aprovador.AplicarAsync(arquivo, ct);
                await EsperarBloqueioAsync(ct);
                Assert.False(aprovacao.IsCompleted);
                await transacao.CommitAsync(ct);
                var erro = await Assert.ThrowsAsync<InvalidOperationException>(() => aprovacao);
                Assert.Contains("impressao", erro.Message);
            }
            await using var conferir = f.NovoContexto();
            var meta = await conferir.MetadadosQuestoes.Include(m => m.Questao)
                .SingleAsync(m => m.Questao.Codigo == "exemplo-mat-porcentagem-001", ct);
            Assert.False(meta.ConteudoConfere);
        }
        finally
        {
            await using (var restaurar = f.NovoContexto())
            {
                await new GravadorImagens(restaurar).GravarAsync(
                    [(ApiFixture.CaminhoImagem, ApiFixture.BytesImagem)], new ResumoImagens());
                await new ImportadorConteudo(restaurar).ImportarAsync(original!, true);
            }
            await AplicarExemploAsync();
        }
    }

    [Fact]
    public async Task Conteudo_espera_aprovacao_nova_e_invalida_metadados_que_nao_estavam_rastreados()
    {
        await AplicarExemploAsync();
        var (original, _) = LeitorConteudo.Ler(Exemplos.Ler("exemplo-valido.json"));
        var (alterado, _) = LeitorConteudo.Ler(Exemplos.Ler("exemplo-valido.json"));
        alterado!.Temas![0].Questoes![0].Resolucao = "Mudança após aprovação concorrente";
        using var limite = new CancellationTokenSource(TimeSpan.FromSeconds(30));
        var ct = limite.Token;
        try
        {
            await using (var limpar = f.NovoContexto())
            {
                var meta = await limpar.MetadadosQuestoes.Include(m => m.Questao)
                    .SingleAsync(m => m.Questao.Codigo == "exemplo-mat-porcentagem-001", ct);
                limpar.MetadadosQuestoes.Remove(meta);
                await limpar.SaveChangesAsync(ct);
            }
            await using (var conteudoDb = f.NovoContexto())
            await using (var aprovadorDb = f.NovoContexto())
            {
                var antiga = await conteudoDb.Questoes.Include(q => q.Metadados)
                    .SingleAsync(q => q.Codigo == "exemplo-mat-porcentagem-001", ct);
                Assert.Null(antiga.Metadados);
                await using var transacao = await aprovadorDb.Database.BeginTransactionAsync(ct);
                await new ImportadorPedagogia(aprovadorDb).AplicarAsync(CarregarExemplo(), ct);
                var gravacao = new ImportadorConteudo(conteudoDb).ImportarAsync(alterado, true, ct);
                await EsperarBloqueioAsync(ct);
                Assert.False(gravacao.IsCompleted);
                await transacao.CommitAsync(ct);
                await gravacao;
            }
            await using var conferir = f.NovoContexto();
            var atual = await conferir.MetadadosQuestoes.Include(m => m.Questao)
                .SingleAsync(m => m.Questao.Codigo == "exemplo-mat-porcentagem-001", ct);
            Assert.False(atual.ConteudoConfere);
        }
        finally
        {
            await using (var restaurar = f.NovoContexto())
                await new ImportadorConteudo(restaurar).ImportarAsync(original!, true);
            await AplicarExemploAsync();
        }
    }

    [Fact]
    public async Task Secundarias_novas_podem_ser_substituidas_e_removidas_sem_violar_fk()
    {
        await AplicarExemploAsync();
        var arquivo = CarregarExemplo();
        arquivo.Temas![0].Habilidades!.Add(new HabilidadeJson { Slug = "secundaria-teste", Titulo = "Secundária" });
        arquivo.Temas[0].Questoes![0].Secundarias = ["secundaria-teste"];
        await using (var db = f.NovoContexto())
        {
            await new ImportadorPedagogia(db).AplicarAsync(arquivo);
            Assert.Single(await db.QuestaoHabilidadesSecundarias.ToListAsync());
            var resumo = await new ImportadorPedagogia(db).AplicarAsync(arquivo);
            Assert.Equal(0, resumo.MetadadosAtualizados);
            arquivo.Temas[0].Questoes![0].Secundarias = [];
            await new ImportadorPedagogia(db).AplicarAsync(arquivo);
            Assert.Empty(await db.QuestaoHabilidadesSecundarias.ToListAsync());
            db.Habilidades.Remove(await db.Habilidades.SingleAsync(h => h.Slug == "secundaria-teste"));
            await db.SaveChangesAsync();
        }
        await AplicarExemploAsync();
    }

    [Fact]
    public async Task Imagem_antes_ausente_nao_torna_aprovacao_antiga_elegivel()
    {
        const string caminho = "teste/nova-pedagogia.webp";
        var (original, _) = LeitorConteudo.Ler(Exemplos.Ler("exemplo-valido.json"));
        var (conteudo, _) = LeitorConteudo.Ler(Exemplos.Ler("exemplo-valido.json"));
        conteudo!.Temas![0].Questoes![0].Imagem = new ImagemJson { Arquivo = caminho, Descricao = "Nova figura" };
        try
        {
            await using (var db = f.NovoContexto())
                await new ImportadorConteudo(db).ImportarAsync(conteudo, true);
            var arquivo = CarregarExemplo();
            await using (var db = f.NovoContexto())
            {
                var q = await db.Questoes.SingleAsync(q => q.Codigo == "exemplo-mat-porcentagem-001");
                arquivo.Temas![0].Questoes![0].Impressao = ImpressaoConteudo.Calcular(
                    q, "matematica", "porcentagem-e-proporcao", null);
                await new ImportadorPedagogia(db).AplicarAsync(arquivo);
            }
            await using (var db = f.NovoContexto())
            {
                await new GravadorImagens(db).GravarAsync([(caminho, new byte[] { 1, 2, 3 })], new ResumoImagens());
                await db.SaveChangesAsync();
            }
            await using var conferir = f.NovoContexto();
            var meta = await conferir.MetadadosQuestoes.Include(m => m.Questao)
                .SingleAsync(m => m.Questao.Codigo == "exemplo-mat-porcentagem-001");
            Assert.False(meta.ConteudoConfere);
        }
        finally
        {
            await using (var db = f.NovoContexto())
            {
                await new ImportadorConteudo(db).ImportarAsync(original!, true);
                var img = await db.Imagens.SingleOrDefaultAsync(i => i.Caminho == caminho);
                if (img is not null) db.Imagens.Remove(img);
                await db.SaveChangesAsync();
            }
            await AplicarExemploAsync();
        }
    }

    [Fact]
    public async Task Contexto_com_alteracoes_pendentes_e_rejeitado_sem_perder_dados()
    {
        await using var db = f.NovoContexto();
        var q = await db.Questoes.FirstAsync();
        q.Resolucao = "Alteração não salva";
        await Assert.ThrowsAsync<InvalidOperationException>(() => new ImportadorPedagogia(db).AplicarAsync(CarregarExemplo()));
        Assert.True(db.ChangeTracker.HasChanges());
    }

    // ---- aplicação ----

    [Fact]
    public async Task Aplicar_cria_habilidades_metadados_e_vinculos()
    {
        await AplicarExemploAsync();
        await using var db = f.NovoContexto();

        Assert.Equal(2, await db.Habilidades.CountAsync());
        Assert.Equal(2, await db.MetadadosQuestoes.CountAsync());
        Assert.Single(await db.VideoaulaHabilidades.ToListAsync());

        var aprovada = await db.MetadadosQuestoes.Include(m => m.Questao)
            .SingleAsync(m => m.Questao.Codigo == "exemplo-mat-porcentagem-001");
        Assert.Equal(StatusRevisao.Aprovada, aprovada.StatusRevisao);
        Assert.True(aprovada.ConteudoConfere);
        Assert.True(aprovada.ElegibilidadeSolicitada);
        Assert.Equal("desconto-direto-em-preco", aprovada.Familia);
        Assert.Equal(DificuldadeCuratorial.Introdutoria, aprovada.Dificuldade);
        Assert.NotNull(aprovada.ImpressaoConteudo);
        Assert.Equal("Equipe Estudaê (exemplo)", aprovada.Revisor);

        var pendente = await db.MetadadosQuestoes.Include(m => m.Questao)
            .SingleAsync(m => m.Questao.Codigo == "exemplo-mat-equacoes-001");
        Assert.Equal(StatusRevisao.Pendente, pendente.StatusRevisao);
        Assert.False(pendente.ElegibilidadeSolicitada);

        var config = await db.ConfiguracoesPedagogicas.SingleAsync();
        Assert.False(config.MatrizValidada);
        Assert.Equal("exemplo-2026 (não é matriz oficial)", config.VersaoMatriz);
    }

    [Fact]
    public async Task Reimportar_e_idempotente_e_nao_sobe_versao()
    {
        await AplicarExemploAsync();
        var arquivo = CarregarExemplo();
        await using var db = f.NovoContexto();
        var antes = await db.MetadadosQuestoes.AsNoTracking().Include(m => m.Questao)
            .SingleAsync(m => m.Questao.Codigo == "exemplo-mat-porcentagem-001");
        var resumo = await new ImportadorPedagogia(db).AplicarAsync(arquivo);
        Assert.Equal(0, resumo.MetadadosAtualizados);
        Assert.False(resumo.MatrizAtualizada);

        Assert.Equal(0, resumo.MetadadosCriados);
        Assert.Equal(0, resumo.HabilidadesCriadas);
        var meta = await db.MetadadosQuestoes.Include(m => m.Questao)
            .SingleAsync(m => m.Questao.Codigo == "exemplo-mat-porcentagem-001");
        Assert.Equal(antes.Versao, meta.Versao); // nada mudou: versão não sobe
        Assert.Equal(antes.RevisadoEm, meta.RevisadoEm);
    }

    [Fact]
    public async Task Referencias_inexistentes_acumulam_erros_sem_gravar()
    {
        var raiz = JsonNode.Parse(Exemplos.LerPedagogia())!.AsObject();
        raiz["temas"]![0]!["questoes"]![0]!["codigo"] = "nao-existe";
        raiz["temas"]![1]!["questoes"]![0]!["habilidade"] = "habilidade-inexistente";
        raiz["temas"]!.AsArray().Add(new JsonObject { ["slug"] = "tema-inexistente" });
        var (arquivo, _) = LeitorPedagogia.Ler(raiz.ToJsonString());

        await using var db = f.NovoContexto();
        var erros = await new ImportadorPedagogia(db).ValidarAsync(arquivo!);

        Assert.Contains(erros, e => e.Campo == "codigo" && e.Mensagem.Contains("não existe"));
        Assert.Contains(erros, e => e.Campo == "habilidade" && e.Mensagem.Contains("não está declarada"));
        Assert.Contains(erros, e => e.Campo == "slug" && e.Mensagem.Contains("tema não existe"));
    }

    [Fact]
    public async Task Familia_nao_pode_aparecer_em_dois_temas()
    {
        var raiz = JsonNode.Parse(Exemplos.LerPedagogia())!.AsObject();
        // Mesma família do primeiro tema repetida no segundo.
        raiz["temas"]![1]!["questoes"]![0]!["familia"] = "desconto-direto-em-preco";
        var (arquivo, _) = LeitorPedagogia.Ler(raiz.ToJsonString());

        await using var db = f.NovoContexto();
        var erros = await new ImportadorPedagogia(db).ValidarAsync(arquivo!);

        Assert.Contains(erros, e => e.Campo == "familia" && e.Mensagem.Contains("já é usada"));
    }

    [Fact]
    public async Task Impressao_esperada_diferente_aborta()
    {
        var raiz = JsonNode.Parse(Exemplos.LerPedagogia())!.AsObject();
        raiz["temas"]![0]!["questoes"]![0]!["impressao"] = new string('0', 64);
        var (arquivo, _) = LeitorPedagogia.Ler(raiz.ToJsonString());

        await using var db = f.NovoContexto();
        var erros = await new ImportadorPedagogia(db).ValidarAsync(arquivo!);

        var erro = Assert.Single(erros);
        Assert.Equal("impressao", erro.Campo);
    }

    // ---- invalidação por mudança de conteúdo ----

    [Fact]
    public async Task Mudar_a_questao_invalida_a_revisao_aprovada()
    {
        await AplicarExemploAsync();

        // Reimporta o mesmo conteúdo com a resolução alterada: a impressão muda.
        var raiz = JsonNode.Parse(Exemplos.Ler("exemplo-valido.json"))!.AsObject();
        raiz["temas"]![0]!["questoes"]![0]!["resolucao"] = "Resolução alterada depois da revisão.";
        var (conteudo, _) = LeitorConteudo.Ler(raiz.ToJsonString());
        await using (var db = f.NovoContexto())
        {
            var resumo = await new ImportadorConteudo(db).ImportarAsync(conteudo!, publicar: true);
            Assert.Contains(resumo.Avisos, a => a.Contains("exemplo-mat-porcentagem-001") && a.Contains("inválida"));
        }

        await using (var db2 = f.NovoContexto())
        {
            var meta = await db2.MetadadosQuestoes.Include(m => m.Questao)
                .SingleAsync(m => m.Questao.Codigo == "exemplo-mat-porcentagem-001");
            Assert.False(meta.ConteudoConfere); // continua aprovada, mas a impressão não confere mais
            Assert.Equal(StatusRevisao.Aprovada, meta.StatusRevisao);
        }

        // Restaura o conteúdo original e a revisão para os outros testes.
        var (original, _) = LeitorConteudo.Ler(Exemplos.Ler("exemplo-valido.json"));
        await using (var db3 = f.NovoContexto())
            await new ImportadorConteudo(db3).ImportarAsync(original!, publicar: true);
        await AplicarExemploAsync();
    }

    [Fact]
    public async Task Trocar_os_bytes_da_imagem_invalida_a_revisao()
    {
        // Metadados aprovados direto no banco, na questão autoral com imagem.
        await using (var db = f.NovoContexto())
        {
            var tema = await db.Temas.SingleAsync(t => t.Slug == ApiFixture.TemaAutoral);
            var habilidade = new Habilidade { Tema = tema, Slug = "h-teste", Titulo = "Habilidade de teste" };
            var questao = await db.Questoes.SingleAsync(q => q.Codigo == ApiFixture.CodigoAutoral);
            db.MetadadosQuestoes.Add(new MetadadosQuestao
            {
                Questao = questao,
                HabilidadePrincipal = habilidade,
                Familia = "familia-teste",
                StatusRevisao = StatusRevisao.Aprovada,
                ConteudoConfere = true,
                ElegibilidadeSolicitada = true,
            });
            await db.SaveChangesAsync();
        }

        await using (var db = f.NovoContexto())
        {
            var resumo = new ResumoImagens();
            await new GravadorImagens(db).GravarAsync(
                [(ApiFixture.CaminhoImagem, [9, 9, 9])], resumo);
            await db.SaveChangesAsync();
            Assert.Equal(1, resumo.RevisoesInvalidadas);
        }

        await using (var db = f.NovoContexto())
        {
            var meta = await db.MetadadosQuestoes.Include(m => m.Questao)
                .SingleAsync(m => m.Questao.Codigo == ApiFixture.CodigoAutoral);
            Assert.False(meta.ConteudoConfere);
            // Limpeza: devolve os bytes originais da imagem.
            db.ChangeTracker.Clear();
            var resumo = new ResumoImagens();
            await new GravadorImagens(db).GravarAsync(
                [(ApiFixture.CaminhoImagem, ApiFixture.BytesImagem)], resumo);
            var antiga = await db.MetadadosQuestoes.SingleAsync(m => m.Questao.Codigo == ApiFixture.CodigoAutoral);
            db.MetadadosQuestoes.Remove(antiga);
            var habilidade = await db.Habilidades.SingleAsync(h => h.Slug == "h-teste");
            db.Habilidades.Remove(habilidade);
            await db.SaveChangesAsync();
        }
    }

    // ---- API ----

    [Fact]
    public async Task Endpoint_pedagogia_lista_indice_leve()
    {
        await AplicarExemploAsync();
        var bruto = await f.Client.GetStringAsync("/api/disciplinas/matematica/pedagogia");

        Assert.DoesNotContain("enunciado", bruto, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("respostaCorreta", bruto, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("impressao", bruto, StringComparison.OrdinalIgnoreCase);

        var raiz = JsonDocument.Parse(bruto).RootElement;
        Assert.Equal("matematica", raiz.GetProperty("disciplina").GetString());
        var matriz = raiz.GetProperty("matriz");
        Assert.False(matriz.GetProperty("validada").GetBoolean());

        var temas = raiz.GetProperty("temas").EnumerateArray().ToList();
        var porcentagem = Assert.Single(temas, t => t.GetProperty("slug").GetString() == "porcentagem-e-proporcao");
        var habilidade = Assert.Single(porcentagem.GetProperty("habilidades").EnumerateArray());
        Assert.Equal("porcentagem-de-quantidades", habilidade.GetProperty("slug").GetString());
        Assert.True(habilidade.GetProperty("essencial").GetBoolean());

        var questao = Assert.Single(porcentagem.GetProperty("questoes").EnumerateArray());
        Assert.Equal("exemplo-mat-porcentagem-001", questao.GetProperty("codigo").GetString());
        Assert.True(Guid.TryParse(questao.GetProperty("revisaoConteudo").GetString(), out _));
        var pedagogia = questao.GetProperty("pedagogia");
        Assert.Equal("desconto-direto-em-preco", pedagogia.GetProperty("familia").GetString());
        Assert.Equal("aprovada", pedagogia.GetProperty("revisao").GetString());
        Assert.True(pedagogia.GetProperty("elegivel").GetBoolean());

        var equacoes = Assert.Single(temas, t => t.GetProperty("slug").GetString() == "equacoes");
        var q2 = Assert.Single(equacoes.GetProperty("questoes").EnumerateArray());
        Assert.False(q2.GetProperty("pedagogia").GetProperty("elegivel").GetBoolean()); // pendente não é elegível
    }

    [Fact]
    public async Task Questoes_trazem_codigo_e_pedagogia()
    {
        await AplicarExemploAsync();
        var json = await f.Client.GetFromJsonAsync<JsonElement>(
            "/api/disciplinas/matematica/temas/porcentagem-e-proporcao/questoes");

        var q = Assert.Single(json.EnumerateArray());
        Assert.Equal("exemplo-mat-porcentagem-001", q.GetProperty("codigo").GetString());
        var pedagogia = q.GetProperty("pedagogia");
        Assert.Equal("porcentagem-de-quantidades", pedagogia.GetProperty("habilidade").GetString());
        Assert.Equal("aprovada", pedagogia.GetProperty("revisao").GetString());
        Assert.True(pedagogia.GetProperty("elegivel").GetBoolean());
    }

    [Fact]
    public async Task Temas_trazem_habilidades_e_videos_com_vinculo()
    {
        await AplicarExemploAsync();
        var json = await f.Client.GetFromJsonAsync<JsonElement>("/api/disciplinas/matematica/temas");

        var porcentagem = Assert.Single(json.EnumerateArray(), t => t.GetProperty("slug").GetString() == "porcentagem-e-proporcao");
        var habilidade = Assert.Single(porcentagem.GetProperty("habilidades").EnumerateArray());
        Assert.Equal("porcentagem-de-quantidades", habilidade.GetProperty("slug").GetString());
        var video = Assert.Single(porcentagem.GetProperty("videos").EnumerateArray());
        Assert.Equal(["porcentagem-de-quantidades"],
            video.GetProperty("habilidades").EnumerateArray().Select(h => h.GetString()));
    }

    [Fact]
    public async Task Revisao_publica_estavel_em_importacao_igual_e_muda_com_conteudo_ou_imagem()
    {
        async Task<Guid> RevisaoAsync()
        {
            var json = await f.Client.GetFromJsonAsync<JsonElement>(
                "/api/disciplinas/matematica/temas/porcentagem-e-proporcao/questoes");
            return Guid.Parse(Assert.Single(json.EnumerateArray()).GetProperty("revisaoConteudo").GetString()!);
        }
        var inicial = await RevisaoAsync();
        var (original, _) = LeitorConteudo.Ler(Exemplos.Ler("exemplo-valido.json"));
        await using (var db = f.NovoContexto())
            await new ImportadorConteudo(db).ImportarAsync(original!, true);
        Assert.Equal(inicial, await RevisaoAsync());

        var raiz = JsonNode.Parse(Exemplos.Ler("exemplo-valido.json"))!.AsObject();
        raiz["temas"]![0]!["questoes"]![0]!["enunciado"] = "Enunciado alterado.";
        var (alterado, _) = LeitorConteudo.Ler(raiz.ToJsonString());
        await using (var db = f.NovoContexto())
            await new ImportadorConteudo(db).ImportarAsync(alterado!, true);
        Assert.NotEqual(inicial, await RevisaoAsync());
        await using (var db = f.NovoContexto())
            await new ImportadorConteudo(db).ImportarAsync(original!, true);
        var restaurada = await RevisaoAsync();
        Assert.NotEqual(inicial, restaurada);

        const string caminho = "teste/revisao.webp";
        var raizImagem = JsonNode.Parse(Exemplos.Ler("exemplo-valido.json"))!.AsObject();
        raizImagem["temas"]![0]!["questoes"]![0]!["imagem"] =
            new JsonObject { ["arquivo"] = caminho, ["descricao"] = "Nova imagem" };
        var (comImagem, _) = LeitorConteudo.Ler(raizImagem.ToJsonString());
        await using (var db = f.NovoContexto())
        {
            await new GravadorImagens(db).GravarAsync([(caminho, ApiFixture.BytesImagem)], new ResumoImagens());
            await new ImportadorConteudo(db).ImportarAsync(comImagem!, true);
        }
        var comUuid1 = await RevisaoAsync();
        Assert.NotEqual(restaurada, comUuid1);
        await using (var db = f.NovoContexto())
        {
            await new GravadorImagens(db).GravarAsync([(caminho, [8, 6])], new ResumoImagens());
            await db.SaveChangesAsync();
        }
        Assert.NotEqual(comUuid1, await RevisaoAsync());
        await using (var db = f.NovoContexto())
        {
            await new ImportadorConteudo(db).ImportarAsync(original!, true);
            var img = await db.Imagens.SingleOrDefaultAsync(i => i.Caminho == caminho);
            if (img is not null) db.Imagens.Remove(img);
            await db.SaveChangesAsync();
        }
    }

    [Fact]
    public async Task Correcao_devolve_codigo_e_mesma_revisao_do_conteudo()
    {
        int id;
        await using (var db = f.NovoContexto())
            id = await db.Questoes.Where(q => q.Codigo == "exemplo-mat-equacoes-001").Select(q => q.Id).SingleAsync();

        var r = await f.Client.PostAsJsonAsync($"/api/questoes/{id}/resposta", new { alternativa = "5" });
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var correcao = JsonDocument.Parse(await r.Content.ReadAsStringAsync()).RootElement;
        Assert.Equal("exemplo-mat-equacoes-001", correcao.GetProperty("codigo").GetString());
        var revisao = correcao.GetProperty("revisaoConteudo").GetString();
        Assert.True(Guid.TryParse(revisao, out _));
        Assert.DoesNotMatch("^[0-9a-f]{64}$", revisao);
        var questoes = await f.Client.GetFromJsonAsync<JsonElement>("/api/disciplinas/matematica/temas/equacoes/questoes");
        Assert.Equal(revisao, Assert.Single(questoes.EnumerateArray()).GetProperty("revisaoConteudo").GetString());
        var indice = await f.Client.GetFromJsonAsync<JsonElement>("/api/disciplinas/matematica/pedagogia");
        Assert.Equal(revisao, Assert.Single(indice.GetProperty("temas").EnumerateArray(),
            t => t.GetProperty("slug").GetString() == "equacoes")
            .GetProperty("questoes").EnumerateArray().Single().GetProperty("revisaoConteudo").GetString());
    }
}
