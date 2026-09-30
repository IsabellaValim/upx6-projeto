/* Folha inferior (bottom-sheet) para escolhas rápidas */
import { icon } from "../icons.js";
import { $sheetRoot } from "../core/dom.js";
import { esc } from "../core/utils.js";
import { urls } from "../core/urls.js";

export function openSheet(title, options) {
  $sheetRoot.innerHTML = `
      <div class="sheet-backdrop" data-close>
        <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
          <h2 id="sheet-title">${esc(title)}</h2>
          <div class="action-list">
            ${options.map((o) => `<a class="action-row" href="${o.href}">${icon(o.icon)}${esc(o.label)}${icon("chevronRight", "chev")}</a>`).join("")}
          </div>
          <button class="btn btn--outline" style="margin-top:1rem" data-close>Cancelar</button>
        </div>
      </div>`;
  const close = () => {
    $sheetRoot.innerHTML = "";
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (e) => {
    if (e.key === "Escape") close();
  };
  document.addEventListener("keydown", onKey);
  $sheetRoot.querySelectorAll("[data-close]").forEach((el) =>
    el.addEventListener("click", (e) => {
      if (e.target === el) close();
    }),
  );
  $sheetRoot
    .querySelectorAll("a")
    .forEach((a) => a.addEventListener("click", close));
  $sheetRoot.querySelector(".action-row")?.focus();
}

export const chooseSubject = (kind) =>
  openSheet(
    kind === "quiz"
      ? "Qual quiz você quer fazer?"
      : "Quais vídeo-aulas você quer ver?",
    [
      {
        label: "Português",
        icon: "pen",
        href: kind === "quiz" ? urls.quiz("pt") : urls.videos("pt"),
      },
      {
        label: "Matemática",
        icon: "percent",
        href: kind === "quiz" ? urls.quiz("mat") : urls.videos("mat"),
      },
    ],
  );
