/* Boas-vindas (Main-activity) */
import { state, save } from "../core/state.js";
import { go } from "../core/utils.js";
import { urls } from "../core/urls.js";

export default function boasVindas() {
  return {
    html: `
      <div class="welcome-hero">
        <h1 class="brand-logo brand-logo--hero"><img src="src/assets/branding/logo-primary.svg" alt="Estudaê"></h1>
        <p class="display">Estudar para o Encceja, no seu ritmo.</p>
        <p>Questões e vídeo-aulas com telas simples e textos grandes, pensadas para você.</p>
      </div>
      <div class="stack">
        <a class="btn btn--primary" href="${urls.cadastro}">Criar conta</a>
        <a class="btn btn--soft" href="${urls.login}">Já tenho conta</a>
        <button class="btn btn--light" id="guest" style="width:100%">Continuar sem conta</button>
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
