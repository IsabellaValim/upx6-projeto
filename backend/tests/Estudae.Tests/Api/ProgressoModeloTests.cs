using System.Net;
using System.Net.Http.Json;
using Estudae.Domain.Progresso;
using Estudae.Infra.Identity;
using Estudae.Infra.Persistence;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Estudae.Tests.Api;

// Fase C: as tabelas do progresso e as regras que o próprio banco garante
// (CHECKs, únicos, cascade ao excluir a conta). Ainda não há endpoint: grava e
// lê direto pelo DbContext, no banco descartável do fixture.
[Collection(ApiCollection.Nome)]
public class ProgressoModeloTests(ApiFixture f)
{
    private static readonly DateTime Agora = new(2026, 11, 17, 15, 0, 0, DateTimeKind.Utc);

    private sealed record Conteudo(int DisciplinaId, int TemaId, int[] Questoes, int VideoaulaId);

    private static async Task<Conteudo> Carregar(EstudaeDbContext db)
    {
        var tema = await db.Temas.Include(t => t.Disciplina).SingleAsync(t => t.Slug == "porcentagem-e-proporcao");
        var questoes = await db.Questoes.Where(q => q.Tema.DisciplinaId == tema.DisciplinaId)
            .OrderBy(q => q.Id).Select(q => q.Id).ToArrayAsync();
        var video = await db.Videoaulas.FirstAsync(v => v.TemaId == tema.Id);
        return new(tema.DisciplinaId, tema.Id, questoes, video.Id);
    }

    private static async Task<string> NovoUsuario(EstudaeDbContext db)
    {
        var email = $"progresso-{Guid.NewGuid():N}@exemplo.com.br";
        var u = new Usuario { UserName = email, Email = email, Nome = "Maria" };
        db.Users.Add(u);
        await db.SaveChangesAsync();
        return u.Id;
    }

    private static SessaoEstudo Licao(string usuarioId, Conteudo c) => new()
    {
        UsuarioId = usuarioId,
        Chave = Guid.NewGuid().ToString("N"),
        Tipo = TipoSessao.Licao,
        DisciplinaId = c.DisciplinaId,
        TemaId = c.TemaId,
        IniciadaEm = Agora,
        ConcluidaEm = Agora.AddMinutes(4),
    };

    private static async Task<string> Restricao(Func<Task> acao)
    {
        var e = await Assert.ThrowsAsync<DbUpdateException>(acao);
        var pg = Assert.IsType<PostgresException>(e.InnerException);
        return pg.ConstraintName!;
    }

    [Fact]
    public async Task Grava_licao_e_simulado_com_tentativas_e_le_de_volta()
    {
        await using var db = f.NovoContexto();
        var c = await Carregar(db);
        var usuario = await NovoUsuario(db);

        var licao = Licao(usuario, c);
        licao.Tentativas.Add(new Tentativa
        {
            QuestaoId = c.Questoes[0], Ordem = 1, AlternativaEscolhida = "R$ 120,00", Acertou = true,
            RespondidaEm = Agora.AddMinutes(1),
        });
        var simulado = new SessaoEstudo
        {
            UsuarioId = usuario,
            Chave = Guid.NewGuid().ToString("N"),
            Tipo = TipoSessao.Simulado,
            DisciplinaId = c.DisciplinaId,
            Treino = true,
            IniciadaEm = Agora.AddHours(1),
            ConcluidaEm = Agora.AddHours(1).AddMinutes(5),
            TempoLimiteSeg = 6 * 60,
            Tentativas =
            {
                new() { QuestaoId = c.Questoes[0], Ordem = 1, AlternativaEscolhida = "R$ 30,00", RespondidaEm = Agora.AddHours(1) },
                // Em branco: sem alternativa, conta como erro.
                new() { QuestaoId = c.Questoes[1], Ordem = 2, AlternativaEscolhida = null, RespondidaEm = Agora.AddHours(1) },
            },
        };
        db.SessoesEstudo.AddRange(licao, simulado);
        db.AulasAssistidas.Add(new AulaAssistida { UsuarioId = usuario, VideoaulaId = c.VideoaulaId, AssistidaEm = Agora });
        await db.SaveChangesAsync();

        await using var leitura = f.NovoContexto();
        var sessoes = await leitura.SessoesEstudo
            .Where(s => s.UsuarioId == usuario)
            .Include(s => s.Tentativas.OrderBy(t => t.Ordem))
            .OrderByDescending(s => s.ConcluidaEm)
            .ToListAsync();

        Assert.Equal([TipoSessao.Simulado, TipoSessao.Licao], sessoes.Select(s => s.Tipo));
        var sim = sessoes[0];
        Assert.Null(sim.TemaId);
        Assert.True(sim.Treino);
        Assert.Equal(TimeSpan.FromMinutes(5), sim.ConcluidaEm - sim.IniciadaEm);
        Assert.Equal([1, 2], sim.Tentativas.Select(t => (int)t.Ordem));
        Assert.Null(sim.Tentativas[1].AlternativaEscolhida);
        Assert.All(sim.Tentativas, t => Assert.False(t.Acertou));

        var lic = sessoes[1];
        Assert.Equal(c.TemaId, lic.TemaId);
        Assert.Null(lic.TempoLimiteSeg);
        Assert.Equal(DateTimeKind.Utc, lic.IniciadaEm.Kind);
        Assert.True(Assert.Single(lic.Tentativas).Acertou);

        Assert.True(await leitura.AulasAssistidas.AnyAsync(a => a.UsuarioId == usuario && a.VideoaulaId == c.VideoaulaId));
    }

