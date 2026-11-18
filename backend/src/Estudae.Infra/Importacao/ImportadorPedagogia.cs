using Estudae.Domain.Conteudo;
using Estudae.Infra.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Estudae.Infra.Importacao;

public sealed class ResumoPedagogia
{
    public int HabilidadesCriadas { get; set; }
    public int HabilidadesAtualizadas { get; set; }
    public int MetadadosCriados { get; set; }
    public int MetadadosAtualizados { get; set; }
    public int VinculosVideo { get; set; }
    public bool MatrizAtualizada { get; set; }
    public List<string> Avisos { get; } = [];
}

// Aplica um arquivo de curadoria JÁ VALIDADO na forma (ValidadorPedagogia) e
// confere as referências no banco: disciplina, temas, questões por codigo,
// habilidades por slug e vídeos por youtube_id. Acumula TODOS os erros de
// referência antes de gravar — e a gravação é um único SaveChanges, ou seja,
// ou o arquivo inteiro entra ou nada entra.
//
// Idempotente como o importador de conteúdo: chaves naturais, nunca duplica.
// Para cada questão/vídeo declarado, os vínculos são substituídos por completo
// naquele registro; o que não aparece no arquivo não é tocado.
public sealed class ImportadorPedagogia(EstudaeDbContext db)
{
    // Validação completa (arquivo + referências no banco), sem gravar nada.
    public async Task<List<ErroImportacao>> ValidarAsync(ArquivoPedagogia arquivo, CancellationToken ct = default) =>
        (await PrepararAsync(arquivo, ct)).Erros;

