namespace Estudae.Domain.Conteudo;

// Habilidade secundária de uma questão (ex.: uma questão de juros que também
// exercita leitura de tabela). Chave composta (questao, habilidade): a mesma
// habilidade não pode aparecer duas vezes — nem como principal e secundária,
// regra conferida pelo importador pedagógico.
//
// Secundária não conta cobertura nem multiplica evidência na primeira versão
// do motor; serve para recomendar e explicar.
public class QuestaoHabilidadeSecundaria
{
    // Aponta para metadados_questao.questao_id (PK da 1:1): habilidade
    // secundária só existe junto da classificação da questão.
    public int QuestaoId { get; set; }
    public MetadadosQuestao Metadados { get; set; } = null!;

    public int HabilidadeId { get; set; }
    public Habilidade Habilidade { get; set; } = null!;
}