    [Fact]
    public async Task Licao_sem_tema_e_simulado_com_tema_sao_recusados_pelo_banco()
    {
        await using var db = f.NovoContexto();
        var c = await Carregar(db);
        var usuario = await NovoUsuario(db);

        var semTema = Licao(usuario, c);
        semTema.TemaId = null;
        db.SessoesEstudo.Add(semTema);
        Assert.Equal("ck_sessao_estudo_tema", await Restricao(() => db.SaveChangesAsync()));
        db.ChangeTracker.Clear();

        var simuladoComTema = Licao(usuario, c);
        simuladoComTema.Tipo = TipoSessao.Simulado;
        db.SessoesEstudo.Add(simuladoComTema);
        Assert.Equal("ck_sessao_estudo_tema", await Restricao(() => db.SaveChangesAsync()));
    }

    [Fact]
    public async Task Tipo_desconhecido_tempo_limite_na_licao_e_datas_invertidas_sao_recusados()
    {
        await using var db = f.NovoContexto();
        var c = await Carregar(db);
        var usuario = await NovoUsuario(db);

        var casos = new (Action<SessaoEstudo> Estraga, string Restricao)[]
        {
            (s => { s.Tipo = "prova"; s.TemaId = null; }, "ck_sessao_estudo_tipo"),
            (s => s.TempoLimiteSeg = 600, "ck_sessao_estudo_tempo_limite"),
            (s => s.ConcluidaEm = s.IniciadaEm.AddSeconds(-1), "ck_sessao_estudo_datas"),
        };
        foreach (var (estraga, restricao) in casos)
        {
            var s = Licao(usuario, c);
            estraga(s);
            db.SessoesEstudo.Add(s);
            Assert.Equal(restricao, await Restricao(() => db.SaveChangesAsync()));
            db.ChangeTracker.Clear();
        }
    }

    [Fact]
    public async Task Mesma_questao_ou_mesma_posicao_duas_vezes_na_sessao_sao_recusadas()
    {
        await using var db = f.NovoContexto();
        var c = await Carregar(db);
        var usuario = await NovoUsuario(db);

        var repetida = Licao(usuario, c);
        repetida.Tentativas.Add(new() { QuestaoId = c.Questoes[0], Ordem = 1, RespondidaEm = Agora });
        repetida.Tentativas.Add(new() { QuestaoId = c.Questoes[0], Ordem = 2, RespondidaEm = Agora });
        db.SessoesEstudo.Add(repetida);
        Assert.Equal("ix_tentativa_sessao_estudo_id_questao_id", await Restricao(() => db.SaveChangesAsync()));
        db.ChangeTracker.Clear();

        var mesmaOrdem = Licao(usuario, c);
        mesmaOrdem.Tentativas.Add(new() { QuestaoId = c.Questoes[0], Ordem = 1, RespondidaEm = Agora });
        mesmaOrdem.Tentativas.Add(new() { QuestaoId = c.Questoes[1], Ordem = 1, RespondidaEm = Agora });
        db.SessoesEstudo.Add(mesmaOrdem);
        Assert.Equal("ix_tentativa_sessao_estudo_id_ordem", await Restricao(() => db.SaveChangesAsync()));
    }

