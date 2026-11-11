using Estudae.Domain.Conteudo;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Estudae.Infra.Persistence.Configuracoes;

// Tabelas da curadoria pedagógica (Fase 1b do Estudaê Inteligente). Tudo é
// aditivo: nenhuma tabela de conteúdo muda. FKs Restrict como no resto do
// modelo: não se apaga tema/questão com classificação pendurada.

public class HabilidadeConfig : IEntityTypeConfiguration<Habilidade>
{
    public void Configure(EntityTypeBuilder<Habilidade> e)
    {
        e.ToTable("habilidade");
        e.Property(h => h.Slug).HasMaxLength(80);
        e.Property(h => h.Titulo).HasMaxLength(200);
        e.Property(h => h.ReferenciaOficial).HasMaxLength(80);
        e.Property(h => h.Essencial).HasDefaultValue(true);
        e.HasIndex(h => new { h.TemaId, h.Slug }).IsUnique();
        e.HasOne(h => h.Tema)
            .WithMany(t => t.Habilidades)
            .HasForeignKey(h => h.TemaId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class MetadadosQuestaoConfig : IEntityTypeConfiguration<MetadadosQuestao>
{
    public void Configure(EntityTypeBuilder<MetadadosQuestao> e)
    {
        e.ToTable("metadados_questao", t =>
        {
            t.HasCheckConstraint("ck_metadados_questao_status",
                "status_revisao IN ('pendente', 'aprovada', 'rejeitada')");
            t.HasCheckConstraint("ck_metadados_questao_dificuldade",
                "dificuldade IS NULL OR dificuldade IN ('introdutoria', 'intermediaria', 'avancada')");
        });

        // PK = FK da 1:1: uma linha de classificação por questão.
        e.HasKey(m => m.QuestaoId);
        e.HasOne(m => m.Questao)
            .WithOne(q => q.Metadados)
            .HasForeignKey<MetadadosQuestao>(m => m.QuestaoId)
            .HasConstraintName("fk_metadados_questao_questao")
            .OnDelete(DeleteBehavior.Restrict);

        e.HasOne(m => m.HabilidadePrincipal)
            .WithMany()
            .HasForeignKey(m => m.HabilidadePrincipalId)
            .OnDelete(DeleteBehavior.Restrict);

        e.Property(m => m.Familia).HasMaxLength(80);
        e.Property(m => m.Tipo).HasMaxLength(60);
        e.Property(m => m.Revisor).HasMaxLength(150);
        e.Property(m => m.ImpressaoConteudo).HasMaxLength(64).IsFixedLength();

        // Enums como texto legível, como status da questão (métodos, não switch:
        // a árvore de expressão do HasConversion não aceita switch).
        e.Property(m => m.StatusRevisao)
            .HasMaxLength(20)
            .HasConversion(s => RevisaoTexto(s), s => RevisaoEnum(s));
        e.Property(m => m.Dificuldade)
            .HasMaxLength(20)
            .HasConversion(d => d == null ? null : DificuldadeTexto(d.Value), s => s == null ? null : DificuldadeEnum(s));

        // Consulta frequente do índice pedagógico: por família e por habilidade.
        e.HasIndex(m => m.Familia);
        e.HasIndex(m => m.HabilidadePrincipalId);
    }

    private static string RevisaoTexto(StatusRevisao s) => s switch
    {
        StatusRevisao.Aprovada => "aprovada",
        StatusRevisao.Rejeitada => "rejeitada",
        _ => "pendente",
    };

    private static StatusRevisao RevisaoEnum(string s) => s switch
    {
        "aprovada" => StatusRevisao.Aprovada,
        "rejeitada" => StatusRevisao.Rejeitada,
        _ => StatusRevisao.Pendente,
    };

    private static string DificuldadeTexto(DificuldadeCuratorial d) => d switch
    {
        DificuldadeCuratorial.Introdutoria => "introdutoria",
        DificuldadeCuratorial.Intermediaria => "intermediaria",
        _ => "avancada",
    };

    private static DificuldadeCuratorial DificuldadeEnum(string s) => s switch
    {
        "introdutoria" => DificuldadeCuratorial.Introdutoria,
        "intermediaria" => DificuldadeCuratorial.Intermediaria,
        _ => DificuldadeCuratorial.Avancada,
    };
}

public class QuestaoHabilidadeSecundariaConfig : IEntityTypeConfiguration<QuestaoHabilidadeSecundaria>
{
    public void Configure(EntityTypeBuilder<QuestaoHabilidadeSecundaria> e)
    {
        e.ToTable("questao_habilidade_secundaria");
        e.HasKey(s => new { s.QuestaoId, s.HabilidadeId });
        e.HasOne(s => s.Metadados)
            .WithMany(m => m.Secundarias)
            .HasForeignKey(s => s.QuestaoId)
            .OnDelete(DeleteBehavior.Restrict);
        e.HasOne(s => s.Habilidade)
            .WithMany(h => h.Questoes)
            .HasForeignKey(s => s.HabilidadeId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class VideoaulaHabilidadeConfig : IEntityTypeConfiguration<VideoaulaHabilidade>
{
    public void Configure(EntityTypeBuilder<VideoaulaHabilidade> e)
    {
        e.ToTable("videoaula_habilidade");
        e.HasKey(v => new { v.VideoaulaId, v.HabilidadeId });
        e.HasOne(v => v.Videoaula)
            .WithMany(a => a.Habilidades)
            .HasForeignKey(v => v.VideoaulaId)
            .OnDelete(DeleteBehavior.Restrict);
        e.HasOne(v => v.Habilidade)
            .WithMany(h => h.Videoaulas)
            .HasForeignKey(v => v.HabilidadeId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class ConfiguracaoPedagogicaConfig : IEntityTypeConfiguration<ConfiguracaoPedagogicaDisciplina>
{
    public void Configure(EntityTypeBuilder<ConfiguracaoPedagogicaDisciplina> e)
    {
        e.ToTable("configuracao_pedagogica");
        e.HasKey(c => c.DisciplinaId);
        e.Property(c => c.VersaoMatriz).HasMaxLength(80);
        e.Property(c => c.Revisor).HasMaxLength(150);
        e.HasOne(c => c.Disciplina)
            .WithOne(d => d.Pedagogia)
            .HasForeignKey<ConfiguracaoPedagogicaDisciplina>(c => c.DisciplinaId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
