using Estudae.Domain.Conteudo;
using Estudae.Infra.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Estudae.Infra.Importacao;

public sealed class ResumoImportacao
{
    public int DisciplinasCriadas { get; set; }
    public int TemasCriados { get; set; }
    public int TemasAtualizados { get; set; }
    public int VideosCriados { get; set; }
    public int VideosAtualizados { get; set; }
    public int QuestoesCriadas { get; set; }
    public int QuestoesAtualizadas { get; set; }
    public List<string> Avisos { get; } = [];
}

// Grava um arquivo JÁ VALIDADO (ValidadorConteudo.Validar sem erros).
//
// Reimportar é seguro: cada coisa é encontrada pela sua chave natural e atualizada,
// nunca duplicada. Disciplina por slug, tema por (disciplina, slug), vídeo por
// (tema, youtube_id), questão por codigo. Nada é apagado: o que está no banco e
// não está no arquivo continua lá, e sai como aviso no resumo.
//
// Tudo vai num único SaveChanges, que o EF faz numa transação só: ou o arquivo
// inteiro entra, ou nada entra.
public sealed class ImportadorConteudo(EstudaeDbContext db)
{
    public async Task<ResumoImportacao> ImportarAsync(ArquivoConteudo arquivo, bool publicar, CancellationToken ct = default)
    {
        var resumo = new ResumoImportacao();
        var dj = arquivo.Disciplina!;
        var status = publicar ? StatusQuestao.Publicada : StatusQuestao.Rascunho;

        var disciplina = await db.Disciplinas
            .Include(d => d.Temas).ThenInclude(t => t.Videoaulas)
            .AsSplitQuery() // uma consulta por coleção, em vez de um JOIN que multiplica linhas
            .SingleOrDefaultAsync(d => d.Slug == dj.Slug, ct);
        if (disciplina is null)
        {
            disciplina = new Disciplina { Slug = dj.Slug! };
            db.Disciplinas.Add(disciplina);
            resumo.DisciplinasCriadas++;
        }
        disciplina.Nome = dj.Nome!;
        disciplina.Icone = dj.Icone;
        disciplina.Nivel = dj.Nivel ?? NivelEnsino.Medio;

        // Questões do arquivo que já existem no banco, em qualquer disciplina
        // (o código é único no banco todo; mudar de tema no JSON move a questão).
        var codigos = arquivo.Temas!.SelectMany(t => t.Questoes ?? []).Select(q => q.Codigo!).ToList();
        var existentes = await db.Questoes
            .Where(q => codigos.Contains(q.Codigo))
            .ToDictionaryAsync(q => q.Codigo, ct);

        var agora = DateTime.UtcNow;
        var publicadasQueViraramRascunho = 0;

        for (var i = 0; i < arquivo.Temas!.Count; i++)
        {
            var tj = arquivo.Temas[i];
            var tema = disciplina.Temas.SingleOrDefault(t => t.Slug == tj.Slug);
            if (tema is null)
            {
                tema = new Tema { Slug = tj.Slug! };
                disciplina.Temas.Add(tema);
                resumo.TemasCriados++;
            }
            else
            {
                resumo.TemasAtualizados++;
            }
            tema.Titulo = tj.Titulo!;
            tema.Sobre = tj.Sobre!;
            tema.Ordem = i + 1;

            var videos = tj.Videos ?? [];
            var idsNoArquivo = new HashSet<string>();
            for (var j = 0; j < videos.Count; j++)
            {
                var vj = videos[j];
                YoutubeId.TentarExtrair(vj.Youtube, out var id);
                idsNoArquivo.Add(id);
                var video = tema.Videoaulas.SingleOrDefault(v => v.YoutubeId == id);
                if (video is null)
                {
                    video = new Videoaula { YoutubeId = id };
                    tema.Videoaulas.Add(video);
                    resumo.VideosCriados++;
                }
                else
                {
                    resumo.VideosAtualizados++;
                }
                video.Titulo = vj.Titulo!;
                video.DuracaoSegundos = vj.DuracaoSegundos;
                video.Ordem = j + 1;
            }
            foreach (var sobra in tema.Videoaulas.Where(v => v.Id != 0 && !idsNoArquivo.Contains(v.YoutubeId)))
                resumo.Avisos.Add($"tema \"{tema.Slug}\": o vídeo {sobra.YoutubeId} está no banco mas não no arquivo (não foi apagado)");

            foreach (var qj in tj.Questoes ?? [])
            {
                if (!existentes.TryGetValue(qj.Codigo!, out var questao))
                {
                    questao = new Questao { Codigo = qj.Codigo!, CriadoEm = agora };
                    db.Questoes.Add(questao);
                    resumo.QuestoesCriadas++;
                }
                else
                {
                    if (questao.Status == StatusQuestao.Publicada && !publicar) publicadasQueViraramRascunho++;
                    resumo.QuestoesAtualizadas++;
                }

                questao.Tema = tema;
                questao.TextoBase = qj.TextoBase;
                questao.Enunciado = qj.Enunciado!;
                questao.Alternativas = qj.Alternativas!.Select(a => a!).ToList();
                questao.RespostaCorreta = qj.RespostaCorreta!;
                questao.Resolucao = qj.Resolucao!;
                questao.ProvaAno = qj.ProvaAno;
                questao.ProvaEdicao = qj.ProvaEdicao;
                questao.ProvaNivel = qj.ProvaNivel;
                questao.ProvaNumero = qj.ProvaNumero;
                questao.ImagemUrl = qj.Imagem?.Arquivo;
                questao.ImagemDescricao = qj.Imagem?.Descricao;
                questao.Status = status;
            }
        }

        var slugsNoArquivo = arquivo.Temas.Select(t => t.Slug).ToHashSet();
        foreach (var sobra in disciplina.Temas.Where(t => t.Id != 0 && !slugsNoArquivo.Contains(t.Slug)))
            resumo.Avisos.Add($"o tema \"{sobra.Slug}\" está no banco mas não no arquivo (não foi apagado)");
        if (publicadasQueViraramRascunho > 0)
            resumo.Avisos.Add($"{publicadasQueViraramRascunho} questão(ões) que estavam publicadas voltaram a rascunho " +
                              "e saíram do site (importação sem --publicar)");

        await db.SaveChangesAsync(ct);
        return resumo;
    }
}
