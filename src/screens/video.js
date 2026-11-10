/* Vídeo-aula: o vídeo, o que ele ensina e uma ação principal (ir praticar) */
import { SUBJECTS, lessonsFor } from "../data.js";
import { icon } from "../icons.js";
import { state, save } from "../core/state.js";
import { esc, go } from "../core/utils.js";
import { toast } from "../core/toast.js";
import home from "./home.js";
import { urls } from "../core/urls.js";

// Embed do YouTube (nunca hospedamos o vídeo). Legenda em português quando
// "Legendas" está ligado; enablejsapi permite mudar a velocidade.
const playerSrc = (youtubeId) =>
  `https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeId)}?enablejsapi=1&cc_lang_pref=pt&hl=pt-BR` +
  `&cc_load_policy=${state.a11y.subs ? 1 : 0}&origin=${encodeURIComponent(location.origin)}`;

// "Como calcular porcentagem (Gis com Giz)" → título + canal.
function separarCanal(titulo) {
  const m = titulo.match(/^(.*\S)\s+\(([^()]+)\)$/);
  return m ? { titulo: m[1], canal: m[2] } : { titulo, canal: null };
}

const OPCOES = [
  ["subs", "subtitles", "Legendas", "Em português, quando o vídeo tiver."],
  ["slow", "gauge", "Velocidade calma", "O vídeo toca mais devagar (0,75x)."],
];

export default function video(id, ti, li) {
  const s = SUBJECTS[id];
  const t = s?.topics[+ti];
  const l = t && lessonsFor(t)[+li];
  if (!l) return home();
  const key = `${id}/${ti}/${li}`;
  const done = !!state.watched[key];
  const lessons = lessonsFor(t);
  const next = +li + 1 < lessons.length ? urls.video(id, ti, +li + 1) : null;
  const { titulo, canal } = separarCanal(l.kind);
  const meta = [canal, `Tema ${+ti + 1} de ${s.topics.length}`, l.min && `${l.min} min`].filter(Boolean);

  const opcao = ([k, ic, nome, desc]) => `
      <div class="toggle-row">
        ${icon(ic)}
        <div><strong id="lbl-${k}">${nome}</strong><small>${desc}</small></div>
        <span class="switch-state" id="estado-${k}" aria-hidden="true">${state.a11y[k] ? "Ligado" : "Desligado"}</span>
        <button class="switch" role="switch" aria-checked="${!!state.a11y[k]}" aria-labelledby="lbl-${k}" data-opt="${k}"></button>
      </div>`;

  return {
    cls: "screen--nav",
    nav: "inicio",
    html: `
        <div class="topbar topbar--split">
          <a class="icon-btn icon-btn--solid" href="${urls.area(id)}" aria-label="Voltar para os temas">${icon("arrowLeft")}</a>
          <p class="topbar-title">${esc(t.title)}</p>
          <a class="icon-btn icon-btn--solid" href="${urls.acessibilidade}" aria-label="Opções de acessibilidade">${icon("access")}</a>
        </div>
        <div class="player">
          <iframe id="yt" src="${esc(playerSrc(l.youtubeId))}" title="Vídeo-aula: ${esc(titulo)}"
            allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen
            referrerpolicy="strict-origin-when-cross-origin"></iframe>
        </div>
        <h1 class="lesson-title">${esc(titulo)}</h1>
        <p class="lesson-meta">${meta.map(esc).join(" · ")}</p>
        ${done ? `<p class="lesson-done">${icon("check")}Você já viu esta aula</p>` : ""}
        <p class="lesson-about">${esc(t.about)}</p>

        <div class="lesson-actions">
          ${
            t.totalQuestoes
              ? `<button class="btn btn--primary" id="practice">${icon("checkSquare")}${done ? "Praticar este tema" : "Terminei a aula, quero praticar"}</button>`
              : ""
          }
          ${next ? `<a class="btn btn--outline" href="${next}">Próxima aula</a>` : ""}
          ${
            done
              ? `<a class="btn btn--outline" href="${urls.area(id)}">Voltar para os temas</a>`
              : `<button class="btn btn--outline" id="seen">Marcar como vista e voltar</button>`
          }
        </div>

        <h2 class="section-label">Opções do vídeo</h2>
        <div class="card card--flush">${OPCOES.map(opcao).join("")}</div>

        <p class="small video-fallback">O vídeo não abriu?
          <a class="link" href="https://www.youtube.com/watch?v=${l.youtubeId}" target="_blank" rel="noopener noreferrer">Assistir no YouTube${icon("external")}<span class="sr-only"> (abre em outra aba)</span></a>
        </p>`,
    after() {
      const yt = document.getElementById("yt");
      // Velocidade calma: comando da API de iframe do YouTube (enablejsapi=1).
      const speed = () =>
        yt.contentWindow?.postMessage(
          JSON.stringify({ event: "command", func: "setPlaybackRate", args: [state.a11y.slow ? 0.75 : 1] }),
          "*",
        );
      yt.addEventListener("load", speed);

      // Concluir a aula conta como atividade (stats.js).
      const marcar = () => {
        if (!state.watched[key]) {
          state.watched[key] = Date.now();
          save.watched();
        }
      };
      document.getElementById("practice")?.addEventListener("click", () => {
        marcar();
        go(urls.quiz(id, +ti));
      });
      document.getElementById("seen")?.addEventListener("click", () => {
        marcar();
        toast("Aula marcada como vista");
        go(urls.area(id));
      });

      document.querySelectorAll("[data-opt]").forEach((sw) =>
        sw.addEventListener("click", () => {
          const k = sw.dataset.opt;
          state.a11y[k] = !state.a11y[k];
          save.a11y();
          sw.setAttribute("aria-checked", String(state.a11y[k]));
          document.getElementById("estado-" + k).textContent = state.a11y[k] ? "Ligado" : "Desligado";
          if (k === "subs") yt.src = playerSrc(l.youtubeId); // recarrega o player com/sem legenda
          else speed();
          toast(
            k === "subs"
              ? state.a11y.subs ? "Legendas ligadas (quando o vídeo tiver)" : "Legendas desligadas"
              : state.a11y.slow ? "Velocidade calma ligada" : "Velocidade normal",
          );
        }),
      );
    },
  };
}
