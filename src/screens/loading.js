/* Carregando */
import { state } from "../core/state.js";
import { go } from "../core/utils.js";
import { urls } from "../core/urls.js";

export default function loading() {
  return {
    cls: "screen--center",
    html: `
      <img class="brand-symbol" src="src/assets/branding/icon.svg" alt="">
      <h1 class="display">Carregando…</h1>
      <div class="spinner" role="progressbar" aria-label="Carregando o Estudaê"></div>
      <p class="kicker">Aguarde!</p>`,
    after() {
      setTimeout(() => {
        if (location.hash === "" || location.hash === "#/loading")
          go(state.user ? urls.home : urls.boasVindas);
      }, 1600);
    },
  };
}
