/* ==========================================================
   Estudaê — lógica do app (SPA com rotas por hash)
   ========================================================== */
import { icon } from "./icons.js";
import { $app, $sheetRoot } from "./core/dom.js";
import { esc, go, initials } from "./core/utils.js";
import { store } from "./core/store.js";
import { state, save, applyA11y } from "./core/state.js";
import { toast } from "./core/toast.js";
import { speak, stopSpeaking } from "./core/speech.js";
import { streakDays } from "./core/stats.js";
import { nav } from "./components/nav.js";
import { historyList, subjectBars } from "./components/progress.js";
import loadingScreen from "./screens/loading.js";
import boasVindasScreen from "./screens/boas-vindas.js";
import loginScreen from "./screens/login.js";
import cadastroScreen from "./screens/cadastro.js";
import homeScreen from "./screens/home.js";
import areaScreen from "./screens/area.js";
import videosScreen from "./screens/videos.js";
import videoScreen from "./screens/video.js";
import quizScreen from "./screens/quiz.js";
import resultadoScreen from "./screens/resultado.js";
import progressoScreen from "./screens/progresso.js";

(() => {
  "use strict";

  /* ==========================================================
     Telas
     ========================================================== */
  const screens = {
    loading: loadingScreen,
    "boas-vindas": boasVindasScreen,
    login: loginScreen,
    cadastro: cadastroScreen,
    home: homeScreen,
    area: areaScreen,
    videos: videosScreen,
    video: videoScreen,
    quiz: quizScreen,
    resultado: resultadoScreen,
    progresso: progressoScreen,
  };

  /* Perfil */
  screens.perfil = () => {
    const u = state.user;
    const streak = streakDays();
    const correct = state.results.reduce((s, r) => s + r.correct, 0);
    const level = 1 + Math.floor(correct / 10);
    return {
      cls: "screen--nav",
      nav: "perfil",
      html: `
        <div class="topbar topbar--split">
          <a class="icon-btn icon-btn--solid" href="#/home" aria-label="Voltar ao início">${icon("arrowLeft")}</a>
          <h1>Meu perfil</h1>
          <span style="width:2.25rem"></span>
        </div>
        <div class="card profile-head">
          <span class="avatar" aria-hidden="true">${esc(initials(u.name))}</span>
          <div>
            <strong>${esc(u.name)}</strong>
            <span class="streak">${icon("flame")}${streak} ${streak === 1 ? "dia" : "dias"} de ofensiva, nível ${level}</span>
          </div>
        </div>
        <div class="card">${subjectBars()}</div>
        <h2 class="section-label">Histórico recente</h2>
        ${state.results.length ? historyList(4) : `<div class="empty"><p>Seus quizzes vão aparecer aqui.</p><a class="btn btn--light" href="#/quiz/pt">Fazer um quiz</a></div>`}
        <a class="btn btn--soft" style="margin-top:1.5rem" href="#/acessibilidade">${icon("access")}Opções de acessibilidade</a>
        <button class="btn btn--outline" style="margin-top:.75rem" id="logout">${icon("logout")}${u.guest ? "Sair do modo visitante" : "Sair da conta"}</button>`,
      after() {
        document.getElementById("logout").addEventListener("click", () => {
          state.user = null;
          store.remove("user");
          go("#/boas-vindas");
        });
      },
    };
  };

  /* Acessibilidade */
  screens.acessibilidade = () => {
    const a = state.a11y;
    const sizes = [
      ["padrao", "Padrão"],
      ["grande", "Grande"],
      ["extragrande", "Extragrande"],
    ];
    const row = (key, ic, title, desc) => `
      <div class="toggle-row">
        ${icon(ic)}
        <div><strong id="lbl-${key}">${title}</strong><small>${desc}</small></div>
        <button class="switch" role="switch" aria-checked="${a[key]}" aria-labelledby="lbl-${key}" data-key="${key}"></button>
      </div>`;
    return {
      cls: "screen--nav",
      nav: "perfil",
      html: `
        <div class="topbar topbar--split">
          <button class="icon-btn icon-btn--solid" id="back" aria-label="Voltar">${icon("arrowLeft")}</button>
          <h1>Acessibilidade</h1>
          <span style="width:2.25rem"></span>
        </div>
        <h2 class="section-label" style="margin-top:.5rem">Tamanho do texto</h2>
        <div class="size-picker" role="group" aria-label="Tamanho do texto">
          ${sizes.map(([v, l]) => `<button data-size="${v}" aria-pressed="${a.font === v}" aria-label="${l}">A</button>`).join("")}
        </div>
        <p class="small" style="margin-top:.5rem" id="size-desc">Atual: ${sizes.find((s) => s[0] === a.font)[1]}</p>
        <h2 class="section-label">Leitura e contraste</h2>
        <div class="card card--flush">
          ${row("contrast", "contrast", "Alto contraste", "Cores mais fortes e fundo mais claro.")}
          ${row("speak", "volume", "Ler questões em voz alta", "Ouça o enunciado e as alternativas automaticamente.")}
          ${row("motion", "zap", "Reduzir animações", "Telas trocam sem efeitos de movimento.")}
        </div>
        <button class="btn btn--primary" style="margin-top:1.5rem" id="confirm">Confirmar e voltar</button>`,
      after() {
        const back = () =>
          history.length > 1 ? history.back() : go("#/perfil");
        document.getElementById("back").addEventListener("click", back);
        document.getElementById("confirm").addEventListener("click", () => {
          toast("Preferências salvas");
          back();
        });
        document.querySelectorAll("[data-size]").forEach((b) =>
          b.addEventListener("click", () => {
            a.font = b.dataset.size;
            save.a11y();
            document
              .querySelectorAll("[data-size]")
              .forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
            document.getElementById("size-desc").textContent =
              "Atual: " + b.getAttribute("aria-label");
          }),
        );
        document.querySelectorAll(".switch").forEach((sw) =>
          sw.addEventListener("click", () => {
            const k = sw.dataset.key;
            a[k] = !a[k];
            save.a11y();
            sw.setAttribute("aria-checked", String(a[k]));
            if (k === "speak" && a[k]) speak("Leitura em voz alta ativada.");
          }),
        );
      },
    };
  };

  /* ==========================================================
     Roteador
     ========================================================== */
  const PUBLIC = new Set(["loading", "boas-vindas", "login", "cadastro"]);

  function render() {
    stopSpeaking();
    $sheetRoot.innerHTML = "";
    const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
    let name = parts[0] || "loading";
    if (!screens[name]) name = state.user ? "home" : "boas-vindas";
    if (!PUBLIC.has(name) && !state.user) {
      go("#/boas-vindas");
      return;
    }
    if (
      name !== "quiz" &&
      state.quiz &&
      !state.quiz.finished &&
      name !== "acessibilidade"
    )
      state.quiz = null;

    const out = screens[name](...parts.slice(1));
    $app.innerHTML = `<main class="screen ${out.cls || ""}" id="main">${out.html}</main>${out.nav ? nav(out.nav) : ""}`;
    window.scrollTo(0, 0);
    $app.scrollTop = 0;
    out.after && out.after({ rerender: render });

    const h1 = $app.querySelector("h1");
    if (h1 && name !== "loading") {
      h1.tabIndex = -1;
      h1.focus({ preventScroll: true });
    }
    document.title = (h1 ? h1.textContent.trim() + " — " : "") + "Estudaê";
  }

  applyA11y();
  window.addEventListener("hashchange", render);
  render();
})();
