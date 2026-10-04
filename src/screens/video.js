/* Detalhe da vídeo-aula */
import { SUBJECTS, lessonsFor } from "../data.js";
import { icon } from "../icons.js";
import { state, save } from "../core/state.js";
import { esc } from "../core/utils.js";
import { toast } from "../core/toast.js";
import { speak, stopSpeaking } from "../core/speech.js";
import home from "./home.js";
import { urls } from "../core/urls.js";

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
        <div class="player" aria-label="Player de vídeo">
          <button class="player-btn" id="play" aria-label="Reproduzir vídeo">${icon("play")}</button>
          <p class="player-caption" id="caption" hidden>Vamos começar identificando o assunto principal do texto…</p>
          <div class="player-progress" aria-hidden="true"><i id="bar"></i></div>
        </div>
        <div class="chips" role="group" aria-label="Opções do vídeo">
          <button class="chip" data-opt="subs" aria-pressed="${state.a11y.subs}">${icon("subtitles")}Legendas grandes</button>
          <button class="chip" data-opt="voice" aria-pressed="false">${icon("volume")}Voz alta</button>
          <button class="chip" data-opt="slow" aria-pressed="${state.a11y.slow}">${icon("gauge")}Velocidade calma (0,75x)</button>
        </div>
        <p class="lesson-meta">TEMA ${+ti + 1} — ${esc(t.title.toUpperCase())} (ENCCEJA)</p>
        <h2 class="lesson-title">${l.kind}: ${esc(t.title.toLowerCase())}</h2>
        <p class="lesson-about">${esc(t.about)}</p>
        <a class="ext-card" href="https://www.youtube.com/results?search_query=${encodeURIComponent("encceja " + t.title)}" target="_blank" rel="noopener">
          ${icon("external")}<span><strong>Assistir na plataforma de vídeos</strong><span class="small">Abre em outra aba</span></span>
        </a>
        <button class="btn ${done ? "btn--outline" : "btn--primary"}" id="done">${done ? `${icon("check")}Aula concluída` : "Marcar como concluída"}</button>
        ${next ? `<a class="btn btn--outline" style="margin-top:.75rem" href="${next}">Próxima aula</a>` : ""}`,
    after({ rerender }) {
      let playing = false,
        progress = 0,
        timer = null;
      const play = document.getElementById("play");
      const bar = document.getElementById("bar");
      const cap = document.getElementById("caption");
      const tick = () => {
        progress = Math.min(100, progress + (state.a11y.slow ? 0.75 : 1));
        bar.style.width = progress + "%";
        if (progress >= 100) toggle(false);
      };
      const toggle = (on) => {
        playing = on;
        play.innerHTML = icon(on ? "pause" : "play");
        play.setAttribute(
          "aria-label",
          on ? "Pausar vídeo" : "Reproduzir vídeo",
        );
        cap.hidden = !on;
        clearInterval(timer);
        if (on) timer = setInterval(tick, 300);
      };
      play.addEventListener("click", () => toggle(!playing));
      window.addEventListener("hashchange", () => clearInterval(timer), {
        once: true,
      });

      document.querySelectorAll("[data-opt]").forEach((c) =>
        c.addEventListener("click", () => {
          const opt = c.dataset.opt;
          if (opt === "voice") {
            const on = c.getAttribute("aria-pressed") !== "true";
            c.setAttribute("aria-pressed", String(on));
            on ? speak(`${l.kind}: ${t.title}. ${t.about}`) : stopSpeaking();
            return;
          }
          state.a11y[opt] = !state.a11y[opt];
          save.a11y();
          c.setAttribute("aria-pressed", String(state.a11y[opt]));
          toast(
            opt === "subs"
              ? state.a11y.subs
                ? "Legendas grandes ativadas"
                : "Legendas no tamanho padrão"
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
