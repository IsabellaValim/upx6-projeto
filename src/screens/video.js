/* Detalhe da vídeo-aula */
import { SUBJECTS, lessonsFor } from "../data.js";
import { icon } from "../icons.js";
import { state, save } from "../core/state.js";
import { esc } from "../core/utils.js";
import { toast } from "../core/toast.js";
import { speak, stopSpeaking } from "../core/speech.js";
import home from "./home.js";
import { urls } from "../core/urls.js";

// Embed do YouTube (nunca hospedamos o vídeo). Legenda em português quando
// "Legendas" está ligado; enablejsapi permite mudar a velocidade.
const playerSrc = (youtubeId) =>
  `https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeId)}?enablejsapi=1&cc_lang_pref=pt&hl=pt-BR` +
  `&cc_load_policy=${state.a11y.subs ? 1 : 0}&origin=${encodeURIComponent(location.origin)}`;

export default function video(id, ti, li) {
  const s = SUBJECTS[id];
  const t = s?.topics[+ti];
  const l = t && lessonsFor(t)[+li];
  if (!l) return home();
  const key = `${id}/${ti}/${li}`;
  const done = !!state.watched[key];
  const lessons = lessonsFor(t);
  const next = +li + 1 < lessons.length ? urls.video(id, ti, +li + 1) : null;
  return {
    cls: "screen--nav",
    nav: "inicio",
    html: `
        <div class="topbar topbar--split">
          <a class="icon-btn icon-btn--solid" href="${urls.videos(id)}" aria-label="Voltar para as vídeo-aulas">${icon("arrowLeft")}</a>
          <h1>Vídeo-aula</h1>
          <a class="icon-btn icon-btn--solid" href="${urls.acessibilidade}" aria-label="Opções de acessibilidade">${icon("access")}</a>
        </div>
        <div class="player">
          <iframe id="yt" src="${esc(playerSrc(l.youtubeId))}" title="Vídeo-aula: ${esc(l.kind)}"
            allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen
            referrerpolicy="strict-origin-when-cross-origin"></iframe>
        </div>
        <div class="chips" role="group" aria-label="Opções do vídeo">
          <button class="chip" data-opt="subs" aria-pressed="${state.a11y.subs}">${icon("subtitles")}Legendas</button>
          <button class="chip" data-opt="voice" aria-pressed="false">${icon("volume")}Voz alta</button>
          <button class="chip" data-opt="slow" aria-pressed="${state.a11y.slow}">${icon("gauge")}Velocidade calma (0,75x)</button>
        </div>
        <p class="lesson-meta">TEMA ${+ti + 1} — ${esc(t.title.toUpperCase())} (ENCCEJA)</p>
        <h2 class="lesson-title">${esc(l.kind)}</h2>
        <p class="lesson-about">${esc(t.about)}</p>
        <a class="ext-card" href="https://www.youtube.com/watch?v=${l.youtubeId}" target="_blank" rel="noopener noreferrer">
          ${icon("external")}<span><strong>Assistir no YouTube</strong><span class="small">Abre em outra aba. Use se o vídeo não abrir aqui.</span></span>
        </a>
        <button class="btn ${done ? "btn--outline" : "btn--primary"}" id="done">${done ? `${icon("check")}Aula concluída` : "Marcar como concluída"}</button>
        ${next ? `<a class="btn btn--outline" style="margin-top:.75rem" href="${next}">Próxima aula</a>` : ""}`,
    after({ rerender }) {
      const yt = document.getElementById("yt");
      // Velocidade calma: comando da API de iframe do YouTube (enablejsapi=1).
      const speed = () =>
        yt.contentWindow?.postMessage(
          JSON.stringify({ event: "command", func: "setPlaybackRate", args: [state.a11y.slow ? 0.75 : 1] }),
          "*",
        );
      yt.addEventListener("load", speed);

      document.querySelectorAll("[data-opt]").forEach((c) =>
        c.addEventListener("click", () => {
          const opt = c.dataset.opt;
          if (opt === "voice") {
            const on = c.getAttribute("aria-pressed") !== "true";
            c.setAttribute("aria-pressed", String(on));
            on ? speak(`${l.kind}. ${t.title}. ${t.about}`) : stopSpeaking();
            return;
          }
          state.a11y[opt] = !state.a11y[opt];
          save.a11y();
          c.setAttribute("aria-pressed", String(state.a11y[opt]));
          if (opt === "subs") yt.src = playerSrc(l.youtubeId); // recarrega o player com/sem legenda
          else speed();
          toast(
            opt === "subs"
              ? state.a11y.subs
                ? "Legendas ativadas (quando o vídeo tiver)"
                : "Legendas desativadas"
              : state.a11y.slow
                ? "Velocidade calma ativada"
                : "Velocidade normal",
          );
        }),
      );
      document.getElementById("done").addEventListener("click", () => {
        if (state.watched[key]) delete state.watched[key];
        else state.watched[key] = Date.now();
        save.watched();
        toast(
          state.watched[key]
            ? "Aula marcada como concluída"
            : "Aula desmarcada",
        );
        rerender();
      });
    },
  };
}
