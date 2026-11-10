namespace Estudae.Domain.Conteudo;

// Imagem de conteúdo (recorte da prova: figura, tabela, gráfico...), guardada no
// próprio banco para o conteúdo inteiro viver nele e sair junto no dump.
//
// Caminho é a chave natural, o mesmo texto de Questao.ImagemUrl
// (ex.: "2022/2022_EM_regular_matematica_47.webp"); a API serve em
// /conteudo/imagens/{Caminho}. Tabela separada da questão: uma imagem pode
// existir antes de ter questão e pode servir a mais de uma.
public class Imagem
{
    public int Id { get; set; }
    public string Caminho { get; set; } = string.Empty;
    public string TipoMime { get; set; } = string.Empty;
    public byte[] Dados { get; set; } = [];
    // Hash dos bytes (hex): reimportar a mesma imagem não regrava nada, e a API
    // usa como ETag para o navegador revalidar sem baixar de novo.
    public string Sha256 { get; set; } = string.Empty;
    public DateTime AtualizadaEm { get; set; }
}
