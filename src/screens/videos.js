/* Lista de vídeo-aulas */
import { SUBJECTS, lessonsFor } from "../data.js";
import { icon } from "../icons.js";
import { state } from "../core/state.js";
import { esc } from "../core/utils.js";
import { watchedCount, totalLessons } from "../core/stats.js";
import { backBtn } from "../components/nav.js";
import home from "./home.js";
import { urls } from "../core/urls.js";

export default function videos(id) {
  const s = SUBJECTS[id];
  if (!s) return home();
  const topics = s.topics
    .map((t, i) => {
      const lessons = lessonsFor(t);
      return `<details class="topic" ${i === 0 ? "open" : ""}>
        <summary>
          <span class="topic-num" aria-hidden="true">${i + 1}</span>
          <span class="topic-pill">Tema ${i + 1} — ${esc(t.title)}<small>${t.videos} vídeos</small></span>
          ${icon("chevronDown", "chev")}
        </summary>
        <div class="lessons">
          ${lessons
            .map((l, j) => {
              const done = state.watched[`${id}/${i}/${j}`];
              return `<a class="lesson ${done ? "done" : ""}" href="${urls.video(id, i, j)}">
              ${icon(done ? "check" : "playCircle")}<span>${l.kind}${done ? '<span class="sr-only"> (concluído)</span>' : ""}</span>
              <span class="dur">${l.min} min</span></a>`;
            })
            .join("")}
        </div>
      </details>`;
    })
    .join("");
  return {
    cls: "screen--nav",
    nav: "inicio",
    html: `
        <div class="topbar">${backBtn(urls.area(id))}</div>
        <p class="kicker">${s.name} (Encceja)</p>
        <h1 class="title">Vídeo-aulas</h1>
        <p class="small" style="margin-top:.25rem">${watchedCount(id)} de ${totalLessons(id)} aulas concluídas</p>
        ${topics}`,
  };
}
