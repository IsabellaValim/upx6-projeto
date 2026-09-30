/* Progresso */
import { state } from "../core/state.js";
import { historyList, subjectBars } from "../components/progress.js";
import { urls } from "../core/urls.js";

export default function progresso() {
  const has = state.results.length > 0;
  return {
    cls: "screen--nav",
    nav: "progresso",
    html: `
        <h1 class="title">Seu progresso</h1>
        <p class="lede">Acompanhe como você está em cada área.</p>
        <div class="card">${subjectBars()}</div>
        <h2 class="section-label">Quizzes feitos</h2>
        ${
          has
            ? historyList(20)
            : `<div class="empty">
          <h2>Nenhum quiz feito ainda</h2>
          <p>Faça seu primeiro quiz para ver acertos, erros e o que revisar.</p>
          <a class="btn btn--primary btn--sm" href="${urls.quiz("pt")}">Começar quiz de Português</a>
          <a class="btn btn--outline btn--sm" href="${urls.quiz("mat")}">Começar quiz de Matemática</a>
        </div>`
        }`,
  };
}
