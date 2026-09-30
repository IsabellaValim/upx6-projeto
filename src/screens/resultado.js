/* Resultado do quiz */
import { SUBJECTS } from "../data.js";
import { icon } from "../icons.js";
import { state } from "../core/state.js";
import { LETTERS, esc, pct } from "../core/utils.js";
import progresso from "./progresso.js";

export default function resultado(idx) {
  const r = state.results[+idx];
  if (!r) return progresso();
  const s = SUBJECTS[r.subject];
  const p = pct(r.correct, r.total);
  const C = 2 * Math.PI * 42;
  const weak = r.weakTopic !== null ? s.topics[r.weakTopic] : null;
  return {
    cls: "screen--nav",
    nav: "progresso",
    html: `
        <div class="topbar topbar--split result-head">
          <div><h1>Resultado do quiz</h1><p class="kicker">Tema: ${s.name}</p></div>
          <a class="icon-btn" href="#/home" aria-label="Fechar resultado">${icon("xBox")}</a>
        </div>
        <div class="donut" role="img" aria-label="${p}% de aproveitamento">
          <svg viewBox="0 0 100 100"><circle class="track" cx="50" cy="50" r="42"/>
          <circle class="value" cx="50" cy="50" r="42" stroke-dasharray="${C}" stroke-dashoffset="${C}" data-offset="${C * (1 - p / 100)}"/></svg>
          <div class="donut-label"><strong>${p}%</strong><span>de aproveitamento</span></div>
        </div>
        <div class="stats">
          <div class="stat stat--ok"><strong>${r.correct}</strong><span>Acertos</span></div>
          <div class="stat stat--bad"><strong>${r.total - r.correct}</strong><span>Erros</span></div>
          <div class="stat"><strong>${r.total}</strong><span>Questões</span></div>
        </div>
        <div class="tip">
          ${
            weak
              ? `<p>Você teve mais dificuldade no tema “${esc(weak.title)}”.</p>
               <p>Você pode revisar este conteúdo antes de tentar novamente.</p>
               <a class="btn btn--primary btn--sm" href="#/video/${r.subject}/${r.weakTopic}/0">${icon("video")}Assistir vídeo-aula recomendada</a>`
              : `<p>Você acertou todas as questões. Excelente trabalho!</p>
               <p>Continue praticando para manter o ritmo até a prova.</p>
               <a class="btn btn--primary btn--sm" href="#/videos/${r.subject}">${icon("video")}Explorar vídeo-aulas</a>`
          }
        </div>
        <details class="review">
          <summary>Ver correção das questões</summary>
          ${r.items
            .map((x, k) => {
              const item = s.questions[x.q];
              return `<div class="review-item ${x.ok ? "ok" : "bad"}">
              <p><span class="mark">${x.ok ? "Acertou" : "Errou"}</span> — ${k + 1}. ${esc(item.ask)}</p>
              <p>Resposta certa: ${LETTERS[item.answer]}) ${esc(item.options[item.answer])}${!x.ok && x.chosen !== undefined ? ` · Você marcou ${LETTERS[x.chosen]}` : ""}</p>
              <p>${esc(item.why)}</p>
            </div>`;
            })
            .join("")}
        </details>
        <a class="btn btn--outline" style="margin-top:1rem" href="#/quiz/${r.subject}">Refazer quiz</a>
        <p class="small center" style="margin-top:1rem">Resumo do desempenho salvo no seu perfil.</p>`,
    after() {
      requestAnimationFrame(() => {
        const v = document.querySelector(".donut .value");
        if (v) v.style.strokeDashoffset = v.dataset.offset;
      });
    },
  };
}
