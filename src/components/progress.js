/* Progresso por matéria e histórico de lições/simulados (usados em Progresso e Perfil).
   Sempre só da prova escolhida (Ensino Fundamental ou Médio). */
import { SUBJECTS, materiasDoNivel } from "../data.js";
import { icon } from "../icons.js";
import { state } from "../core/state.js";
import { esc, formatDay, pct } from "../core/utils.js";
import { subjectProgress, resultadosDaProva } from "../core/stats.js";
import { urls } from "../core/urls.js";

const barra = (done, total, rotulo) =>
  `<div class="bar" role="progressbar" aria-label="${esc(rotulo)}" aria-valuenow="${done}" aria-valuemin="0" aria-valuemax="${total}"><i style="width:${total ? (done / total) * 100 : 0}%"></i></div>`;

export function historyList(limit) {
  const list = resultadosDaProva(state.nivel).slice(0, limit);
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
        <span><strong>${esc(s.name)} — ${esc(label)}</strong><small>${formatDay(r.date)} · ${r.correct} de ${r.total} certas</small></span>
        <span class="pct">${p}%</span></a>`;
    })
    .join("")}</div>`;
}

// Barras compactas (Perfil): uma por matéria da prova, em atividades.
export function subjectBars() {
  return materiasDoNivel(state.nivel)
    .map((s) => {
      const p = subjectProgress(s.id);
      return `<div class="bar-row">
        <header><span>${esc(s.name)}</span><span>${p.done} de ${p.total}</span></header>
        ${barra(p.done, p.total, `Atividades concluídas em ${s.name}`)}
      </div>`;
    })
    .join("");
}

// Cartões por matéria (Progresso): atividades e o detalhe de aulas e questões.
export function subjectCards() {
  return materiasDoNivel(state.nivel)
    .map((s) => {
      const p = subjectProgress(s.id);
      const aulas = p.totalAulas ? `Aulas vistas: ${p.aulas} de ${p.totalAulas}` : "Aulas: em breve";
      return `<a class="subject-row subject-row--progress" href="${urls.area(s.id)}">
        ${icon(s.icon)}
        <span>
          <strong>${esc(s.name)}</strong>
          <small>${p.done} de ${p.total} atividades</small>
          ${barra(p.done, p.total, `Atividades concluídas em ${s.name}`)}
          <small class="subject-row__detail">${aulas} · Questões acertadas: ${p.questoes} de ${p.totalQuestoes}</small>
        </span>
        ${icon("chevronRight", "chev")}
      </a>`;
    })
    .join("");
}
