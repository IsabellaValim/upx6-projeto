/* Acessibilidade */
import { icon } from "../icons.js";
import { state, save } from "../core/state.js";
import { go } from "../core/utils.js";
import { toast } from "../core/toast.js";
import { speak } from "../core/speech.js";

export default function acessibilidade() {
  const a = state.a11y;
  const sizes = [
    ["padrao", "Padrão"],
    ["grande", "Grande"],
    ["extragrande", "Extragrande"],
  ];
  const row = (key, ic, title, desc) => `
      <div class="toggle-row">
        ${icon(ic)}
        <div><strong id="lbl-${key}">${title}</strong><small>${desc}</small></div>
        <button class="switch" role="switch" aria-checked="${a[key]}" aria-labelledby="lbl-${key}" data-key="${key}"></button>
      </div>`;
  return {
    cls: "screen--nav",
    nav: "perfil",
    html: `
        <div class="topbar topbar--split">
          <button class="icon-btn icon-btn--solid" id="back" aria-label="Voltar">${icon("arrowLeft")}</button>
          <h1>Acessibilidade</h1>
          <span style="width:2.25rem"></span>
        </div>
        <h2 class="section-label" style="margin-top:.5rem">Tamanho do texto</h2>
        <div class="size-picker" role="group" aria-label="Tamanho do texto">
          ${sizes.map(([v, l]) => `<button data-size="${v}" aria-pressed="${a.font === v}" aria-label="${l}">A</button>`).join("")}
        </div>
        <p class="small" style="margin-top:.5rem" id="size-desc">Atual: ${sizes.find((s) => s[0] === a.font)[1]}</p>
        <h2 class="section-label">Leitura e contraste</h2>
        <div class="card card--flush">
          ${row("contrast", "contrast", "Alto contraste", "Cores mais fortes e fundo mais claro.")}
          ${row("speak", "volume", "Ler questões em voz alta", "Ouça o enunciado e as alternativas automaticamente.")}
          ${row("motion", "zap", "Reduzir animações", "Telas trocam sem efeitos de movimento.")}
        </div>
        <button class="btn btn--primary" style="margin-top:1.5rem" id="confirm">Confirmar e voltar</button>`,
    after() {
      const back = () =>
        history.length > 1 ? history.back() : go("#/perfil");
      document.getElementById("back").addEventListener("click", back);
      document.getElementById("confirm").addEventListener("click", () => {
        toast("Preferências salvas");
        back();
      });
      document.querySelectorAll("[data-size]").forEach((b) =>
        b.addEventListener("click", () => {
          a.font = b.dataset.size;
          save.a11y();
          document
            .querySelectorAll("[data-size]")
            .forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
          document.getElementById("size-desc").textContent =
            "Atual: " + b.getAttribute("aria-label");
        }),
      );
      document.querySelectorAll(".switch").forEach((sw) =>
        sw.addEventListener("click", () => {
          const k = sw.dataset.key;
          a[k] = !a[k];
          save.a11y();
          sw.setAttribute("aria-checked", String(a[k]));
          if (k === "speak" && a[k]) speak("Leitura em voz alta ativada.");
        }),
      );
    },
  };
}
