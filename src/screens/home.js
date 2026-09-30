/* Início */
import { SUBJECTS } from "../data.js";
import { icon } from "../icons.js";
import { state } from "../core/state.js";
import { esc } from "../core/utils.js";
import { subjectScore } from "../core/stats.js";
import { chooseSubject } from "../components/sheet.js";

export default function home() {
  const first = state.user.name.split(" ")[0];
  const last = state.results[state.results.length - 1];
  const tile = (id) => {
    const s = SUBJECTS[id];
    const score = subjectScore(id);
    return `<a class="subject-tile" href="#/area/${id}">
        ${icon(s.icon)}
        <strong>${s.name}</strong>
        <span>${esc(s.area)}</span>
        <div class="mini-bar" aria-hidden="true"><i style="width:${score ?? 0}%"></i></div>
        <span class="sr-only">${score === null ? "Ainda sem quiz feito" : `Aproveitamento de ${score}%`}</span>
      </a>`;
  };
  return {
    cls: "screen--nav",
    nav: "inicio",
    html: `
        <p class="kicker">${state.user.guest ? "Bem-vindo ao Estudaê!" : `Bem-vindo de volta, ${esc(first)}!`}</p>
        <h1 class="title" style="margin-top:.25rem">Pronto para estudar para o Encceja?</h1>
        <div class="subject-grid">${tile("pt")}${tile("mat")}</div>
        <h2 class="section-label">Escolha a área do Encceja</h2>
        <div class="action-list">
          <button class="action-row" data-choose="quiz">${icon("checkSquare")}Questões e quiz${icon("chevronRight", "chev")}</button>
          <button class="action-row" data-choose="videos">${icon("video")}Vídeo-aulas${icon("chevronRight", "chev")}</button>
          <a class="action-row" href="#/progresso">${icon("clock")}Progresso${icon("chevronRight", "chev")}</a>
        </div>
        ${
          last
            ? `<div class="continue-card">
          <strong>Último quiz: ${SUBJECTS[last.subject].name}</strong>
          <p>Você acertou ${last.correct} de ${last.total}. Que tal tentar de novo e melhorar?</p>
          <a class="btn btn--light" href="#/quiz/${last.subject}">Refazer quiz</a>
        </div>`
            : ""
        }`,
    after() {
      document
        .querySelectorAll("[data-choose]")
        .forEach((b) =>
          b.addEventListener("click", () => chooseSubject(b.dataset.choose)),
        );
    },
  };
}
