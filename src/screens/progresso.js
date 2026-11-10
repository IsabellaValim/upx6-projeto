/* Progresso */
import { SUBJECTS } from "../data.js";
import { state } from "../core/state.js";
import { esc } from "../core/utils.js";
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
        <h2 class="section-label">Lições feitas</h2>
        ${
          has
            ? historyList(20)
            : `<div class="empty">
          <h2>Nenhuma lição feita ainda</h2>
          <p>Escolha um tema e pratique para ver acertos, erros e o que revisar.</p>
          ${Object.values(SUBJECTS)
            .map((s, i) => `<a class="btn ${i ? "btn--outline" : "btn--primary"} btn--sm" href="${urls.area(s.id)}">Praticar ${esc(s.name)}</a>`)
            .join("")}
        </div>`
        }`,
  };
}
