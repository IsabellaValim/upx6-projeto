using Estudae.Domain.Progresso;
using Estudae.Infra.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Estudae.Infra.Persistence.Configuracoes;

// Mapeamento do progresso do aluno. As regras ficam também no banco (CHECKs e
// índices únicos), para não depender só do código da API.
//
// FKs: Cascade do usuário para o progresso (excluir a conta apaga tudo dele) e da
// sessão para as tentativas; Restrict para o conteúdo (o importador nunca apaga, e
// um tema com progresso de alguém não some por engano).
//
// HasConstraintName nas FKs para usuario, tema e videoaula: sem ele a convenção
// usaria o nome do DbSet ou do Identity ("asp_net_users", "temas", "videoaulas").

public class SessaoEstudoConfig : IEntityTypeConfiguration<SessaoEstudo>
{
    public void Configure(EntityTypeBuilder<SessaoEstudo> e)
    {
        e.ToTable("sessao_estudo", t =>
        {
            t.HasCheckConstraint("ck_sessao_estudo_tipo", "tipo IN ('licao', 'simulado')");
            // Lição tem tema; simulado é da disciplina inteira.
            t.HasCheckConstraint("ck_sessao_estudo_tema", "(tipo = 'licao') = (tema_id IS NOT NULL)");
            t.HasCheckConstraint("ck_sessao_estudo_tempo_limite",
                "tempo_limite_seg IS NULL OR (tipo = 'simulado' AND tempo_limite_seg > 0)");
            t.HasCheckConstraint("ck_sessao_estudo_datas", "concluida_em >= iniciada_em");
        });

        e.Property(s => s.Tipo).HasMaxLength(20);

        e.HasOne<Usuario>()
            .WithMany()
            .HasForeignKey(s => s.UsuarioId)
            .HasConstraintName("fk_sessao_estudo_usuario_usuario_id")
            .OnDelete(DeleteBehavior.Cascade);
        e.HasOne(s => s.Disciplina)
            .WithMany()
            .HasForeignKey(s => s.DisciplinaId)
            .OnDelete(DeleteBehavior.Restrict);
        e.HasOne(s => s.Tema)
            .WithMany()
            .HasForeignKey(s => s.TemaId)
            .HasConstraintName("fk_sessao_estudo_tema_tema_id")
            .OnDelete(DeleteBehavior.Restrict);

        // Histórico do aluno (mais recentes primeiro) e "dias seguidos".
        e.HasIndex(s => new { s.UsuarioId, s.ConcluidaEm });
    }
}

public class TentativaConfig : IEntityTypeConfiguration<Tentativa>
{
    public void Configure(EntityTypeBuilder<Tentativa> e)
    {
        e.ToTable("tentativa", t =>
            t.HasCheckConstraint("ck_tentativa_ordem", "ordem > 0"));

        e.HasOne(t => t.SessaoEstudo)
            .WithMany(s => s.Tentativas)
            .HasForeignKey(t => t.SessaoEstudoId)
            .OnDelete(DeleteBehavior.Cascade);
        e.HasOne(t => t.Questao)
            .WithMany()
            .HasForeignKey(t => t.QuestaoId)
            .OnDelete(DeleteBehavior.Restrict);

        // A mesma questão não aparece duas vezes na sessão, nem duas na mesma posição.
        e.HasIndex(t => new { t.SessaoEstudoId, t.QuestaoId }).IsUnique();
        e.HasIndex(t => new { t.SessaoEstudoId, t.Ordem }).IsUnique();
        // "Questões acertadas ao menos uma vez" parte da questão.
        e.HasIndex(t => t.QuestaoId);
    }
}

public class AulaAssistidaConfig : IEntityTypeConfiguration<AulaAssistida>
{
    public void Configure(EntityTypeBuilder<AulaAssistida> e)
    {
        e.ToTable("aula_assistida");
        // Uma marca por aluno e vídeo: a chave composta já impede duplicar.
        e.HasKey(a => new { a.UsuarioId, a.VideoaulaId });

        e.HasOne<Usuario>()
            .WithMany()
            .HasForeignKey(a => a.UsuarioId)
            .HasConstraintName("fk_aula_assistida_usuario_usuario_id")
            .OnDelete(DeleteBehavior.Cascade);
        e.HasOne(a => a.Videoaula)
            .WithMany()
            .HasForeignKey(a => a.VideoaulaId)
            .HasConstraintName("fk_aula_assistida_videoaula_videoaula_id")
            .OnDelete(DeleteBehavior.Restrict);
    }
}
