/* ==========================================================
   Mount — injeta o retorno de uma tela no #app
   (contrato: screen(...params) => { cls, nav, html, after })
   ========================================================== */
import { $app, $sheetRoot } from "./dom.js";
import { stopSpeaking } from "./speech.js";
import { nav } from "../components/nav.js";

export function mount(screen, params = [], { focus = true } = {}) {
  stopSpeaking();
  $sheetRoot.innerHTML = "";
  const out = screen(...params);
  $app.innerHTML = `<main class="screen ${out.cls || ""}" id="main">${out.html}</main>${out.nav ? nav(out.nav) : ""}`;
  window.scrollTo(0, 0);
  $app.scrollTop = 0;
  out.after && out.after({ rerender: () => mount(screen, params, { focus }) });

  const h1 = $app.querySelector("h1");
  if (h1 && focus) {
    h1.tabIndex = -1;
    h1.focus({ preventScroll: true });
  }
  document.title = (h1 ? h1.textContent.trim() + " — " : "") + "Estudaê";
}