    public async Task<ResumoPedagogia> AplicarAsync(ArquivoPedagogia arquivo, CancellationToken ct = default)
    {
        var errosFormato = ValidadorPedagogia.Validar(arquivo);
        if (errosFormato.Count > 0)
            throw new InvalidOperationException("Arquivo de pedagogia inválido: " +
                string.Join(" | ", errosFormato.Select(e => e.ToString())));
        await db.BloquearConteudoAsync(ct);
        var prep = await PrepararAsync(arquivo, ct);
        if (prep.Erros.Count > 0 || prep.Disciplina is null)
            throw new InvalidOperationException(
                "Arquivo de pedagogia inválido; rode ValidarAsync para ver os erros. " +
                string.Join(" | ", prep.Erros.Select(e => e.ToString())));

        var resumo = new ResumoPedagogia();
        var disciplina = prep.Disciplina;
        var agora = DateTime.UtcNow;

        // Matriz da disciplina (opcional no arquivo).
        if (arquivo.Matriz is { } mj)
        {
            if (disciplina.Pedagogia is null
                || disciplina.Pedagogia.VersaoMatriz != mj.Versao
                || disciplina.Pedagogia.MatrizValidada != (mj.Validada ?? false)
                || disciplina.Pedagogia.Revisor != arquivo.Revisor)
            {
                disciplina.Pedagogia ??= new ConfiguracaoPedagogicaDisciplina { Disciplina = disciplina };
                disciplina.Pedagogia.VersaoMatriz = mj.Versao;
                disciplina.Pedagogia.MatrizValidada = mj.Validada ?? false;
                disciplina.Pedagogia.Revisor = arquivo.Revisor;
                disciplina.Pedagogia.RevisadoEm = agora;
                resumo.MatrizAtualizada = true;
            }
        }

        foreach (var tj in arquivo.Temas!)
        {
            var tema = prep.Temas[tj.Slug!];

            for (var i = 0; i < (tj.Habilidades?.Count ?? 0); i++)
            {
                var hj = tj.Habilidades![i];
                var habilidade = tema.Habilidades.SingleOrDefault(h => h.Slug == hj.Slug);
                if (habilidade is null)
                {
                    habilidade = new Habilidade { Slug = hj.Slug!, Tema = tema };
                    tema.Habilidades.Add(habilidade);
                    resumo.HabilidadesCriadas++;
                }
                else if (habilidade.Titulo != hj.Titulo
                         || habilidade.Essencial != (hj.Essencial ?? true)
                         || habilidade.ReferenciaOficial != hj.ReferenciaOficial
                         || habilidade.Ordem != i + 1)
                {
                    resumo.HabilidadesAtualizadas++;
                }
                habilidade.Titulo = hj.Titulo!;
                habilidade.Essencial = hj.Essencial ?? true;
                habilidade.ReferenciaOficial = hj.ReferenciaOficial;
                habilidade.Ordem = i + 1;
            }
            var habilidadesDoTema = tema.Habilidades.ToDictionary(h => h.Slug);

            foreach (var vj in tj.Videos ?? [])
            {
                YoutubeId.TentarExtrair(vj.Youtube!, out var youtubeId);
                var video = tema.Videoaulas.Single(v => v.YoutubeId == youtubeId);
                // Compara por entidade, não por Id: habilidades novas ainda não
                // têm Id (o EF preenche no SaveChanges).
                var desejadas = (vj.Habilidades ?? []).Select(h => habilidadesDoTema[h!]).ToList();
                foreach (var velho in video.Habilidades
                             .Where(v => !desejadas.Any(h => h.Id != 0 && h.Id == v.HabilidadeId))
                             .ToList())
                    db.VideoaulaHabilidades.Remove(velho);
                foreach (var h in desejadas.Where(h => !video.Habilidades.Any(
                             v => (h.Id != 0 && v.HabilidadeId == h.Id) || ReferenceEquals(v.Habilidade, h))))
                {
                    video.Habilidades.Add(new VideoaulaHabilidade { Videoaula = video, Habilidade = h });
                    resumo.VinculosVideo++;
                }
            }

            foreach (var qj in tj.Questoes ?? [])
            {
                var questao = prep.Questoes[qj.Codigo!];
                var impressaoAtual = prep.Impressao(questao);
                var meta = questao.Metadados;
                if (meta is null)
                {
                    meta = new MetadadosQuestao { Versao = 0 };
                    db.MetadadosQuestoes.Add(meta);
                    meta.Questao = questao;
                    questao.Metadados = meta;
                    resumo.MetadadosCriados++;
                }

                var revisao = qj.Revisao ?? "pendente";
                var status = revisao switch
                {
                    "aprovada" => StatusRevisao.Aprovada,
                    "rejeitada" => StatusRevisao.Rejeitada,
                    _ => StatusRevisao.Pendente,
                };
                var secundarias = (qj.Secundarias ?? []).Select(s => habilidadesDoTema[s!]).ToList();
                var mudou = meta.HabilidadePrincipal?.Slug != qj.Habilidade
                            || meta.Familia != qj.Familia
                            || meta.Tipo != qj.Tipo
                            || meta.StatusRevisao != status
                            || meta.ElegibilidadeSolicitada != (qj.Elegivel ?? false)
                            || (status != StatusRevisao.Pendente && meta.Revisor != arquivo.Revisor)
                            || (status == StatusRevisao.Aprovada &&
                                (meta.ImpressaoConteudo != impressaoAtual || !meta.ConteudoConfere))
                            || meta.Secundarias.Select(s => s.Habilidade.Slug).ToHashSet()
                                .SetEquals(secundarias.Select(s => s.Slug)) == false
                            || (meta.Dificuldade?.ToString().ToLowerInvariant()) != qj.Dificuldade;

                meta.HabilidadePrincipal = habilidadesDoTema[qj.Habilidade!];
                meta.Familia = qj.Familia!;
                meta.Tipo = qj.Tipo;
                meta.Dificuldade = qj.Dificuldade switch
                {
                    "introdutoria" => DificuldadeCuratorial.Introdutoria,
                    "intermediaria" => DificuldadeCuratorial.Intermediaria,
                    "avancada" => DificuldadeCuratorial.Avancada,
                    _ => null,
                };
                meta.StatusRevisao = status;
                meta.ElegibilidadeSolicitada = qj.Elegivel ?? false;
                foreach (var velha in meta.Secundarias
                             .Where(s => !secundarias.Any(h => h.Id != 0 && h.Id == s.HabilidadeId))
                             .ToList())
                    db.QuestaoHabilidadesSecundarias.Remove(velha);
                foreach (var h in secundarias.Where(h => !meta.Secundarias.Any(
                             s => (h.Id != 0 && s.HabilidadeId == h.Id) || ReferenceEquals(s.Habilidade, h))))
                    meta.Secundarias.Add(new QuestaoHabilidadeSecundaria { Metadados = meta, Habilidade = h });

                if (status == StatusRevisao.Aprovada)
                {
                    // A aprovação carimba o conteúdo que o revisor viu: se ele
                    // mudar depois, o importador de conteúdo desfaz o carimbo.
                    meta.ImpressaoConteudo = impressaoAtual;
                    meta.ConteudoConfere = true;
                    if (mudou)
                    {
                        meta.Revisor = arquivo.Revisor;
                        meta.RevisadoEm = agora;
                    }
                }
                else
                {
                    // Pendente/rejeitada: não carimba. ConteudoConfere segue a
                    // impressão já guardada, para uma reaprovação futura saber
                    // se o conteúdo ainda é o mesmo da última revisão.
                    meta.ConteudoConfere = meta.ImpressaoConteudo == impressaoAtual;
                }

                if (mudou)
                {
                    if (status == StatusRevisao.Rejeitada)
                    {
                        meta.Revisor = arquivo.Revisor;
                        meta.RevisadoEm = agora;
                    }
                    if (meta.Versao > 0) resumo.MetadadosAtualizados++;
                    meta.Versao++;
                }
            }
        }

        await db.SaveChangesAsync(ct);
        return resumo;
    }

