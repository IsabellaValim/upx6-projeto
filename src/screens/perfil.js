/* Perfil: quem você é, os ajustes do app e a conta.
   Progresso e histórico ficam só na aba Progresso — não se repetem aqui. */
import { NIVEIS } from "../data.js";
import { icon } from "../icons.js";
import { state } from "../core/state.js";
import { store } from "../core/store.js";
import { esc, go, initials } from "../core/utils.js";
import { streakDays } from "../core/stats.js";
import { urls } from "../core/urls.js";

export default function perfil() {
  const u = state.user;
  const streak = streakDays();

  const ajuste = (href, ic, titulo, desc) => `
        <a class="toggle-row" href="${href}">
          ${icon(ic)}
          <div><strong>${titulo}</strong><small>${desc}</small></div>
          ${icon("chevronRight", "chev")}
        </a>`;

  return {
    cls: "screen--nav",
    nav: "perfil",
    html: `
        <div class="topbar topbar--split">
          <a class="icon-btn icon-btn--solid" href="${urls.home}" aria-label="Voltar ao início">${icon("arrowLeft")}</a>
          <h1>Meu perfil</h1>
          <span style="width:2.25rem"></span>
        </div>
        <div class="card profile-head">
          <span class="avatar" aria-hidden="true">${esc(initials(u.name))}</span>
          <div>
            <strong>${esc(u.name)}</strong>
            <small class="profile-note">${
              u.guest
                ? "Estudando sem conta — o progresso fica salvo neste aparelho."
                : esc(u.login ?? "")
            }</small>
            <span class="streak">${icon("flame")}${
              streak
                ? `${streak} ${streak === 1 ? "dia" : "dias"} de ofensiva`
                : "Estude hoje para começar uma ofensiva"
            }</span>
          </div>
        </div>
        ${u.guest ? `<button class="btn btn--primary" id="sair" style="margin-top:1rem">${icon("user")}Entrar ou criar conta</button>` : ""}
        <h2 class="section-label">Ajustes</h2>
        <div class="card card--flush">
          ${ajuste(urls.nivel, "book", "Prova do Encceja", NIVEIS[state.nivel]?.nome ?? "Ainda não escolhida")}
          ${ajuste(urls.acessibilidade, "access", "Acessibilidade", "Tamanho do texto, contraste e leitura em voz alta")}
        </div>
        ${u.guest ? "" : `<button class="btn btn--outline" id="sair" style="margin-top:1.5rem">${icon("logout")}Sair da conta</button>`}`,
    after() {
      document.getElementById("sair").addEventListener("click", () => {
        state.user = null;
        store.remove("user");
        go(urls.boasVindas);
      });
    },
  };
}
