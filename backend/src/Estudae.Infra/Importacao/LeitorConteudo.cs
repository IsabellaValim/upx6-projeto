using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Estudae.Infra.Importacao;

public static class LeitorConteudo
{
    private static readonly JsonSerializerOptions Opcoes = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        // Campo desconhecido é erro: "resposta_corecta" não pode passar em silêncio.
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true,
    };

    // Lê o JSON e normaliza os textos. Erro de sintaxe ou de tipo vira um
    // ErroImportacao com o caminho e a linha, em vez de uma exceção.
    public static (ArquivoConteudo? Arquivo, ErroImportacao? Erro) Ler(string json)
    {
        try
        {
            var arquivo = JsonSerializer.Deserialize<ArquivoConteudo>(json, Opcoes);
            if (arquivo is null)
                return (null, new ErroImportacao("arquivo", "-", "o arquivo está vazio (null)"));
            Normalizar(arquivo);
            return (arquivo, null);
        }
        catch (JsonException ex)
        {
            var linha = ex.LineNumber is { } l ? $"linha {l + 1}" : "linha desconhecida";
            var motivo = ex.Message.Contains("could not be mapped")
                ? "campo desconhecido (erro de digitação no nome do campo?)"
                : "JSON inválido ou valor do tipo errado (texto onde deveria ser número, por exemplo)";
            return (null, new ErroImportacao($"arquivo, {linha}", ex.Path ?? "-", $"{motivo}. Detalhe: {ex.Message}"));
        }
    }

    // Normaliza para o texto gravado ser previsível. A correção compara TEXTO, então
    // "é" escrito como um caractere ou como "e" + acento precisa virar a mesma coisa (NFC).
    private static void Normalizar(ArquivoConteudo a)
    {
        if (a.Disciplina is { } d)
        {
            d.Slug = N(d.Slug); d.Nome = N(d.Nome); d.Icone = N(d.Icone);
        }
        foreach (var t in a.Temas ?? [])
        {
            if (t is null) continue;
            t.Slug = N(t.Slug); t.Titulo = N(t.Titulo); t.Sobre = N(t.Sobre);
            foreach (var v in t.Videos ?? [])
            {
                if (v is null) continue;
                v.Youtube = N(v.Youtube); v.Titulo = N(v.Titulo);
            }
            foreach (var q in t.Questoes ?? [])
            {
                if (q is null) continue;
                q.Codigo = N(q.Codigo); q.TextoBase = N(q.TextoBase); q.Enunciado = N(q.Enunciado);
                q.RespostaCorreta = N(q.RespostaCorreta); q.Resolucao = N(q.Resolucao);
                q.ProvaEdicao = N(q.ProvaEdicao); q.ProvaNivel = N(q.ProvaNivel);
                q.Alternativas = q.Alternativas?.Select(N).ToList();
            }
        }
    }

    // Texto vazio vira null, para o validador tratar "" e campo ausente do mesmo jeito.
    private static string? N(string? s)
    {
        if (s is null) return null;
        var t = s.Replace("\r\n", "\n").Replace('\r', '\n').Trim().Normalize(NormalizationForm.FormC);
        return t.Length == 0 ? null : t;
    }
}
