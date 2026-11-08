using System.Text.RegularExpressions;

namespace Estudae.Infra.Importacao;

// Onde está o problema (ex.: questão "mat-porcentagem-001"), qual campo e por quê.
public sealed record ErroImportacao(string Onde, string Campo, string Mensagem)
{
    public override string ToString() => $"{Onde} | campo \"{Campo}\": {Mensagem}";
}

// Validação pura (sem banco): roda igual no --validar, no import e nos testes.
// Junta TODOS os erros do arquivo; o importador só grava se a lista vier vazia.
public static partial class ValidadorConteudo
{
    public const int MinAlternativas = 2;
    public const int MaxAlternativas = 5;
    public const int PrimeiroAnoEncceja = 2002;

    [GeneratedRegex("^[a-z0-9]+(-[a-z0-9]+)*$")]
    private static partial Regex FormatoSlug();

    // "$" de LaTeX é proibido (usar \( \) e \[ \]), mas "R$" e "US$" são dinheiro.
    // Regra: "$" logo depois de uma letra é moeda; qualquer outro "$" é erro.
    [GeneratedRegex(@"(?<!\p{L})\$")]
    private static partial Regex CifraoLatex();

    // Alternativa que cita outra por posição quebra quando embaralhamos a ordem.
    // As letras A-E são maiúsculas de propósito (o artigo "a" não pode casar); as
    // palavras, em (?i:...), valem com qualquer caixa ("Todas as anteriores").
    [GeneratedRegex(
        @"\b[A-E]\s*(,|e|ou)\s*[A-E]\b" +
        @"|(?i:\b(alternativas?|letras?|op[çc](ão|ao|ões|oes))\s+)[A-E]\b" +
        @"|(?i:\b(todas|nenhuma)\s+(as|das)\s+(alternativas\s+)?(anteriores|acima)\b)" +
        @"|(?i:\b(as|das)\s+alternativas\s+(anteriores|acima)\b)")]
    private static partial Regex ReferenciaPosicao();

