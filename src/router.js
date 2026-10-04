/* ==========================================================
   Roteador — SPA com rotas por hash
   ========================================================== */
import { state, applyA11y } from "./core/state.js";
import { go } from "./core/utils.js";
import { mount } from "./core/mount.js";
import { urls } from "./core/urls.js";
import { screens } from "./screens/index.js";

const PUBLIC = new Set(["loading", "boas-vindas", "login", "cadastro"]);

function render() {
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  let name = parts[0] || "loading";
  if (!screens[name]) name = state.user ? "home" : "boas-vindas";
  if (!PUBLIC.has(name) && !state.user) {
    go(urls.boasVindas);
    return;
  }
  if (
    name !== "quiz" &&
    state.quiz &&
    !state.quiz.finished &&
    name !== "acessibilidade"
  )
    state.quiz = null;
  mount(screens[name], parts.slice(1), { focus: name !== "loading" });
}

export function init() {
  applyA11y();
  window.addEventListener("hashchange", render);
  render();
}
