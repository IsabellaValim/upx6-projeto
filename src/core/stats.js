/* Métricas de progresso derivadas do estado */
import { SUBJECTS } from "../data.js";
import { state } from "./state.js";
import { pct } from "./utils.js";

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
