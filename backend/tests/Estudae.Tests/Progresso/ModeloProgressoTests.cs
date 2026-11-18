using Estudae.Domain.Progresso;
using Estudae.Infra.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;

namespace Estudae.Tests.Progresso;

// Unidade, sem banco: confere o modelo do EF que a migration Progresso deveria
// refletir. A conexão nunca é aberta, então o Postgres não precisa estar de pé.
// O comportamento de verdade no banco (CHECKs recusando, cascade) está em
// Api/ProgressoModeloTests.cs.
public class ModeloProgressoTests : IDisposable
{
    private readonly EstudaeDbContext _db = new(
        new DbContextOptionsBuilder<EstudaeDbContext>()
            .UseNpgsql("Host=nao-conecta;Database=nada")
            .UseSnakeCaseNamingConvention()
            .Options);

    // O modelo de tempo de design: o de execução descarta os CHECKs.
    private IModel Modelo => _db.GetService<IDesignTimeModel>().Model;

    private IEntityType Entidade<T>() => Modelo.FindEntityType(typeof(T))!;

    private static string[] Colunas(IEnumerable<IProperty> props) =>
        props.Select(p => p.GetColumnName()).ToArray();

    public void Dispose() => _db.Dispose();

    [Fact]
    public void Nao_falta_migration_para_o_modelo_atual()
    {
        // Mudou uma configuração e esqueceu o "dotnet ef migrations add"? Falha aqui.
        Assert.False(_db.Database.HasPendingModelChanges());
        Assert.Contains(_db.Database.GetMigrations(), m => m.EndsWith("_Progresso"));
    }

    [Theory]
    [InlineData(typeof(SessaoEstudo), "sessao_estudo")]
    [InlineData(typeof(Tentativa), "tentativa")]
    [InlineData(typeof(AulaAssistida), "aula_assistida")]
    public void Tabelas_tem_nome_em_portugues(Type tipo, string tabela) =>
        Assert.Equal(tabela, Modelo.FindEntityType(tipo)!.GetTableName());

    [Fact]
    public void Sessao_tem_os_checks_de_tipo_tema_tempo_e_datas()
    {
        var checks = Entidade<SessaoEstudo>().GetCheckConstraints().ToDictionary(c => c.ModelName, c => c.Sql);

        Assert.Equal(
            ["ck_sessao_estudo_datas", "ck_sessao_estudo_tema", "ck_sessao_estudo_tempo_limite", "ck_sessao_estudo_tipo"],
            checks.Keys.Order());
        Assert.Equal("(tipo = 'licao') = (tema_id IS NOT NULL)", checks["ck_sessao_estudo_tema"]);
        Assert.Equal("concluida_em >= iniciada_em", checks["ck_sessao_estudo_datas"]);
        Assert.Contains("tipo = 'simulado'", checks["ck_sessao_estudo_tempo_limite"]);
    }

    [Fact]
    public void Check_de_tipo_aceita_exatamente_os_tipos_do_dominio()
    {
        var sql = Entidade<SessaoEstudo>().GetCheckConstraints().Single(c => c.ModelName == "ck_sessao_estudo_tipo").Sql;

        Assert.Equal([TipoSessao.Licao, TipoSessao.Simulado], TipoSessao.Todos);
        Assert.All(TipoSessao.Todos, t => Assert.Contains($"'{t}'", sql));
        Assert.Equal(TipoSessao.Todos.Length, sql.Count(ch => ch == '\'') / 2);
    }

    [Fact]
    public void Tentativa_tem_check_de_ordem_positiva() =>
        Assert.Equal("ordem > 0", Assert.Single(Entidade<Tentativa>().GetCheckConstraints()).Sql);

    [Fact]
    public void Tentativa_nao_repete_questao_nem_posicao_na_sessao()
    {
        var unicos = Entidade<Tentativa>().GetIndexes().Where(i => i.IsUnique).Select(i => Colunas(i.Properties)).ToList();

        Assert.Equal(2, unicos.Count);
        Assert.Contains(["sessao_estudo_id", "questao_id"], unicos);
        Assert.Contains(["sessao_estudo_id", "ordem"], unicos);
    }

    [Fact]
    public void Tentativa_nao_guarda_o_usuario()
    {
        // O dono vem da sessão: dois lugares com o mesmo dado poderiam discordar.
        Assert.DoesNotContain("usuario_id", Colunas(Entidade<Tentativa>().GetProperties()));
    }

