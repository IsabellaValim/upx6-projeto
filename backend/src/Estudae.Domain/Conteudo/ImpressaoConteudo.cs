using System.Security.Cryptography;
using System.Text;

namespace Estudae.Domain.Conteudo;

// Impressão digital do conteúdo avaliado numa revisão pedagógica. Cobre tudo
// que poderia mudar o sentido da questão ou a classificação: disciplina/tema,
// textos, alternativas, gabarito, resolução e a imagem (por caminho, descrição
// e SHA-256 dos bytes). Se qualquer parte mudar, a impressão muda e a revisão
// anterior deixa de valer — sem apagar o registro da curadoria.
public static class ImpressaoConteudo
{
    // Separadores invisíveis para "ab" + "c" não colidir com "a" + "bc".
    private const string Sep = "\u001f";
    private const string SepLista = "\u001e";

    public static string Calcular(Questao q, string disciplinaSlug, string temaSlug, string? imagemSha256) =>
        Calcular(disciplinaSlug, temaSlug, q.TextoBase, q.Enunciado, q.Alternativas,
            q.RespostaCorreta, q.Resolucao, q.ImagemUrl, q.ImagemDescricao, imagemSha256);

    public static string Calcular(
        string disciplinaSlug, string temaSlug,
        string? textoBase, string enunciado, IReadOnlyList<string> alternativas,
        string respostaCorreta, string resolucao,
        string? imagemUrl, string? imagemDescricao, string? imagemSha256)
    {
        var bruto = System.Text.Json.JsonSerializer.SerializeToUtf8Bytes(new object?[]
        {
            disciplinaSlug, temaSlug, textoBase, enunciado, alternativas,
            respostaCorreta, resolucao, imagemUrl, imagemDescricao, imagemSha256,
        });
        return Convert.ToHexStringLower(SHA256.HashData(bruto));
    }
}