    public static List<ErroImportacao> Validar(ArquivoConteudo arquivo)
    {
        var erros = new List<ErroImportacao>();
        void Erro(string onde, string campo, string msg) => erros.Add(new(onde, campo, msg));

        // --- disciplina ---
        var d = arquivo.Disciplina;
        if (d is null)
        {
            Erro("disciplina", "disciplina", "obrigatório");
        }
        else
        {
            Slug(d.Slug, "disciplina", "slug", 60);
            Texto(d.Nome, "disciplina", "nome", 100);
            Tamanho(d.Icone, "disciplina", "icone", 60);
        }

        // --- temas ---
        if (arquivo.Temas is null || arquivo.Temas.Count == 0)
        {
            Erro("disciplina", "temas", "a lista de temas está vazia ou ausente");
            return erros;
        }

        var slugsTema = new HashSet<string>();
        var codigos = new Dictionary<string, string>(); // codigo -> onde apareceu primeiro

        for (var i = 0; i < arquivo.Temas.Count; i++)
        {
            var t = arquivo.Temas[i];
            var ondeTema = t?.Slug is { } s ? $"tema \"{s}\"" : $"tema nº {i + 1}";
            if (t is null) { Erro(ondeTema, "-", "tema vazio (null)"); continue; }

            if (Slug(t.Slug, ondeTema, "slug", 80) && !slugsTema.Add(t.Slug!))
                Erro(ondeTema, "slug", "repetido: dois temas com o mesmo slug no arquivo");
            Texto(t.Titulo, ondeTema, "titulo", 150);
            Texto(t.Sobre, ondeTema, "sobre", null);

            // vídeos
            var idsVideo = new HashSet<string>();
            for (var j = 0; j < (t.Videos?.Count ?? 0); j++)
            {
                var v = t.Videos![j];
                var ondeVideo = $"{ondeTema}, vídeo nº {j + 1}";
                if (v is null) { Erro(ondeVideo, "-", "vídeo vazio (null)"); continue; }

                if (v.Youtube is null)
                    Erro(ondeVideo, "youtube", "obrigatório (link do YouTube ou o ID de 11 caracteres)");
                else if (!YoutubeId.TentarExtrair(v.Youtube, out var id))
                    Erro(ondeVideo, "youtube", $"não consegui extrair um ID de 11 caracteres de \"{v.Youtube}\"");
                else if (!idsVideo.Add(id))
                    Erro(ondeVideo, "youtube", $"o vídeo {id} aparece duas vezes neste tema");

                Texto(v.Titulo, ondeVideo, "titulo", 200);
                if (v.DuracaoSegundos is <= 0)
                    Erro(ondeVideo, "duracao_segundos", "precisa ser maior que zero (ou ser omitido)");
            }

            // questões
            for (var j = 0; j < (t.Questoes?.Count ?? 0); j++)
            {
                var q = t.Questoes![j];
                var ondeQ = q?.Codigo is { } c ? $"questão \"{c}\"" : $"{ondeTema}, questão nº {j + 1}";
                if (q is null) { Erro(ondeQ, "-", "questão vazia (null)"); continue; }
                ValidarQuestao(q, ondeQ);
            }
        }

        return erros;

        void ValidarQuestao(QuestaoJson q, string onde)
        {
            if (Slug(q.Codigo, onde, "codigo", 60))
            {
                if (codigos.TryGetValue(q.Codigo!, out var primeiro))
                    Erro(onde, "codigo", $"repetido no arquivo (já usado em {primeiro})");
                else
                    codigos[q.Codigo!] = onde;
            }

            Tamanho(q.TextoBase, onde, "texto_base", null);
            Texto(q.Enunciado, onde, "enunciado", null);
            Texto(q.Resolucao, onde, "resolucao", null);
            Texto(q.RespostaCorreta, onde, "resposta_correta", null);

            // Alternativas: de 2 a 5, sem vazias, sem repetidas, sem citar posição.
            var alts = q.Alternativas;
            if (alts is null || alts.Count == 0)
            {
                Erro(onde, "alternativas", "obrigatório");
            }
            else
            {
                if (alts.Count is < MinAlternativas or > MaxAlternativas)
                    Erro(onde, "alternativas", $"tem {alts.Count}; precisa ter de {MinAlternativas} a {MaxAlternativas}");

                var vistas = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                for (var k = 0; k < alts.Count; k++)
                {
                    var alt = alts[k];
                    var campo = $"alternativas[{k}]";
                    if (alt is null) { Erro(onde, campo, "alternativa vazia"); continue; }
                    if (!vistas.Add(alt))
                        Erro(onde, campo, $"repetida: \"{alt}\" (maiúsculas e minúsculas não contam como diferença)");
                    if (ReferenciaPosicao().IsMatch(alt))
                        Erro(onde, campo, $"parece citar outra alternativa pela posição (\"{alt}\"); isso quebra ao embaralhar");
                    Cifrao(alt, onde, campo);
                }

                // Comparação exata (ordinal): é a mesma regra que a correção usa.
                if (q.RespostaCorreta is not null && !alts.Contains(q.RespostaCorreta, StringComparer.Ordinal))
                    Erro(onde, "resposta_correta", $"\"{q.RespostaCorreta}\" não é exatamente igual a nenhuma alternativa");
            }

            Cifrao(q.TextoBase, onde, "texto_base");
            Cifrao(q.Enunciado, onde, "enunciado");
            Cifrao(q.Resolucao, onde, "resolucao");

            // Fonte: toda questão do INEP cita a prova de origem.
            var anoAtual = DateTime.UtcNow.Year;
            if (q.ProvaAno is null)
                Erro(onde, "prova_ano", "obrigatório");
            else if (q.ProvaAno < PrimeiroAnoEncceja || q.ProvaAno > anoAtual)
                Erro(onde, "prova_ano", $"{q.ProvaAno} fora do intervalo {PrimeiroAnoEncceja}–{anoAtual}");
            Texto(q.ProvaEdicao, onde, "prova_edicao", 40);
            Texto(q.ProvaNivel, onde, "prova_nivel", 40);
            if (q.ProvaNumero is null)
                Erro(onde, "prova_numero", "obrigatório");
            else if (q.ProvaNumero <= 0)
                Erro(onde, "prova_numero", "precisa ser maior que zero");
        }

        bool Slug(string? valor, string onde, string campo, int max)
        {
            if (!Texto(valor, onde, campo, max)) return false;
            if (FormatoSlug().IsMatch(valor!)) return true;
            Erro(onde, campo, $"\"{valor}\" não é um slug válido: só letras minúsculas sem acento, números e hífen (ex.: porcentagem-e-proporcao)");
            return false;
        }

        bool Texto(string? valor, string onde, string campo, int? max)
        {
            if (valor is null) { Erro(onde, campo, "obrigatório"); return false; }
            return Tamanho(valor, onde, campo, max);
        }

        bool Tamanho(string? valor, string onde, string campo, int? max)
        {
            if (valor is null || max is null || valor.Length <= max) return true;
            Erro(onde, campo, $"tem {valor.Length} caracteres; o máximo é {max}");
            return false;
        }

        void Cifrao(string? valor, string onde, string campo)
        {
            if (valor is not null && CifraoLatex().IsMatch(valor))
                Erro(onde, campo, "tem \"$\" fora de valor em dinheiro; para fórmula use \\( ... \\) ou \\[ ... \\]");
        }
    }
}
