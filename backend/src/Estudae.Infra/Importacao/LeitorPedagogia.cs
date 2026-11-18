using System.Text.Json;
using System.Text.Json.Serialization;

namespace Estudae.Infra.Importacao;

// Leitura do arquivo de curadoria pedagógica. Mesmas regras do LeitorConteudo:
// JSON estrito (campo desconhecido é erro), chaves snake_case, normalização.
public static class LeitorPedagogia
{
    private static readonly JsonSerializerOptions Opcoes = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true,
    };

    public static (ArquivoPedagogia? Arquivo, ErroImportacao? Erro) Ler(string json)
    {
        try
        {
            var arquivo = JsonSerializer.Deserialize<ArquivoPedagogia>(json, Opcoes);
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
                : "JSON inválido ou valor do tipo errado";
            return (null, new ErroImportacao($"arquivo, {linha}", ex.Path ?? "-", $"{motivo}. Detalhe: {ex.Message}"));
        }
    }

    private static void Normalizar(ArquivoPedagogia a)
    {
        a.Revisor = LeitorConteudo.NormalizarTexto(a.Revisor);
        a.Disciplina = LeitorConteudo.NormalizarTexto(a.Disciplina);
        if (a.Matriz is { } m)
            m.Versao = LeitorConteudo.NormalizarTexto(m.Versao);
        foreach (var t in a.Temas ?? [])
        {
            if (t is null) continue;
            t.Slug = LeitorConteudo.NormalizarTexto(t.Slug);
            foreach (var h in t.Habilidades ?? [])
            {
                if (h is null) continue;
                h.Slug = LeitorConteudo.NormalizarTexto(h.Slug);
                h.Titulo = LeitorConteudo.NormalizarTexto(h.Titulo);
                h.ReferenciaOficial = LeitorConteudo.NormalizarTexto(h.ReferenciaOficial);
            }
            foreach (var v in t.Videos ?? [])
            {
                if (v is null) continue;
                v.Youtube = LeitorConteudo.NormalizarTexto(v.Youtube);
                v.Habilidades = v.Habilidades?.Select(LeitorConteudo.NormalizarTexto).ToList();
            }
            foreach (var q in t.Questoes ?? [])
            {
                if (q is null) continue;
                q.Codigo = LeitorConteudo.NormalizarTexto(q.Codigo);
                q.Habilidade = LeitorConteudo.NormalizarTexto(q.Habilidade);
                q.Secundarias = q.Secundarias?.Select(LeitorConteudo.NormalizarTexto).ToList();
                q.Familia = LeitorConteudo.NormalizarTexto(q.Familia);
                q.Dificuldade = LeitorConteudo.NormalizarTexto(q.Dificuldade);
                q.Tipo = LeitorConteudo.NormalizarTexto(q.Tipo);
                q.Revisao = LeitorConteudo.NormalizarTexto(q.Revisao);
                q.Impressao = LeitorConteudo.NormalizarTexto(q.Impressao);
            }
        }
    }
}
