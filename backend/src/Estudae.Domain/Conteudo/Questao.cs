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
    public string? ImagemUrl { get; set; }

    // Origem na prova original (ex.: Encceja 2019, Médio, questão 12).
    public int? ProvaAno { get; set; }
    public string? ProvaEdicao { get; set; }
    public string? ProvaNivel { get; set; }
    public int? ProvaNumero { get; set; }

    public StatusQuestao Status { get; set; } = StatusQuestao.Rascunho;
    public DateTime CriadoEm { get; set; }
}

// O site só mostra questões publicadas.
public enum StatusQuestao
{
    Rascunho,
    Publicada,
}
