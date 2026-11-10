/* Início: a matéria é escolhida aqui, uma vez só */
import { SUBJECTS } from "../data.js";
import { icon } from "../icons.js";
import { state } from "../core/state.js";
import { esc } from "../core/utils.js";
import { subjectProgress, nextActivity } from "../core/stats.js";
import { urls } from "../core/urls.js";

// Matéria estudada por último: a da lição mais recente ou da última aula marcada.
function ultimaMateria() {
  const quando = {};
  for (const r of state.results) quando[r.subject] = Math.max(quando[r.subject] ?? 0, r.date);
  for (const [k, ts] of Object.entries(state.watched)) {
    const id = k.split("/")[0];
    quando[id] = Math.max(quando[id] ?? 0, ts);
  }
  return Object.keys(quando).filter((id) => SUBJECTS[id]).sort((a, b) => quando[b] - quando[a])[0];
}

export default function home() {
  const first = state.user.name.split(" ")[0];
  const tile = (id) => {
    const s = SUBJECTS[id];
    const p = subjectProgress(id);
    return `<a class="subject-tile" href="${urls.area(id)}">
        ${icon(s.icon)}
        <strong>${esc(s.name)}</strong>
        <span>${p.done} de ${p.total} atividades</span>
        <div class="mini-bar" aria-hidden="true"><i style="width:${p.total ? (p.done / p.total) * 100 : 0}%"></i></div>
      </a>`;
  };

  const ultima = ultimaMateria();
  const next = ultima && nextActivity(ultima);

  return {
    cls: "screen--nav",
    nav: "inicio",
    html: `
        <p class="kicker">${state.user.guest ? "Bem-vindo ao Estudaê!" : `Bem-vindo de volta, ${esc(first)}!`}</p>
        <h1 class="title" style="margin-top:.25rem">Pronto para estudar para o Encceja?</h1>
        ${
          next
            ? `<a class="continue-btn" href="${next.href}">
          ${icon(next.kind === "aula" ? "playCircle" : "checkSquare")}
          <span><strong>Continuar estudando</strong>
          <small>${esc(SUBJECTS[ultima].name)} · ${esc(next.titulo)}</small></span>
          ${icon("chevronRight", "chev")}
        </a>`
            : ""
        }
        <h2 class="section-label">Escolha a matéria</h2>
        ${
          Object.keys(SUBJECTS).length
            ? `<div class="subject-grid" style="margin-top:0">${Object.keys(SUBJECTS).map(tile).join("")}</div>`
            : `<div class="empty"><p>Ainda não há matérias disponíveis. Volte mais tarde.</p></div>`
        }`,
  };
}
