namespace Estudae.Infra.Importacao;

// Formato do arquivo de curadoria pedagógica: um JSON por disciplina,
// SEPARADO do arquivo de conteúdo — a classificação nunca reescreve dados da
// prova. Referências são por slugs/codigo (chaves naturais), nunca por id.
//
// Tudo anulável de propósito: campo faltando vira erro de validação com nome
// e caminho, em vez de quebrar a leitura (mesmo padrão do ArquivoConteudo).
// A "ordem" das habilidades é a posição na lista.
//
// Semântica da aplicação: o arquivo é a fonte da verdade para o que declara.
// Para cada questão/vídeo listado, o conjunto de vínculos é substituído por
// completo; o que não aparece no arquivo não é tocado (omissão não revoga).

public sealed class ArquivoPedagogia
{
    // Versão do formato; hoje só existe a 1.
    public int? Formato { get; set; }
    // Quem assina a curadoria (decisão humana, não autenticação digital).
    public string? Revisor { get; set; }
    public string? Disciplina { get; set; }
    public MatrizJson? Matriz { get; set; }
    public List<TemaPedagogiaJson>? Temas { get; set; }
}

public sealed class MatrizJson
{
    // Identificação da matriz oficial usada como referência (ex.: "encceja-ef-2022").
    public string? Versao { get; set; }
    // Só true quando a cobertura da área inteira foi conferida pelo revisor.
    public bool? Validada { get; set; }
}

public sealed class TemaPedagogiaJson
{
    public string? Slug { get; set; }
    public List<HabilidadeJson>? Habilidades { get; set; }
    public List<VideoPedagogiaJson>? Videos { get; set; }
    public List<QuestaoPedagogiaJson>? Questoes { get; set; }
}

public sealed class HabilidadeJson
{
    public string? Slug { get; set; }
    public string? Titulo { get; set; }
    // Omitido = true (habilidades são essenciais até decisão em contrário).
    public bool? Essencial { get; set; }
    public string? ReferenciaOficial { get; set; }
}

public sealed class VideoPedagogiaJson
{
    // Link completo do YouTube ou só o ID de 11 caracteres (mesmo do conteúdo).
    public string? Youtube { get; set; }
    // Slugs das habilidades que a aula cobre; lista vazia remove os vínculos.
    public List<string?>? Habilidades { get; set; }
}

public sealed class QuestaoPedagogiaJson
{
    public string? Codigo { get; set; }
    public string? Habilidade { get; set; }
    public List<string?>? Secundarias { get; set; }
    public string? Familia { get; set; }
    // "introdutoria" | "intermediaria" | "avancada" — opinião curatorial.
    public string? Dificuldade { get; set; }
    public string? Tipo { get; set; }
    // "pendente" | "aprovada" | "rejeitada"; omitido = "pendente".
    public string? Revisao { get; set; }
    // Pedido de elegibilidade do revisor; a elegibilidade EFETIVA ainda exige
    // publicada + aprovada + impressão conferindo + imagem válida.
    public bool? Elegivel { get; set; }
    // Impressão esperada do conteúdo (opcional): se o arquivo informa um hash
    // que não bate com o conteúdo atual, a importação aborta — o revisor
    // classificou uma versão que não é a que está no banco.
    public string? Impressao { get; set; }
}
