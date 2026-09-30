/* Barras de aproveitamento e histórico de quizzes (usados em Progresso e Perfil) */
import { SUBJECTS } from "../data.js";
import { icon } from "../icons.js";
import { state } from "../core/state.js";
import { esc, formatDay, pct } from "../core/utils.js";
import { subjectScore, watchedCount, totalLessons } from "../core/stats.js";
import { urls } from "../core/urls.js";

export function historyList(limit) {
  const list = state.results
    .map((r, i) => ({ ...r, i }))
    .reverse()
    .slice(0, limit);
  return `<div class="history">${list
    .map((r) => {
      const s = SUBJECTS[r.subject];
      const p = pct(r.correct, r.total);
      const good = p >= 60;
      const label =
        r.weakTopic !== null ? s.topics[r.weakTopic].title : "Todos os temas";
      return `<a class="history-item ${good ? "ok" : "bad"}" href="${urls.resultado(r.i)}">
        <span class="badge">${icon(good ? "check" : "x")}</span>
        <span><strong>${s.name} — ${esc(label)}</strong><small>${formatDay(r.date)}</small></span>
        <span class="pct">${p}%</span></a>`;
    })
    .join("")}</div>`;
}

export function subjectBars() {
  return ["pt", "mat"]
    .map((id) => {
      const sc = subjectScore(id);
      return `<div class="bar-row">
        <header><span>${SUBJECTS[id].name}</span><span>${sc === null ? "—" : sc + "%"}</span></header>
        <div class="bar" role="progressbar" aria-label="Aproveitamento em ${SUBJECTS[id].name}" aria-valuenow="${sc ?? 0}" aria-valuemin="0" aria-valuemax="100"><i style="width:${sc ?? 0}%"></i></div>
        <p class="small" style="margin-top:.375rem">${watchedCount(id)} de ${totalLessons(id)} vídeo-aulas concluídas</p>
      </div>`;
    })
    .join("");
}
