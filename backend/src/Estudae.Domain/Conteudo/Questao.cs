namespace Estudae.Domain.Conteudo;

// Questão de múltipla escolha. As alternativas e a resposta correta são guardadas
// como TEXTO (não posição), para a ordem poder ser embaralhada na exibição.
public class Questao
{
    public int Id { get; set; }

    // Chave natural, ex.: "mat-porcentagem-001". É por ela que o importador
    // reconhece uma questão já existente e atualiza em vez de duplicar.
    public string Codigo { get; set; } = string.Empty;

    public int TemaId { get; set; }
    public Tema Tema { get; set; } = null!;

    public string? TextoBase { get; set; }
    public string Enunciado { get; set; } = string.Empty;
    public List<string> Alternativas { get; set; } = [];
    public string RespostaCorreta { get; set; } = string.Empty;
    public string Resolucao { get; set; } = string.Empty;
    // Recorte da questão como está na prova (figura, tabela, gráfico...), caminho
    // = Imagem.Caminho (ex.: "2022/2022_EM_regular_matematica_47.webp"); os bytes
    // ficam na tabela imagem.
    // A descrição é o texto alternativo, lido por leitor de tela e pela voz alta.
    public string? ImagemUrl { get; set; }
    public string? ImagemDescricao { get; set; }

    // Origem na prova original (ex.: Encceja 2019, Médio, questão 12).
    public int? ProvaAno { get; set; }
    public string? ProvaEdicao { get; set; }
    public string? ProvaNivel { get; set; }
    public int? ProvaNumero { get; set; }

    public StatusQuestao Status { get; set; } = StatusQuestao.Rascunho;
    public Guid RevisaoConteudo { get; set; }
    public DateTime CriadoEm { get; set; }

    // Classificação pedagógica (1:1, curadoria separada do conteúdo oficial).
    public MetadadosQuestao? Metadados { get; set; }
}

// O site só mostra questões publicadas.
public enum StatusQuestao
{
    Rascunho,
    Publicada,
}
