using System.Text.RegularExpressions;

namespace Estudae.Infra.Importacao;

// Validação PURA do arquivo de pedagogia (sem banco): formato, campos
// obrigatórios, enums e consistência interna. O que depende do banco
// (disciplina/tema/questão/vídeo existirem, impressão conferir) é validado
// pelo ImportadorPedagogia — tanto no --validar quanto no --aplicar.
public static partial class ValidadorPedagogia
{
    public const int FormatoAtual = 1;
    public static readonly string[] Revisoes = ["pendente", "aprovada", "rejeitada"];
    public static readonly string[] Dificuldades = ["introdutoria", "intermediaria", "avancada"];

    [GeneratedRegex("^[a-z0-9]+(-[a-z0-9]+)*$")]
    private static partial Regex FormatoSlug();

    [GeneratedRegex("^[0-9a-f]{64}$")]
    private static partial Regex Sha256Hex();

    public static List<ErroImportacao> Validar(ArquivoPedagogia arquivo)
    {
        var erros = new List<ErroImportacao>();
        void Erro(string onde, string campo, string msg) => erros.Add(new(onde, campo, msg));

        if (arquivo.Formato != FormatoAtual)
            Erro("arquivo", "formato", $"esperado {FormatoAtual}, recebido {(arquivo.Formato?.ToString() ?? "ausente")}");
        Slug(arquivo.Disciplina, "arquivo", "disciplina", 60);

        if (arquivo.Temas is null or { Count: 0 })
        {
            Erro("arquivo", "temas", "a lista de temas está vazia ou ausente");
            return erros;
        }

        var temComRevisao = false;
        var slugsTema = new HashSet<string>();
        var codigos = new HashSet<string>();

        for (var i = 0; i < arquivo.Temas.Count; i++)
        {
            var t = arquivo.Temas[i];
            var ondeTema = t?.Slug is { } s ? $"tema \"{s}\"" : $"tema nº {i + 1}";
            if (t is null) { Erro(ondeTema, "-", "tema vazio (null)"); continue; }

            if (Slug(t.Slug, ondeTema, "slug", 80) && !slugsTema.Add(t.Slug!))
                Erro(ondeTema, "slug", "repetido: dois blocos com o mesmo tema no arquivo");

            // Habilidades declaradas neste bloco (a checagem contra o banco é do importador).
            var habilidades = new HashSet<string>();
            for (var j = 0; j < (t.Habilidades?.Count ?? 0); j++)
            {
                var h = t.Habilidades![j];
                var ondeH = h?.Slug is { } hs ? $"{ondeTema}, habilidade \"{hs}\"" : $"{ondeTema}, habilidade nº {j + 1}";
                if (h is null) { Erro(ondeH, "-", "habilidade vazia (null)"); continue; }

                if (Slug(h.Slug, ondeH, "slug", 80) && !habilidades.Add(h.Slug!))
                    Erro(ondeH, "slug", "repetido no mesmo tema");
                Texto(h.Titulo, ondeH, "titulo", 200);
                Tamanho(h.ReferenciaOficial, ondeH, "referencia_oficial", 80);
            }

            // Vínculos de vídeo: a habilidade citada precisa estar declarada no
            // bloco (vínculo novo) ou já existir no banco — só o importador sabe.
            var videos = new HashSet<string>();
            for (var j = 0; j < (t.Videos?.Count ?? 0); j++)
            {
                var v = t.Videos![j];
                var ondeV = $"{ondeTema}, vídeo nº {j + 1}";
                if (v is null) { Erro(ondeV, "-", "vídeo vazio (null)"); continue; }

                if (v.Youtube is null)
                    Erro(ondeV, "youtube", "obrigatório (link do YouTube ou o ID de 11 caracteres)");
                else if (!YoutubeId.TentarExtrair(v.Youtube, out var youtubeId))
                    Erro(ondeV, "youtube", $"não consegui extrair um ID de 11 caracteres de \"{v.Youtube}\"");
                else if (!videos.Add(youtubeId))
                    Erro(ondeV, "youtube", "vídeo repetido no mesmo tema");

                var vistas = new HashSet<string>();
                for (var k = 0; k < (v.Habilidades?.Count ?? 0); k++)
                {
                    var hs = v.Habilidades![k];
                    if (hs is null) { Erro(ondeV, $"habilidades[{k}]", "vazia"); continue; }
                    if (!FormatoSlug().IsMatch(hs))
                        Erro(ondeV, $"habilidades[{k}]", $"\"{hs}\" não é um slug válido");
                    else if (!vistas.Add(hs))
                        Erro(ondeV, $"habilidades[{k}]", $"repetida: \"{hs}\"");
                }
            }

            for (var j = 0; j < (t.Questoes?.Count ?? 0); j++)
            {
                var q = t.Questoes![j];
                var ondeQ = q?.Codigo is { } c ? $"questão \"{c}\"" : $"{ondeTema}, questão nº {j + 1}";
                if (q is null) { Erro(ondeQ, "-", "questão vazia (null)"); continue; }

                if (Slug(q.Codigo, ondeQ, "codigo", 60) && !codigos.Add(q.Codigo!))
                    Erro(ondeQ, "codigo", "repetido no arquivo");

                Slug(q.Habilidade, ondeQ, "habilidade", 80);
                Slug(q.Familia, ondeQ, "familia", 80);

                var secundarias = new HashSet<string>();
                for (var k = 0; k < (q.Secundarias?.Count ?? 0); k++)
                {
                    var hs = q.Secundarias![k];
                    var campo = $"secundarias[{k}]";
                    if (hs is null) { Erro(ondeQ, campo, "vazia"); continue; }
                    if (!FormatoSlug().IsMatch(hs))
                        Erro(ondeQ, campo, $"\"{hs}\" não é um slug válido");
                    else if (!secundarias.Add(hs))
                        Erro(ondeQ, campo, $"repetida: \"{hs}\"");
                }
                if (q.Habilidade is not null && secundarias.Contains(q.Habilidade))
                    Erro(ondeQ, "secundarias", "a habilidade principal não pode aparecer também como secundária");

                if (q.Dificuldade is not null && !Dificuldades.Contains(q.Dificuldade))
                    Erro(ondeQ, "dificuldade",
                        $"\"{q.Dificuldade}\" inválida: use {string.Join(", ", Dificuldades)} (ou omita)");
                Tamanho(q.Tipo, ondeQ, "tipo", 60);

                var revisao = q.Revisao ?? "pendente";
                if (!Revisoes.Contains(revisao))
                    Erro(ondeQ, "revisao", $"\"{q.Revisao}\" inválida: use {string.Join(", ", Revisoes)} (ou omita)");
                if (revisao is "aprovada" or "rejeitada")
                    temComRevisao = true;

                if (revisao == "aprovada" && q.Impressao is null)
                    Erro(ondeQ, "impressao", "obrigatória para aprovar o conteúdo revisado");
                if (q.Impressao is not null && !Sha256Hex().IsMatch(q.Impressao))
                    Erro(ondeQ, "impressao", "precisa ser o SHA-256 em hexadecimal (64 caracteres minúsculos)");
            }
        }

        // Aprovação/rejeição é decisão humana: o arquivo precisa dizer quem revisou.
        if ((temComRevisao || arquivo.Matriz?.Validada == true) && string.IsNullOrWhiteSpace(arquivo.Revisor))
            Erro("arquivo", "revisor", "obrigatório quando o arquivo aprova ou rejeita classificações");
        Tamanho(arquivo.Revisor, "arquivo", "revisor", 150);

        if (arquivo.Matriz is { } m)
            Tamanho(m.Versao, "arquivo", "matriz.versao", 80);

        return erros;

        bool Slug(string? valor, string onde, string campo, int max)
        {
            if (!Texto(valor, onde, campo, max)) return false;
            if (FormatoSlug().IsMatch(valor!)) return true;
            Erro(onde, campo, $"\"{valor}\" não é um slug válido: só letras minúsculas sem acento, números e hífen");
            return false;
        }

        bool Texto(string? valor, string onde, string campo, int? max)
        {
            if (string.IsNullOrWhiteSpace(valor)) { Erro(onde, campo, "obrigatório"); return false; }
            return Tamanho(valor, onde, campo, max);
        }

        bool Tamanho(string? valor, string onde, string campo, int? max)
        {
            if (valor is null || max is null || valor.Length <= max) return true;
            Erro(onde, campo, $"tem {valor.Length} caracteres; o máximo é {max}");
            return false;
        }
    }
}
