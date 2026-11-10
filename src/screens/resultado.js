/* Resultado do quiz */
import { SUBJECTS } from "../data.js";
import { icon } from "../icons.js";
import { state } from "../core/state.js";
import { LETTERS, esc, pct } from "../core/utils.js";
import progresso from "./progresso.js";
import { urls } from "../core/urls.js";

export default function resultado(idx) {
  const r = state.results[+idx];
  const s = r && SUBJECTS[r.subject];
  if (!s) return progresso();
  const p = pct(r.correct, r.total);
  const C = 2 * Math.PI * 42;
  // Lição por tema (v: 3). Resultados antigos, da matéria inteira, não têm tema.
  const t = r.topic !== undefined ? s.topics[r.topic] : null;
  const watch = t?.videos ? urls.video(r.subject, r.topic, 0) : null;
  return {
    cls: "screen--nav",
    nav: "progresso",
    html: `
        <div class="topbar topbar--split result-head">
          <div><h1>Resultado da lição</h1><p class="kicker">${esc(s.name)}${t ? " · " + esc(t.title) : ""}</p></div>
          <a class="icon-btn" href="${urls.home}" aria-label="Fechar resultado">${icon("xBox")}</a>
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
            r.correct < r.total
              ? `<p>Que tal rever a aula deste tema antes de praticar de novo?</p>
               <p>Na próxima lição as questões vêm em outra ordem.</p>`
              : `<p>Você acertou todas as questões. Excelente trabalho!</p>
               <p>Escolha outro tema para continuar praticando.</p>`
          }
          ${watch ? `<a class="btn btn--primary btn--sm" href="${watch}">${icon("video")}Assistir a aula deste tema</a>` : ""}
        </div>
        <details class="review">
          <summary>Ver correção das questões</summary>
          ${r.items
            .map((x, k) => {
              // A correção (resposta certa e explicação) veio da API e foi guardada no resultado.
              return `<div class="review-item ${x.ok ? "ok" : "bad"}">
              <p><span class="mark">${x.ok ? "Acertou" : "Errou"}</span> — ${k + 1}. ${esc(x.ask)}</p>
              <p>Resposta certa: ${LETTERS[x.answer]}) ${esc(x.options[x.answer])}${!x.ok && x.chosen !== undefined ? ` · Você marcou ${LETTERS[x.chosen]}` : ""}</p>
              <p>${esc(x.why)}</p>
            </div>`;
            })
            .join("")}
        </details>
        ${t ? `<a class="btn btn--outline" style="margin-top:1rem" href="${urls.quiz(r.subject, r.topic)}">Praticar de novo</a>` : ""}
        <a class="btn btn--outline" style="margin-top:.75rem" href="${urls.area(r.subject)}">Escolher outro tema</a>
        <p class="small center" style="margin-top:1rem">Resumo do desempenho salvo no seu perfil.</p>`,
    after() {
      requestAnimationFrame(() => {
        const v = document.querySelector(".donut .value");
        if (v) v.style.strokeDashoffset = v.dataset.offset;
      });
    },
  };
}
