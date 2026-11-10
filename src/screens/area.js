/* Área (Português / Matemática): os temas da matéria, cada um com a aula e a prática */
import { SUBJECTS } from "../data.js";
import { icon } from "../icons.js";
import { state } from "../core/state.js";
import { esc } from "../core/utils.js";
import { backBtn } from "../components/nav.js";
import home from "./home.js";
import { urls } from "../core/urls.js";

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

export default function area(id) {
  const s = SUBJECTS[id];
  if (!s) return home();
  const temas = s.topics
    .map((t, i) => {
      const assistidas = t.lessons.filter((_, j) => state.watched[`${id}/${i}/${j}`]).length;
      // Abre a primeira aula ainda não assistida (ou a primeira, se já viu todas).
      const proxima = Math.max(0, t.lessons.findIndex((_, j) => !state.watched[`${id}/${i}/${j}`]));
      const detalhes = [
        t.videos ? plural(t.videos, "vídeo-aula", "vídeo-aulas") : "Sem vídeo-aula ainda",
        t.totalQuestoes ? plural(t.totalQuestoes, "questão", "questões") : "Sem questões ainda",
      ].join(" · ");
      return `<section class="mode-card topic-card" aria-labelledby="tema-${i}">
          <h2 id="tema-${i}">${esc(t.title)}</h2>
          <p class="topic-card__meta">${detalhes}${
            t.videos && assistidas === t.videos ? ` · ${icon("check")}<span>aula assistida</span>` : ""
          }</p>
          <p>${esc(t.about)}</p>
          <div class="topic-card__actions">
            ${t.videos ? `<a class="btn btn--light" href="${urls.video(id, i, proxima)}">${icon("playCircle")}Assistir aula</a>` : ""}
            ${t.totalQuestoes ? `<a class="btn btn--light" href="${urls.quiz(id, i)}">${icon("checkSquare")}Praticar</a>` : ""}
          </div>
        </section>`;
    })
    .join("");
  return {
    cls: "screen--nav",
    nav: "inicio",
    html: `
        <div class="topbar">${backBtn(urls.home)}</div>
        <h1 class="title">Área ${esc(s.name)}</h1>
        <p class="lede">Escolha um tema. Assista à aula ou pratique com algumas questões.</p>
        ${temas || `<div class="empty" style="margin-top:1.25rem"><p>Ainda não há temas nesta matéria.</p></div>`}`,
  };
}
