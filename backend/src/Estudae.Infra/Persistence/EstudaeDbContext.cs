using Estudae.Domain.Conteudo;
using Estudae.Infra.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Estudae.Infra.Persistence;

public class EstudaeDbContext(DbContextOptions<EstudaeDbContext> options)
    : IdentityDbContext<Usuario>(options)
{
    public DbSet<Disciplina> Disciplinas => Set<Disciplina>();
    public DbSet<Tema> Temas => Set<Tema>();
    public DbSet<Videoaula> Videoaulas => Set<Videoaula>();
    public DbSet<Questao> Questoes => Set<Questao>();
    public DbSet<Imagem> Imagens => Set<Imagem>();

    // Curadoria pedagógica (tabelas aditivas; ver Conteudo/MetadadosQuestao.cs).
    public DbSet<Habilidade> Habilidades => Set<Habilidade>();
    public DbSet<MetadadosQuestao> MetadadosQuestoes => Set<MetadadosQuestao>();
    public DbSet<QuestaoHabilidadeSecundaria> QuestaoHabilidadesSecundarias => Set<QuestaoHabilidadeSecundaria>();
    public DbSet<VideoaulaHabilidade> VideoaulaHabilidades => Set<VideoaulaHabilidade>();
    public DbSet<ConfiguracaoPedagogicaDisciplina> ConfiguracoesPedagogicas => Set<ConfiguracaoPedagogicaDisciplina>();

    private Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction? _transacaoConteudo;
    private Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction? _bloqueioConteudo;

    public async Task BloquearConteudoAsync(CancellationToken ct = default)
    {
        if (_bloqueioConteudo is not null && ReferenceEquals(_bloqueioConteudo, Database.CurrentTransaction))
            return;
        if (ChangeTracker.HasChanges())
            throw new InvalidOperationException("Inicie a importação sem alterações pendentes no contexto.");
        if (Database.CurrentTransaction is null)
            _transacaoConteudo = await Database.BeginTransactionAsync(System.Data.IsolationLevel.ReadCommitted, ct);
        else if (Microsoft.EntityFrameworkCore.Storage.DbContextTransactionExtensions.GetDbTransaction(Database.CurrentTransaction)
                     .IsolationLevel != System.Data.IsolationLevel.ReadCommitted)
            throw new InvalidOperationException("A importação exige uma transação ReadCommitted.");
        await Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(73682194012026)", ct);
        ChangeTracker.Clear();
        _bloqueioConteudo = Database.CurrentTransaction;
    }

    public override async Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken ct = default)
    {
        var transacao = _transacaoConteudo;
        try
        {
            var resultado = await base.SaveChangesAsync(acceptAllChangesOnSuccess, ct);
            if (transacao is not null) await transacao.CommitAsync(ct);
            return resultado;
        }
        finally
        {
            if (transacao is not null)
            {
                await transacao.DisposeAsync();
                _transacaoConteudo = null;
                _bloqueioConteudo = null;
            }
        }
    }

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        var transacao = _transacaoConteudo;
        try
        {
            var resultado = base.SaveChanges(acceptAllChangesOnSuccess);
            transacao?.Commit();
            return resultado;
        }
        finally
        {
            if (transacao is not null)
            {
                transacao.Dispose();
                _transacaoConteudo = null;
                _bloqueioConteudo = null;
            }
        }
    }

    protected override void OnModelCreating(ModelBuilder builder)
    {
        // Primeiro o Identity monta o modelo dele; depois sobrescrevemos os nomes.
        base.OnModelCreating(builder);

        // Conteúdo: um IEntityTypeConfiguration por entidade, em Configuracoes/.
        builder.ApplyConfigurationsFromAssembly(typeof(EstudaeDbContext).Assembly);

        // Nomes em português (ver backend/DatabaseDocs/ModelodeDados.md). Só as
        // tabelas são traduzidas; as colunas ficam em snake_case via convenção.
        builder.Entity<Usuario>().ToTable("usuario");
        builder.Entity<IdentityRole>().ToTable("papel");
        builder.Entity<IdentityUserRole<string>>().ToTable("usuario_papel");
        builder.Entity<IdentityUserClaim<string>>().ToTable("usuario_claim");
        builder.Entity<IdentityUserLogin<string>>().ToTable("usuario_login");
        builder.Entity<IdentityUserToken<string>>().ToTable("usuario_token");
        builder.Entity<IdentityRoleClaim<string>>().ToTable("papel_claim");

        // O Identity dá nomes fixos a três índices (EmailIndex, UserNameIndex,
        // RoleNameIndex), que a convenção de snake_case não alcança.
        builder.Entity<Usuario>().HasIndex(u => u.NormalizedEmail).HasDatabaseName("ix_usuario_normalized_email");
        builder.Entity<Usuario>().HasIndex(u => u.NormalizedUserName).HasDatabaseName("ix_usuario_normalized_user_name");
        builder.Entity<IdentityRole>().HasIndex(p => p.NormalizedName).HasDatabaseName("ix_papel_normalized_name");

        builder.Entity<Usuario>().Property(u => u.Nome).HasMaxLength(150);
    }
}
