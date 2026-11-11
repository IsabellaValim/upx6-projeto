namespace Estudae.Domain.Conteudo;

// Classificação pedagógica de uma questão (1:1). Fica em tabela separada de
// propósito: o conteúdo oficial (enunciado, gabarito, prova) é imutável pela
// curadoria; a classificação é independente e versionada.
//
// Elegibilidade EFETIVA (pode virar evidência de domínio) =
//   questão publicada
//   + StatusRevisao == Aprovada
//   + ConteudoConfere (o conteúdo não mudou depois da aprovação)
//   + habilidade principal e família preenchidas
//   + imagem válida, quando a questão usa uma.
// Tudo que a migration cria nasce inelegível (Pendente + ConteudoConfere = false).
public class MetadadosQuestao
{
    // PK = FK da 1:1: uma classificação por questão.
    public int QuestaoId { get; set; }
    public Questao Questao { get; set; } = null!;

    public int HabilidadePrincipalId { get; set; }
    public Habilidade HabilidadePrincipal { get; set; } = null!;

    // Questões da mesma família medem a mesma coisa: repetir família não conta
    // como evidência nova. O slug é estável dentro da disciplina e não pode
    // ser usado em dois temas diferentes.
    public string Familia { get; set; } = string.Empty;

    public string? Tipo { get; set; }
    public DificuldadeCuratorial? Dificuldade { get; set; }

    public StatusRevisao StatusRevisao { get; set; } = StatusRevisao.Pendente;
    // O revisor pediu elegibilidade para evidência. A elegibilidade EFETIVA ainda
    // exige publicação + aprovação + impressão conferindo + metadados completos.
    public bool ElegibilidadeSolicitada { get; set; }
    // Se o conteúdo mudou depois da última revisão aprovada (qualquer campo que
    // entra na impressão), a revisão deixa de valer e a flag vai a false.
    public bool ConteudoConfere { get; set; }
    // SHA-256 do conteúdo aprovado na última revisão (ver ImpressaoConteudo).
    // Guardado para proveniência mesmo depois de invalidado.
    public string? ImpressaoConteudo { get; set; }
    public string? Revisor { get; set; }
    public DateTime? RevisadoEm { get; set; }
    // Versão da classificação: sobe a cada mudança de família/habilidade/etc.,
    // para o cliente detectar que os metadados mudaram no meio de uma sessão.
    public int Versao { get; set; } = 1;

    public List<QuestaoHabilidadeSecundaria> Secundarias { get; set; } = [];
}

public enum StatusRevisao
{
    Pendente,
    Aprovada,
    Rejeitada,
}

// Dificuldade é curatorial (opinião do revisor), não calibração estatística.
public enum DificuldadeCuratorial
{
    Introdutoria,
    Intermediaria,
    Avancada,
}
