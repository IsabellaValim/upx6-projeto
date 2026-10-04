/* Área (aba-portugues / aba-matematica) */
import { SUBJECTS } from "../data.js";
import { icon } from "../icons.js";
import { backBtn } from "../components/nav.js";
import home from "./home.js";
import { urls } from "../core/urls.js";

export default function area(id) {
  const s = SUBJECTS[id];
  if (!s) return home();
  return {
    cls: "screen--nav",
    nav: "inicio",
    html: `
        <div class="topbar">${backBtn(urls.home)}</div>
        <h1 class="title">Área ${s.name}</h1>
        <p class="lede">Escolha como deseja estudar!</p>
        <section class="mode-card" aria-labelledby="m1">
          <h2 id="m1">${icon("checkSquare")}Questões e Quiz</h2>
          <p>Exercícios no estilo do Encceja, em ordem aleatória, com conjuntos diferentes a cada tentativa.</p>
          <a class="btn btn--light" href="${urls.quiz(id)}">Começar quiz</a>
        </section>
        <section class="mode-card" aria-labelledby="m2">
          <h2 id="m2">${icon("video")}Vídeo Aulas</h2>
          <p>Conteúdos organizados por tema, explicados com calma, com material complementar em cada um.</p>
          <a class="btn btn--light" href="${urls.videos(id)}">Ver vídeo-aulas</a>
        </section>`,
  };
}
