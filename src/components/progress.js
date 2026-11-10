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
    .filter((r) => SUBJECTS[r.subject]) // matéria que saiu do catálogo não aparece
    .reverse()
    .slice(0, limit);
  return `<div class="history">${list
    .map((r) => {
      const s = SUBJECTS[r.subject];
      const p = pct(r.correct, r.total);
      const good = p >= 60;
      // Lição por tema (v: 3) mostra o tema; quiz antigo, da matéria inteira, não tem.
      const label = r.kind === "simulado"
        ? "Simulado"
        : r.topic !== undefined ? s.topics[r.topic]?.title ?? "Tema" : "Todos os temas";
      return `<a class="history-item ${good ? "ok" : "bad"}" href="${urls.resultado(r.i)}">
        <span class="badge">${icon(good ? "check" : "x")}</span>
        <span><strong>${esc(s.name)} — ${esc(label)}</strong><small>${formatDay(r.date)}</small></span>
        <span class="pct">${p}%</span></a>`;
    })
    .join("")}</div>`;
}

export function subjectBars() {
  // Só as matérias da prova escolhida (Fundamental ou Médio).
  return Object.keys(SUBJECTS)
    .filter((id) => !state.nivel || SUBJECTS[id].nivel === state.nivel)
    .map((id) => {
      const sc = subjectScore(id);
      const name = esc(SUBJECTS[id].name);
      return `<div class="bar-row">
        <header><span>${name}</span><span>${sc === null ? "—" : sc + "%"}</span></header>
        <div class="bar" role="progressbar" aria-label="Aproveitamento em ${name}" aria-valuenow="${sc ?? 0}" aria-valuemin="0" aria-valuemax="100"><i style="width:${sc ?? 0}%"></i></div>
        <p class="small" style="margin-top:.375rem">${watchedCount(id)} de ${totalLessons(id)} vídeo-aulas concluídas</p>
      </div>`;
    })
    .join("");
}
