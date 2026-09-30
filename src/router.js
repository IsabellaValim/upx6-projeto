/* ==========================================================
   Roteador — SPA com rotas por hash
   ========================================================== */
import { $app, $sheetRoot } from "./core/dom.js";
import { state, applyA11y } from "./core/state.js";
import { go } from "./core/utils.js";
import { stopSpeaking } from "./core/speech.js";
import { nav } from "./components/nav.js";
import { screens } from "./screens/index.js";
import { urls } from "./core/urls.js";

const PUBLIC = new Set(["loading", "boas-vindas", "login", "cadastro"]);

function render() {
  stopSpeaking();
  $sheetRoot.innerHTML = "";
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

  const out = screens[name](...parts.slice(1));
  $app.innerHTML = `<main class="screen ${out.cls || ""}" id="main">${out.html}</main>${out.nav ? nav(out.nav) : ""}`;
  window.scrollTo(0, 0);
  $app.scrollTop = 0;
  out.after && out.after({ rerender: render });

  const h1 = $app.querySelector("h1");
  if (h1 && name !== "loading") {
    h1.tabIndex = -1;
    h1.focus({ preventScroll: true });
  }
  document.title = (h1 ? h1.textContent.trim() + " — " : "") + "Estudaê";
}

export function init() {
  applyA11y();
  window.addEventListener("hashchange", render);
  render();
}
