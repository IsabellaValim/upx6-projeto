/* Carregando */
import { icon } from "../icons.js";
import { state } from "../core/state.js";
import { go } from "../core/utils.js";

export default function loading() {
  return {
    cls: "screen--center",
    html: `
      <div class="logo-mark">${icon("book")}</div>
      <h1 class="display">Carregando…</h1>
      <div class="spinner" role="progressbar" aria-label="Carregando o Estudaê"></div>
      <p class="kicker">Aguarde!</p>`,
    after() {
      setTimeout(() => {
        if (location.hash === "" || location.hash === "#/loading")
          go(state.user ? "#/home" : "#/boas-vindas");
      }, 1600);
    },
  };
}
