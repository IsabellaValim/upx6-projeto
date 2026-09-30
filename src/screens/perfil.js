/* Perfil */
import { icon } from "../icons.js";
import { state } from "../core/state.js";
import { store } from "../core/store.js";
import { esc, go, initials } from "../core/utils.js";
import { streakDays } from "../core/stats.js";
import { historyList, subjectBars } from "../components/progress.js";

export default function perfil() {
  const u = state.user;
  const streak = streakDays();
  const correct = state.results.reduce((s, r) => s + r.correct, 0);
  const level = 1 + Math.floor(correct / 10);
  return {
    cls: "screen--nav",
    nav: "perfil",
    html: `
        <div class="topbar topbar--split">
          <a class="icon-btn icon-btn--solid" href="#/home" aria-label="Voltar ao início">${icon("arrowLeft")}</a>
          <h1>Meu perfil</h1>
          <span style="width:2.25rem"></span>
        </div>
        <div class="card profile-head">
          <span class="avatar" aria-hidden="true">${esc(initials(u.name))}</span>
          <div>
            <strong>${esc(u.name)}</strong>
            <span class="streak">${icon("flame")}${streak} ${streak === 1 ? "dia" : "dias"} de ofensiva, nível ${level}</span>
          </div>
        </div>
        <div class="card">${subjectBars()}</div>
        <h2 class="section-label">Histórico recente</h2>
        ${state.results.length ? historyList(4) : `<div class="empty"><p>Seus quizzes vão aparecer aqui.</p><a class="btn btn--light" href="#/quiz/pt">Fazer um quiz</a></div>`}
        <a class="btn btn--soft" style="margin-top:1.5rem" href="#/acessibilidade">${icon("access")}Opções de acessibilidade</a>
        <button class="btn btn--outline" style="margin-top:.75rem" id="logout">${icon("logout")}${u.guest ? "Sair do modo visitante" : "Sair da conta"}</button>`,
    after() {
      document.getElementById("logout").addEventListener("click", () => {
        state.user = null;
        store.remove("user");
        go("#/boas-vindas");
      });
    },
  };
}
