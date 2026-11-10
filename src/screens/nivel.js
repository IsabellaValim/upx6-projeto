/* Escolha da prova (Ensino Fundamental ou Médio). Aparece uma vez; dá para trocar no Perfil. */
import { NIVEIS, materiasDoNivel } from "../data.js";
import { icon } from "../icons.js";
import { state, save } from "../core/state.js";
import { esc, go } from "../core/utils.js";
import { toast } from "../core/toast.js";
import { backBtn } from "../components/nav.js";
import { urls } from "../core/urls.js";

export default function nivel() {
  const trocando = !!state.nivel;
  return {
    cls: trocando ? "screen--nav" : "",
    nav: trocando ? "perfil" : undefined,
    html: `
        ${trocando ? `<div class="topbar">${backBtn(urls.home)}</div>` : `<img class="brand-logo" src="src/assets/branding/logo-primary.svg" alt="Estudaê">`}
        <h1 class="title" style="margin-top:1.25rem">Qual prova do Encceja você vai fazer?</h1>
        <p class="lede">Assim mostramos as matérias e questões certas para você. Dá para trocar depois, no seu perfil.</p>
        <div class="subject-list" style="margin-top:1.25rem">
          ${Object.entries(NIVEIS)
            .map(([id, n]) => {
              const materias = materiasDoNivel(id).map((s) => s.name).join(" e ");
              const atual = state.nivel === id;
              return `<button class="subject-row level-option ${atual ? "is-current" : ""}" data-nivel="${id}" ${atual ? 'aria-current="true"' : ""}>
                ${icon(id === "medio" ? "book" : "pen")}
                <span><strong>${n.nome}</strong><small>${esc(n.sobre)}${materias ? ` ${esc(materias)}.` : ""}</small>${atual ? `<small class="level-current">${icon("check")}Sua prova atual</small>` : ""}</span>
                ${icon("chevronRight", "chev")}
              </button>`;
            })
            .join("")}
        </div>`,
    after() {
      document.querySelectorAll("[data-nivel]").forEach((b) =>
        b.addEventListener("click", () => {
          const mudou = state.nivel !== b.dataset.nivel;
          state.nivel = b.dataset.nivel;
          save.nivel();
          if (mudou && trocando) toast(`Prova trocada para ${NIVEIS[state.nivel].nome}`);
          go(urls.home);
        }),
      );
    },
  };
}
