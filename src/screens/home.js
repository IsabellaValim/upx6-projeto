/* Início: logo, continuar, estudar por matéria e testar com o simulado */
import { SUBJECTS, NIVEIS, materiasDoNivel } from "../data.js";
import { icon } from "../icons.js";
import { state } from "../core/state.js";
import { esc } from "../core/utils.js";
import { subjectProgress, nextActivity } from "../core/stats.js";
import { urls } from "../core/urls.js";

// Matéria estudada por último: a da lição/simulado mais recente ou da última aula marcada.
function ultimaMateria() {
  const quando = {};
  for (const r of state.results) quando[r.subject] = Math.max(quando[r.subject] ?? 0, r.date);
  for (const [k, ts] of Object.entries(state.watched)) {
    const id = k.split("/")[0];
    quando[id] = Math.max(quando[id] ?? 0, ts);
  }
  return Object.keys(quando)
    .filter((id) => SUBJECTS[id]?.nivel === state.nivel) // só da prova escolhida
    .sort((a, b) => quando[b] - quando[a])[0];
}

export default function home() {
  const first = state.user.guest ? "" : state.user.name.split(" ")[0];
  const materias = materiasDoNivel(state.nivel).map((s) => s.id);
  const ultima = ultimaMateria();
  const next = ultima && nextActivity(ultima);

  const linha = (id) => {
    const s = SUBJECTS[id];
    const p = subjectProgress(id);
    return `<a class="subject-row" href="${urls.area(id)}">
        ${icon(s.icon)}
        <span>
          <strong>${esc(s.name)}</strong>
          <small>${p.done} de ${p.total} atividades</small>
          <span class="mini-bar" aria-hidden="true"><i style="width:${p.total ? (p.done / p.total) * 100 : 0}%"></i></span>
        </span>
        ${icon("chevronRight", "chev")}
      </a>`;
  };

  return {
    cls: "screen--nav",
    nav: "inicio",
    html: `
        <img class="brand-logo" src="src/assets/branding/logo-primary.svg" alt="Estudaê">
        <h1 class="title home-greeting">${first ? `Olá, ${esc(first)}! Vamos estudar?` : "Olá! Vamos estudar?"}</h1>
        <p class="lede">Prova do Encceja: <strong>${NIVEIS[state.nivel]?.nome ?? ""}</strong> · <a class="link" href="${urls.nivel}">Trocar</a></p>
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
        <h2 class="section-label">Estudar por matéria</h2>
        ${
          materias.length
            ? `<div class="subject-list">${materias.map(linha).join("")}</div>`
            : `<div class="empty"><p>Ainda não há matérias disponíveis. Volte mais tarde.</p></div>`
        }
        ${
          materias.length
            ? `<h2 class="section-label">Testar o que aprendeu</h2>
        <a class="subject-row subject-row--sim" href="${urls.simulado()}">
          ${icon("clock")}
          <span><strong>Simulado</strong><small>Como no dia da prova, com tempo e resultado no fim.</small></span>
          ${icon("chevronRight", "chev")}
        </a>`
            : ""
        }`,
  };
}
