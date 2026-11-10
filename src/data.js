/* ==========================================================
   Conteúdo do Estudaê: áreas, temas, vídeo-aulas e questões.
   Vem da API (src/core/api.js). O formato abaixo é o mesmo que as telas já
   usavam com o conteúdo de exemplo, para elas continuarem iguais:

   SUBJECTS[slug] = { id, name, area, icon, topics: [
     { slug, title, about, videos (quantidade), lessons: [{ id, kind, min, youtubeId }],
       totalQuestoes } ] }
   ========================================================== */
import { api } from "./core/api.js";

export const SUBJECTS = {};

// Carrega matérias e temas (com os vídeos) uma vez, no início do app.
export async function carregarCatalogo() {
  const disciplinas = await api.disciplinas();
  const temasPorDisciplina = await Promise.all(disciplinas.map((d) => api.temas(d.slug)));
  for (const k of Object.keys(SUBJECTS)) delete SUBJECTS[k];
  disciplinas.forEach((d, i) => {
    const topics = temasPorDisciplina[i].map((t) => ({
      slug: t.slug,
      title: t.titulo,
      about: t.sobre,
      videos: t.videos.length,
      totalQuestoes: t.totalQuestoes,
      lessons: t.videos.map((v) => ({
        id: v.id,
        kind: v.titulo,
        min: v.duracaoSegundos ? Math.max(1, Math.round(v.duracaoSegundos / 60)) : null,
        youtubeId: v.youtubeId,
      })),
    }));
    SUBJECTS[d.slug] = {
      id: d.slug,
      name: d.nome,
      area: topics.length === 1 ? "1 tema" : `${topics.length} temas`,
      icon: d.icone || "book",
      totalQuestoes: d.totalQuestoes,
      topics,
    };
  });
}

export function lessonsFor(topic) {
  return topic.lessons;
}

// Questões de UM tema (a lição é por tema). Não trazem gabarito: a correção
// vem do POST de resposta.
export async function carregarQuestoes(id, ti) {
  const t = SUBJECTS[id].topics[ti];
  const questoes = await api.questoes(id, t.slug);
  return questoes.map((q) => ({
    id: q.id,
    topic: ti,
    text: q.textoBase,
    ask: q.enunciado,
    options: q.alternativas,
    prova: q.prova,
  }));
}

// "Fonte: Encceja 2020, Nacional, Ensino Médio, questão 35." ou, sem prova, autoral.
export function fonte(prova) {
  if (!prova || !prova.ano) return "Questão autoral Estudaê, feita para praticar.";
  const partes = ["Encceja " + prova.ano, prova.edicao, prova.nivel, prova.numero && "questão " + prova.numero];
  return "Fonte: " + partes.filter(Boolean).join(", ") + ".";
}
