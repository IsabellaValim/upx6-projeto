/* Área (Português / Matemática): progresso da matéria e os temas, um aberto por vez */
import { SUBJECTS } from "../data.js";
import { icon } from "../icons.js";
import { esc } from "../core/utils.js";
import { subjectProgress, topicProgress, nextActivity } from "../core/stats.js";
import { backBtn } from "../components/nav.js";
import home from "./home.js";
import { urls } from "../core/urls.js";

// Uma frase basta na lista (o texto completo fica na tela da aula).
const primeiraFrase = (texto) => (texto.match(/^.*?[.!?](\s|$)/)?.[0] ?? texto).trim();

const barra = (done, total, rotulo) =>
  `<div class="bar" role="progressbar" aria-label="${esc(rotulo)}" aria-valuenow="${done}" aria-valuemin="0" aria-valuemax="${total}"><i style="width:${total ? (done / total) * 100 : 0}%"></i></div>`;

export default function area(id) {
  const s = SUBJECTS[id];
  if (!s) return home();
  const geral = subjectProgress(id);
  const next = nextActivity(id);
  const comecou = geral.done > 0;

  const temas = s.topics
    .map((t, i) => {
      const p = topicProgress(id, i);
      const status = p.completo
        ? `${icon("check")}Tema concluído`
        : `${p.done} de ${p.total} atividades concluídas`;
      const acoes = [
        t.totalQuestoes ? `<a class="btn btn--primary" href="${urls.quiz(id, i)}">${icon("checkSquare")}Praticar</a>` : "",
        t.videos ? `<a class="btn btn--outline" href="${urls.video(id, i, 0)}">${icon("playCircle")}Ver aula</a>` : "",
      ].join("");
      return `<details class="topic-item ${p.completo ? "is-done" : ""}" name="temas" ${next?.ti === i ? "open" : ""}>
          <summary>
            <span class="topic-item__num" aria-hidden="true">${p.completo ? icon("check") : i + 1}</span>
            <span class="topic-item__text">
              <strong>${esc(t.title)}</strong>
              <small>${status}</small>
            </span>
            ${icon("chevronDown", "chev")}
          </summary>
          <div class="topic-item__body">
            <p>${esc(primeiraFrase(t.about))}</p>
            <div class="topic-item__actions">${acoes || "<p>Conteúdo em preparação.</p>"}</div>
          </div>
        </details>`;
    })
    .join("");

  return {
    cls: "screen--nav",
    nav: "inicio",
    html: `
        <div class="topbar">${backBtn(urls.home)}</div>
        <h1 class="title">${esc(s.name)}</h1>
        <p class="lede">${!next ? "Você concluiu todas as atividades. Pratique de novo quando quiser." : comecou ? "Continue de onde você parou." : "Comece pelo primeiro tema."}</p>
        ${
          next
            ? `<a class="continue-btn" href="${next.href}">
          ${icon(next.kind === "aula" ? "playCircle" : "checkSquare")}
          <span><strong>${comecou ? "Continuar estudando" : "Começar a estudar"}</strong>
          <small>${esc(next.titulo)} · ${next.kind === "aula" ? "ver a aula" : "praticar"}</small></span>
          ${icon("chevronRight", "chev")}
        </a>`
            : ""
        }
        <section class="card progress-card" aria-labelledby="progresso-materia">
          <h2 id="progresso-materia">Seu progresso</h2>
          <p><strong>${geral.done}</strong> de ${geral.total} atividades</p>
          ${barra(geral.done, geral.total, `Progresso em ${s.name}`)}
        </section>
        <h2 class="section-label">Temas</h2>
        <div class="topic-list">${temas || `<div class="empty"><p>Ainda não há temas nesta matéria.</p></div>`}</div>`,
    after() {
      // Um tema aberto por vez (o atributo name já faz isso nos navegadores novos).
      const itens = [...document.querySelectorAll(".topic-item")];
      itens.forEach((d) =>
        d.addEventListener("toggle", () => {
          if (d.open) itens.forEach((o) => o !== d && (o.open = false));
        }),
      );
    },
  };
}
