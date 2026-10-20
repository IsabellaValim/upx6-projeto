using Estudae.Infra.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Estudae.Infra.Persistence;

public class EstudaeDbContext(DbContextOptions<EstudaeDbContext> options)
    : IdentityDbContext<Usuario>(options)
{
    protected override void OnModelCreating(ModelBuilder builder)
    {
        // Primeiro o Identity monta o modelo dele; depois sobrescrevemos os nomes.
        base.OnModelCreating(builder);

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
