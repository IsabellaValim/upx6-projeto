namespace Estudae.Infra.Importacao;

// Formato do arquivo de conteúdo: um JSON por disciplina (ver conteudo/README.md).
// As chaves no JSON são snake_case, iguais às colunas do banco.
//
// Tudo é anulável de propósito: campo faltando não quebra a leitura, vira erro de
// validação com o nome da questão e do campo (ver ValidadorConteudo).
// A "ordem" de temas e vídeos não está no arquivo: é a posição na lista.

public sealed class ArquivoConteudo
{
    public DisciplinaJson? Disciplina { get; set; }
    public List<TemaJson>? Temas { get; set; }
}

public sealed class DisciplinaJson
{
    public string? Slug { get; set; }
    public string? Nome { get; set; }
    public string? Icone { get; set; }
    // "fundamental" ou "medio"; omitido = "medio" (arquivos anteriores ao campo).
    public string? Nivel { get; set; }
}

public sealed class TemaJson
{
    public string? Slug { get; set; }
    public string? Titulo { get; set; }
    public string? Sobre { get; set; }
    public List<VideoJson>? Videos { get; set; }
    public List<QuestaoJson>? Questoes { get; set; }
}

public sealed class VideoJson
{
    // Link completo do YouTube ou só o ID de 11 caracteres.
    public string? Youtube { get; set; }
    public string? Titulo { get; set; }
    public int? DuracaoSegundos { get; set; }
}

public sealed class QuestaoJson
{
    public string? Codigo { get; set; }
    public string? TextoBase { get; set; }
    public string? Enunciado { get; set; }
    public List<string?>? Alternativas { get; set; }
    public string? RespostaCorreta { get; set; }
    public string? Resolucao { get; set; }
    public int? ProvaAno { get; set; }
    public string? ProvaEdicao { get; set; }
    public string? ProvaNivel { get; set; }
    public int? ProvaNumero { get; set; }
    // Recorte da prova quando a questão depende de figura, tabela, gráfico...
    public ImagemJson? Imagem { get; set; }
}

public sealed class ImagemJson
{
    // Caminho relativo a conteudo/imagens/ (ex.: "2022/2022_EM_regular_matematica_47.webp").
    public string? Arquivo { get; set; }
    // Texto alternativo: o que a imagem mostra, sem dar a resposta.
    public string? Descricao { get; set; }
}
