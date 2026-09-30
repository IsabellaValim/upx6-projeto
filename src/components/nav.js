/* ---------- Pedaços de interface: navegação ---------- */
import { icon } from "../icons.js";

export const backBtn = (href, label = "Voltar") =>
  `<a class="icon-btn" href="${href}" aria-label="${label}">${icon("back")}</a>`;

export function nav(active) {
  const items = [
    ["inicio", "#/home", "home", "Início"],
    ["progresso", "#/progresso", "trend", "Progresso"],
    ["perfil", "#/perfil", "user", "Perfil"],
  ];
  return `<nav class="bottom-nav" aria-label="Navegação principal">${items
    .map(
      ([id, href, ic, label]) =>
        `<a href="${href}" ${id === active ? 'aria-current="page"' : ""}>${icon(ic)}<span>${label}</span></a>`,
    )
    .join("")}</nav>`;
}
