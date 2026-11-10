/* ==========================================================
   Roteador — SPA com rotas por hash
   ========================================================== */
import { state, applyA11y } from "./core/state.js";
import { go } from "./core/utils.js";
import { mount } from "./core/mount.js";
import { urls } from "./core/urls.js";
import { screens } from "./screens/index.js";
import { carregarCatalogo } from "./data.js";

const PUBLIC = new Set(["loading", "boas-vindas", "login", "cadastro"]);

// As telas leem o catálogo (SUBJECTS) de forma síncrona: só renderiza depois
// que ele chegou da API.
let catalogoPronto = false;

const erroCatalogo = () => ({
  cls: "screen--center",
  html: `
      <h1 class="title">Não foi possível carregar o conteúdo</h1>
      <p class="lede">Confira sua conexão com a internet e tente de novo.</p>
      <button class="btn btn--primary" style="margin-top:1.5rem" id="retry">Tentar de novo</button>`,
  after() {
    document.getElementById("retry").addEventListener("click", carregar);
  },
});

async function carregar() {
  mount(screens.loading, [], { focus: false });
  try {
    await carregarCatalogo();
    catalogoPronto = true;
    render();
  } catch {
    mount(erroCatalogo);
  }
}

function render() {
  if (!catalogoPronto) return;
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  // Links antigos: a lista de vídeo-aulas virou a própria área, e o quiz agora
  // é por tema. Os dois levam para a área da matéria.
  if ((parts[0] === "videos" || (parts[0] === "quiz" && parts.length === 2)) && parts[1]) {
    location.replace(urls.area(parts[1]));
    return;
  }
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
  carregar();
}