    [Fact]
    public void Historico_do_aluno_tem_indice_por_usuario_e_data()
    {
        var ix = Assert.Single(Entidade<SessaoEstudo>().GetIndexes(),
            i => Colunas(i.Properties).SequenceEqual(["usuario_id", "concluida_em"]));
        Assert.False(ix.IsUnique);
    }

    [Fact]
    public void Aula_assistida_e_uma_marca_por_aluno_e_video()
    {
        var pk = Entidade<AulaAssistida>().FindPrimaryKey()!;
        Assert.Equal(["usuario_id", "videoaula_id"], Colunas(pk.Properties));
    }

    // Nome da FK no banco → o que acontece ao apagar o lado "pai".
    public static TheoryData<Type, string, DeleteBehavior> Fks => new()
    {
        { typeof(SessaoEstudo), "fk_sessao_estudo_usuario_usuario_id", DeleteBehavior.Cascade },
        { typeof(SessaoEstudo), "fk_sessao_estudo_disciplina_disciplina_id", DeleteBehavior.Restrict },
        { typeof(SessaoEstudo), "fk_sessao_estudo_tema_tema_id", DeleteBehavior.Restrict },
        { typeof(Tentativa), "fk_tentativa_sessao_estudo_sessao_estudo_id", DeleteBehavior.Cascade },
        { typeof(Tentativa), "fk_tentativa_questao_questao_id", DeleteBehavior.Restrict },
        { typeof(AulaAssistida), "fk_aula_assistida_usuario_usuario_id", DeleteBehavior.Cascade },
        { typeof(AulaAssistida), "fk_aula_assistida_videoaula_videoaula_id", DeleteBehavior.Restrict },
    };

    [Theory]
    [MemberData(nameof(Fks))]
    public void Fks_apagam_o_progresso_com_a_conta_e_protegem_o_conteudo(Type tipo, string nome, DeleteBehavior esperado)
    {
        var fk = Assert.Single(Modelo.FindEntityType(tipo)!.GetForeignKeys(), f => f.GetConstraintName() == nome);
        Assert.Equal(esperado, fk.DeleteBehavior);
    }

    [Fact]
    public void Nenhuma_fk_do_progresso_usa_o_nome_do_dbset_ou_do_identity()
    {
        var nomes = new[] { typeof(SessaoEstudo), typeof(Tentativa), typeof(AulaAssistida) }
            .SelectMany(t => Modelo.FindEntityType(t)!.GetForeignKeys())
            .Select(f => f.GetConstraintName()!)
            .ToList();

        Assert.Equal(7, nomes.Count); // as mesmas da teoria acima, nenhuma a mais
        Assert.All(nomes, n => Assert.DoesNotContain("asp_net", n));
        Assert.All(nomes, n => Assert.DoesNotMatch("_(temas|videoaulas|questoes|disciplinas)_", n));
    }

    [Fact]
    public void Datas_do_progresso_sao_timestamp_com_fuso()
    {
        var datas = new IProperty[]
        {
            Entidade<SessaoEstudo>().FindProperty(nameof(SessaoEstudo.IniciadaEm))!,
            Entidade<SessaoEstudo>().FindProperty(nameof(SessaoEstudo.ConcluidaEm))!,
            Entidade<Tentativa>().FindProperty(nameof(Tentativa.RespondidaEm))!,
            Entidade<AulaAssistida>().FindProperty(nameof(AulaAssistida.AssistidaEm))!,
        };
        Assert.All(datas, p => Assert.Equal("timestamp with time zone", p.GetColumnType()));
    }

    [Fact]
    public void Colunas_opcionais_sao_so_as_que_o_modelo_preve()
    {
        Assert.Equal(["tema_id", "tempo_limite_seg"],
            Colunas(Entidade<SessaoEstudo>().GetProperties().Where(p => p.IsNullable)).Order());
        // Em branco no simulado = alternativa nula.
        Assert.Equal(["alternativa_escolhida"],
            Colunas(Entidade<Tentativa>().GetProperties().Where(p => p.IsNullable)));
    }

    [Fact]
    public void Sessao_nova_comeca_como_licao_sem_tentativas_e_sem_treino()
    {
        var s = new SessaoEstudo();
        Assert.Equal(TipoSessao.Licao, s.Tipo);
        Assert.Empty(s.Tentativas);
        Assert.False(s.Treino);
        Assert.Null(s.TemaId);
        Assert.Null(s.TempoLimiteSeg);
    }
}
