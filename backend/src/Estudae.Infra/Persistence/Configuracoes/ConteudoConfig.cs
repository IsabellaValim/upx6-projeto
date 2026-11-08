using Estudae.Domain.Conteudo;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Estudae.Infra.Persistence.Configuracoes;

// Mapeamento das tabelas de conteúdo. Fica na Infra para o Domain continuar sem
// depender do EF Core. Nomes de coluna em snake_case vêm da convenção global.
//
// DeleteBehavior.Restrict em todas as FKs: apagar uma disciplina ou um tema que
// ainda tem filhos dá erro, em vez de levar questões e vídeos junto em cascata.

public class DisciplinaConfig : IEntityTypeConfiguration<Disciplina>
{
    public void Configure(EntityTypeBuilder<Disciplina> e)
    {
        e.ToTable("disciplina");
        e.Property(d => d.Nome).HasMaxLength(100);
        e.Property(d => d.Slug).HasMaxLength(60);
        e.Property(d => d.Icone).HasMaxLength(60);
        e.HasIndex(d => d.Slug).IsUnique();
    }
}

public class TemaConfig : IEntityTypeConfiguration<Tema>
{
    public void Configure(EntityTypeBuilder<Tema> e)
    {
        e.ToTable("tema");
        e.Property(t => t.Slug).HasMaxLength(80);
        e.Property(t => t.Titulo).HasMaxLength(150);
        // O slug só precisa ser único dentro da disciplina.
        e.HasIndex(t => new { t.DisciplinaId, t.Slug }).IsUnique();
        e.HasOne(t => t.Disciplina)
            .WithMany(d => d.Temas)
            .HasForeignKey(t => t.DisciplinaId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class VideoaulaConfig : IEntityTypeConfiguration<Videoaula>
{
    public void Configure(EntityTypeBuilder<Videoaula> e)
    {
        e.ToTable("videoaula");
        e.Property(v => v.Titulo).HasMaxLength(200);
        e.Property(v => v.YoutubeId).HasMaxLength(11);
        e.Property(v => v.Tipo).HasMaxLength(40);
        // Chave natural do vídeo para o importador: o mesmo vídeo não entra duas
        // vezes no mesmo tema, e reimportar atualiza em vez de duplicar.
        e.HasIndex(v => new { v.TemaId, v.YoutubeId }).IsUnique();
        e.HasOne(v => v.Tema)
            .WithMany(t => t.Videoaulas)
            .HasForeignKey(v => v.TemaId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class QuestaoConfig : IEntityTypeConfiguration<Questao>
{
    public void Configure(EntityTypeBuilder<Questao> e)
    {
        e.ToTable("questao", t => t.HasCheckConstraint(
            "ck_questao_status", "status IN ('rascunho', 'publicada')"));

        e.Property(q => q.Codigo).HasMaxLength(60);
        e.HasIndex(q => q.Codigo).IsUnique();

        // List<string> vira text[] (array nativo do Postgres) pelo Npgsql.
        e.Property(q => q.Alternativas).HasColumnType("text[]");

        e.Property(q => q.ImagemUrl).HasMaxLength(500);
        e.Property(q => q.ProvaEdicao).HasMaxLength(40);
        e.Property(q => q.ProvaNivel).HasMaxLength(40);

        // Enum no C#, texto legível no banco ("rascunho"/"publicada").
        e.Property(q => q.Status)
            .HasMaxLength(20)
            .HasConversion(
                s => s == StatusQuestao.Publicada ? "publicada" : "rascunho",
                s => s == "publicada" ? StatusQuestao.Publicada : StatusQuestao.Rascunho);

        // Consulta mais comum do site: questões publicadas de um tema.
        e.HasIndex(q => new { q.TemaId, q.Status });

        e.HasOne(q => q.Tema)
            .WithMany(t => t.Questoes)
            .HasForeignKey(q => q.TemaId)
            // Sem isto a convenção geraria "fk_questao_temas_tema_id" (nome do DbSet).
            .HasConstraintName("fk_questao_tema_tema_id")
            .OnDelete(DeleteBehavior.Restrict);
    }
}
