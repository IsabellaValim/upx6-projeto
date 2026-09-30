/* Boas-vindas (Main-activity) */
import { icon } from "../icons.js";
import { state, save } from "../core/state.js";
import { go } from "../core/utils.js";
import { urls } from "../core/urls.js";

export default function boasVindas() {
  return {
    html: `
      <div class="welcome-hero">
        <div class="logo-mark">${icon("book")}</div>
        <h1 class="display">Estudaê</h1>
        <p>Estude para o Encceja com questões e vídeo-aulas, no seu ritmo. Telas simples e textos grandes, pensadas para você.</p>
      </div>
      <div class="stack">
        <a class="btn btn--soft" href="${urls.cadastro}">Criar conta</a>
        <a class="btn btn--outline" href="${urls.login}">Já tenho conta</a>
        <button class="link" id="guest" style="align-self:center;display:block;margin:1rem auto 0">Continuar sem conta</button>
      </div>`,
    after() {
      document.getElementById("guest").addEventListener("click", () => {
        state.user = { name: "Visitante", guest: true };
        save.user();
        go(urls.home);
      });
    },
  };
}