    [Fact]
    public async Task Aula_assistida_duplicada_e_recusada()
    {
        await using var db = f.NovoContexto();
        var c = await Carregar(db);
        var usuario = await NovoUsuario(db);
        db.AulasAssistidas.Add(new AulaAssistida { UsuarioId = usuario, VideoaulaId = c.VideoaulaId, AssistidaEm = Agora });
        await db.SaveChangesAsync();

        // Outro contexto, como um segundo pedido: o rastreador não pega a duplicata.
        await using var outro = f.NovoContexto();
        outro.AulasAssistidas.Add(new AulaAssistida { UsuarioId = usuario, VideoaulaId = c.VideoaulaId, AssistidaEm = Agora });
        Assert.Equal("pk_aula_assistida", await Restricao(() => outro.SaveChangesAsync()));
    }

    [Fact]
    public async Task Conteudo_com_progresso_nao_pode_ser_apagado()
    {
        await using var db = f.NovoContexto();
        var c = await Carregar(db);
        var usuario = await NovoUsuario(db);
        var s = Licao(usuario, c);
        s.Tentativas.Add(new() { QuestaoId = c.Questoes[0], Ordem = 1, RespondidaEm = Agora });
        db.SessoesEstudo.Add(s);
        await db.SaveChangesAsync();

        // Direto no SQL: o EF nem tentaria, porque conhece o Restrict.
        var e = await Assert.ThrowsAsync<PostgresException>(() =>
            db.Database.ExecuteSqlAsync($"DELETE FROM questao WHERE id = {c.Questoes[0]}"));
        Assert.Equal("fk_tentativa_questao_questao_id", e.ConstraintName);
    }

    [Fact]
    public async Task Excluir_a_conta_apaga_sessoes_tentativas_e_aulas()
    {
        const string senha = "netos da vovó";
        var email = $"progresso-{Guid.NewGuid():N}@exemplo.com.br";
        var c = f.Factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        Assert.Equal(HttpStatusCode.Accepted,
            (await c.PostAsJsonAsync("/api/conta/cadastro", new { nome = "Maria", email, senha })).StatusCode);
        var (usuarioId, token) = f.Emails.UltimaConfirmacao(email);
        Assert.Equal(HttpStatusCode.OK,
            (await c.PostAsJsonAsync("/api/conta/confirmar-email", new { usuarioId, token })).StatusCode);

        long sessaoId;
        await using (var db = f.NovoContexto())
        {
            var conteudo = await Carregar(db);
            var s = Licao(usuarioId, conteudo);
            s.Tentativas.Add(new() { QuestaoId = conteudo.Questoes[0], Ordem = 1, RespondidaEm = Agora });
            db.SessoesEstudo.Add(s);
            db.AulasAssistidas.Add(new AulaAssistida { UsuarioId = usuarioId, VideoaulaId = conteudo.VideoaulaId, AssistidaEm = Agora });
            await db.SaveChangesAsync();
            sessaoId = s.Id;
        }

        Assert.Equal(HttpStatusCode.NoContent,
            (await c.PostAsJsonAsync("/api/conta/excluir", new { senha })).StatusCode);

        await using var leitura = f.NovoContexto();
        Assert.False(await leitura.SessoesEstudo.AnyAsync(s => s.UsuarioId == usuarioId));
        Assert.False(await leitura.Tentativas.AnyAsync(t => t.SessaoEstudoId == sessaoId));
        Assert.False(await leitura.AulasAssistidas.AnyAsync(a => a.UsuarioId == usuarioId));
    }
}
