/* Início: a matéria é escolhida aqui, uma vez só */
import { SUBJECTS } from "../data.js";
import { icon } from "../icons.js";
import { state } from "../core/state.js";
import { esc } from "../core/utils.js";
import { subjectScore } from "../core/stats.js";
import { urls } from "../core/urls.js";

export default function home() {
  const first = state.user.name.split(" ")[0];
  const tile = (id) => {
    const s = SUBJECTS[id];
    const score = subjectScore(id);
    return `<a class="subject-tile" href="${urls.area(id)}">
        ${icon(s.icon)}
        <strong>${esc(s.name)}</strong>
        <span>${esc(s.area)}</span>
        <div class="mini-bar" aria-hidden="true"><i style="width:${score ?? 0}%"></i></div>
        <span class="sr-only">${score === null ? "Ainda sem prática feita" : `Aproveitamento de ${score}%`}</span>
      </a>`;
  };

  // "Continuar": a última lição de um tema que ainda existe no catálogo.
  const last = [...state.results].reverse().find((r) => SUBJECTS[r.subject]?.topics[r.topic]);
  const lastTopic = last && SUBJECTS[last.subject].topics[last.topic];

  return {
    cls: "screen--nav",
    nav: "inicio",
    html: `
        <p class="kicker">${state.user.guest ? "Bem-vindo ao Estudaê!" : `Bem-vindo de volta, ${esc(first)}!`}</p>
        <h1 class="title" style="margin-top:.25rem">Pronto para estudar para o Encceja?</h1>
        <h2 class="section-label">Escolha a matéria</h2>
        ${
          Object.keys(SUBJECTS).length
            ? `<div class="subject-grid" style="margin-top:0">${Object.keys(SUBJECTS).map(tile).join("")}</div>`
            : `<div class="empty"><p>Ainda não há matérias disponíveis. Volte mais tarde.</p></div>`
        }
        ${
          lastTopic
            ? `<div class="continue-card">
          <strong>Continuar: ${esc(lastTopic.title)}</strong>
          <p>${esc(SUBJECTS[last.subject].name)} · na última vez você acertou ${last.correct} de ${last.total}.</p>
          <a class="btn btn--light" href="${urls.quiz(last.subject, last.topic)}">${icon("checkSquare")}Praticar de novo</a>
        </div>`
            : ""
        }`,
  };
}
