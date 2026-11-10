/* Métricas de progresso derivadas do estado */
import { SUBJECTS } from "../data.js";
import { state } from "./state.js";
import { pct } from "./utils.js";
import { urls } from "./urls.js";

export function streakDays() {
  const days = new Set(
    state.results.map((r) => new Date(r.date).toDateString()),
  );
  let count = 0;
  const d = new Date();
  if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1);
  while (days.has(d.toDateString())) {
    count++;
    d.setDate(d.getDate() - 1);
  }
  return count;
}

export function subjectScore(id) {
  const list = state.results.filter((r) => r.subject === id);
  if (!list.length) return null;
  const correct = list.reduce((s, r) => s + r.correct, 0);
  const total = list.reduce((s, r) => s + r.total, 0);
  return pct(correct, total);
}

export function watchedCount(id) {
  return Object.keys(state.watched).filter((k) => k.startsWith(id + "/"))
    .length;
}
export function totalLessons(id) {
  return SUBJECTS[id].topics.reduce((s, t) => s + t.videos, 0);
}

/* ---------- Atividades (progresso por tema) ----------
   Atividade = cada vídeo-aula do tema (conta quando marcada como concluída)
   + cada questão do tema (conta quando foi acertada ao menos uma vez). */

// Ids das questões já acertadas num tema (lições v: 3 guardam o id).
function acertadas(id, ti) {
  const ids = new Set();
  for (const r of state.results)
    if (r.subject === id && r.topic === ti) for (const x of r.items) if (x.ok && x.id !== undefined) ids.add(x.id);
  return ids;
}

export function topicProgress(id, ti) {
  const t = SUBJECTS[id].topics[ti];
  const aulas = t.lessons.filter((_, j) => state.watched[`${id}/${ti}/${j}`]).length;
  const questoes = Math.min(acertadas(id, ti).size, t.totalQuestoes);
  const total = t.videos + t.totalQuestoes;
  return { done: aulas + questoes, total, aulas, questoes, completo: total > 0 && aulas + questoes >= total };
}

export function subjectProgress(id) {
  return SUBJECTS[id].topics.reduce(
    (acc, _, ti) => {
      const p = topicProgress(id, ti);
      return { done: acc.done + p.done, total: acc.total + p.total };
    },
    { done: 0, total: 0 },
  );
}

// Próxima atividade pendente da matéria: no primeiro tema incompleto, a aula
// ainda não vista; se já viu, a prática. null se está tudo feito.
export function nextActivity(id) {
  const s = SUBJECTS[id];
  for (let ti = 0; ti < s.topics.length; ti++) {
    const t = s.topics[ti];
    const p = topicProgress(id, ti);
    if (p.completo || p.total === 0) continue;
    const j = t.lessons.findIndex((_, k) => !state.watched[`${id}/${ti}/${k}`]);
    if (j >= 0) return { ti, kind: "aula", titulo: t.title, href: urls.video(id, ti, j) };
    return { ti, kind: "pratica", titulo: t.title, href: urls.quiz(id, ti) };
  }
  return null;
}