    // Grafo carregado + erros de referência. Separado da aplicação para o
    // --validar conferir o banco inteiro sem gravar nada.
    private async Task<Preparacao> PrepararAsync(ArquivoPedagogia arquivo, CancellationToken ct)
    {
        var erros = ValidadorPedagogia.Validar(arquivo);
        if (erros.Count > 0) return new(erros, null, new(), new(), _ => "");
        void Erro(string onde, string campo, string msg) => erros.Add(new(onde, campo, msg));

        var disciplina = await db.Disciplinas
            .Include(d => d.Pedagogia)
            .Include(d => d.Temas).ThenInclude(t => t.Habilidades)
            .Include(d => d.Temas).ThenInclude(t => t.Videoaulas).ThenInclude(v => v.Habilidades)
            .Include(d => d.Temas).ThenInclude(t => t.Questoes).ThenInclude(q => q.Metadados).ThenInclude(m => m!.Secundarias)
            .Include(d => d.Temas).ThenInclude(t => t.Questoes).ThenInclude(q => q.Metadados).ThenInclude(m => m!.HabilidadePrincipal)
            .AsSplitQuery()
            .SingleOrDefaultAsync(d => d.Slug == arquivo.Disciplina, ct);

        if (disciplina is null)
        {
            Erro("arquivo", "disciplina", $"disciplina \"{arquivo.Disciplina}\" não existe no banco (o conteúdo precisa ser importado antes da classificação)");
            return new(erros, null, new(), new(), _ => "");
        }

        var temas = disciplina.Temas.ToDictionary(t => t.Slug);
        var questoes = disciplina.Temas.SelectMany(t => t.Questoes).ToDictionary(q => q.Codigo);

        // SHAs das imagens citadas pelas questões classificadas (impressão).
        var caminhosImagem = questoes.Values.Select(q => q.ImagemUrl).OfType<string>().ToList();
        var shas = await db.Imagens
            .Where(i => caminhosImagem.Contains(i.Caminho))
            .ToDictionaryAsync(i => i.Caminho, i => i.Sha256, ct);
        string Impressao(Questao q) => ImpressaoConteudo.Calcular(
            q, disciplina.Slug, q.Tema.Slug,
            q.ImagemUrl is null ? null : shas.GetValueOrDefault(q.ImagemUrl));

        // Famílias já em uso em outros temas da disciplina (proibição de reuse).
        var familiaPorTema = new Dictionary<string, string>();
        foreach (var t in disciplina.Temas)
            foreach (var q in t.Questoes.Where(q => q.Metadados is not null))
                familiaPorTema.TryAdd(q.Metadados!.Familia, t.Slug);

        var habilidadesNoBanco = disciplina.Temas
            .ToDictionary(t => t.Slug, t => t.Habilidades.Select(h => h.Slug).ToHashSet());

        foreach (var tj in arquivo.Temas ?? [])
        {
            var ondeTema = $"tema \"{tj.Slug}\"";
            if (!temas.TryGetValue(tj.Slug!, out var tema))
            {
                Erro(ondeTema, "slug", "o tema não existe nesta disciplina");
                continue;
            }

            var declaradas = (tj.Habilidades ?? []).Select(h => h.Slug!).ToHashSet();
            var conhecidas = new HashSet<string>(declaradas);
            conhecidas.UnionWith(habilidadesNoBanco.GetValueOrDefault(tema.Slug, []));
            void HabilidadeExiste(string? slug, string onde, string campo)
            {
                if (slug is not null && !conhecidas.Contains(slug))
                    Erro(onde, campo, $"a habilidade \"{slug}\" não está declarada no arquivo nem existe no tema");
            }

            foreach (var vj in tj.Videos ?? [])
            {
                YoutubeId.TentarExtrair(vj.Youtube!, out var youtubeId);
                var ondeV = $"{ondeTema}, vídeo {youtubeId}";
                if (tema.Videoaulas.All(v => v.YoutubeId != youtubeId))
                {
                    Erro(ondeV, "youtube", "o vídeo não existe neste tema");
                    continue;
                }
                foreach (var hs in vj.Habilidades ?? [])
                    HabilidadeExiste(hs, ondeV, "habilidades");
            }

            foreach (var qj in tj.Questoes ?? [])
            {
                var ondeQ = $"questão \"{qj.Codigo}\"";
                if (!questoes.TryGetValue(qj.Codigo!, out var questao))
                {
                    Erro(ondeQ, "codigo", "a questão não existe no banco");
                    continue;
                }
                if (questao.Tema != tema)
                    Erro(ondeQ, "codigo", $"a questão pertence ao tema \"{questao.Tema.Slug}\", não a \"{tema.Slug}\"");

                HabilidadeExiste(qj.Habilidade, ondeQ, "habilidade");
                foreach (var hs in qj.Secundarias ?? [])
                    HabilidadeExiste(hs, ondeQ, "secundarias");

                // A mesma família não pode habitar dois temas.
                if (qj.Familia is not null
                    && familiaPorTema.TryGetValue(qj.Familia, out var temaDaFamilia)
                    && temaDaFamilia != tema.Slug)
                    Erro(ondeQ, "familia", $"a família \"{qj.Familia}\" já é usada no tema \"{temaDaFamilia}\"");
                if (qj.Familia is not null) familiaPorTema[qj.Familia] = tema.Slug;

                if (qj.Impressao is not null && qj.Impressao != Impressao(questao))
                    Erro(ondeQ, "impressao", "não confere com o conteúdo atual no banco: a classificação foi feita sobre outra versão da questão");
            }
        }

        return new(erros, disciplina, temas, questoes, Impressao);
    }

    private sealed record Preparacao(
        List<ErroImportacao> Erros,
        Disciplina? Disciplina,
        Dictionary<string, Tema> Temas,
        Dictionary<string, Questao> Questoes,
        Func<Questao, string> Impressao);
}
