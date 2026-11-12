using Estudae.Domain.Conteudo;
using Estudae.Infra.Identity;
using Microsoft.AspNetCore.DataProtection.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Estudae.Infra.Persistence;

// IDataProtectionKeyContext: as chaves que assinam o cookie de sessão e os links
// de e-mail moram no banco (tabela chave_protecao). Dentro do container elas se
// perderiam a cada deploy, deslogando todo mundo e invalidando os links enviados.
public class EstudaeDbContext(DbContextOptions<EstudaeDbContext> options)
    : IdentityDbContext<Usuario>(options), IDataProtectionKeyContext
{
    public DbSet<Disciplina> Disciplinas => Set<Disciplina>();
    public DbSet<Tema> Temas => Set<Tema>();
    public DbSet<Videoaula> Videoaulas => Set<Videoaula>();
    public DbSet<Questao> Questoes => Set<Questao>();
    public DbSet<Imagem> Imagens => Set<Imagem>();
    public DbSet<DataProtectionKey> DataProtectionKeys => Set<DataProtectionKey>();

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
        builder.Entity<DataProtectionKey>().ToTable("chave_protecao");

        // O Identity dá nomes fixos a três índices (EmailIndex, UserNameIndex,
        // RoleNameIndex), que a convenção de snake_case não alcança.
        builder.Entity<Usuario>().HasIndex(u => u.NormalizedEmail).HasDatabaseName("ix_usuario_normalized_email");
        builder.Entity<Usuario>().HasIndex(u => u.NormalizedUserName).HasDatabaseName("ix_usuario_normalized_user_name");
        builder.Entity<IdentityRole>().HasIndex(p => p.NormalizedName).HasDatabaseName("ix_papel_normalized_name");

        builder.Entity<Usuario>().Property(u => u.Nome).HasMaxLength(150);
    }
}
