/* ==========================================================
   Estudaê — lógica do app (SPA com rotas por hash)
   ========================================================== */
import { SUBJECTS, lessonsFor } from "./data.js";
import { icon } from "./icons.js";
import { $app, $sheetRoot } from "./core/dom.js";
import {
  LETTERS,
  esc,
  go,
  pct,
  initials,
  formatDay,
  shuffle,
} from "./core/utils.js";
import { store } from "./core/store.js";
import { state, save, applyA11y } from "./core/state.js";
import { toast } from "./core/toast.js";
import { speak, stopSpeaking } from "./core/speech.js";
import { streakDays, watchedCount, totalLessons } from "./core/stats.js";
import { backBtn, nav } from "./components/nav.js";
import { historyList, subjectBars } from "./components/progress.js";
import loadingScreen from "./screens/loading.js";
import boasVindasScreen from "./screens/boas-vindas.js";
import loginScreen from "./screens/login.js";
import cadastroScreen from "./screens/cadastro.js";
import homeScreen from "./screens/home.js";
import areaScreen from "./screens/area.js";

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
  };

  /* Lista de vídeo-aulas */
  screens.videos = (id) => {
    const s = SUBJECTS[id];
    if (!s) return screens.home();
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
              return `<a class="lesson ${done ? "done" : ""}" href="#/video/${id}/${i}/${j}">
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
        <div class="topbar">${backBtn(`#/area/${id}`)}</div>
        <p class="kicker">${s.name} (Encceja)</p>
        <h1 class="title">Vídeo-aulas</h1>
        <p class="small" style="margin-top:.25rem">${watchedCount(id)} de ${totalLessons(id)} aulas concluídas</p>
        ${topics}`,
    };
  };

  /* Detalhe da vídeo-aula */
  screens.video = (id, ti, li) => {
    const s = SUBJECTS[id];
    const t = s?.topics[+ti];
    const l = t && lessonsFor(t)[+li];
    if (!l) return screens.home();
    const key = `${id}/${ti}/${li}`;
    const done = !!state.watched[key];
    const lessons = lessonsFor(t);
    const next =
      +li + 1 < lessons.length ? `#/video/${id}/${ti}/${+li + 1}` : null;
    return {
      cls: "screen--nav",
      nav: "inicio",
      html: `
        <div class="topbar topbar--split">
          <a class="icon-btn icon-btn--solid" href="#/videos/${id}" aria-label="Voltar para as vídeo-aulas">${icon("arrowLeft")}</a>
          <h1>Vídeo-aula</h1>
          <a class="icon-btn icon-btn--solid" href="#/acessibilidade" aria-label="Opções de acessibilidade">${icon("access")}</a>
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
      after() {
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
          render();
        });
      },
    };
  };

  /* Quiz */
  screens.quiz = (id) => {
    const s = SUBJECTS[id];
    if (!s) return screens.home();
    if (!state.quiz || state.quiz.subject !== id || state.quiz.finished) {
      state.quiz = {
        subject: id,
        order: shuffle(s.questions.map((_, i) => i)),
        i: 0,
        answers: [],
        finished: false,
      };
    }
    return {
      html: `<div id="quiz"></div>`,
      after() {
        drawQuestion();
      },
    };
  };

  function drawQuestion() {
    const q = state.quiz;
    const s = SUBJECTS[q.subject];
    const item = s.questions[q.order[q.i]];
    const total = q.order.length;
    const chosen = q.answers[q.i];
    const last = q.i === total - 1;
    const box = document.getElementById("quiz");
    box.innerHTML = `
      <div class="quiz-top">
        <a class="icon-btn" href="#/area/${q.subject}" aria-label="Sair do quiz">${icon("xBox")}</a>
        <div class="progress" role="progressbar" aria-valuemin="1" aria-valuemax="${total}" aria-valuenow="${q.i + 1}" aria-label="Progresso do quiz"><i style="width:${((q.i + 1) / total) * 100}%"></i></div>
      </div>
      <h1 class="quiz-count">Questão ${q.i + 1} de ${total} — ${s.name}</h1>
      <section class="statement" aria-labelledby="ask">
        <p class="tag">${esc(s.topics[item.topic].title.toUpperCase())}</p>
        ${item.text ? `<p class="passage">${esc(item.text)}</p>` : ""}
        <p class="ask" id="ask">${esc(item.ask)}</p>
        <button class="btn btn--light listen" id="listen">${icon("volume")}Ouvir questão</button>
      </section>
      <div class="alts" role="radiogroup" aria-labelledby="ask">
        ${item.options
          .map(
            (
              o,
              k,
            ) => `<button class="alt" role="radio" aria-checked="${chosen === k}" data-k="${k}">
          <span class="letter">${LETTERS[k]}</span><span>${esc(o)}</span></button>`,
          )
          .join("")}
      </div>
      <div class="quiz-nav">
        <button class="btn btn--outline btn--sm" id="prev" ${q.i === 0 ? "disabled" : ""}>${icon("undo")}Voltar</button>
        <button class="btn btn--primary btn--sm" id="next" ${chosen === undefined ? "disabled" : ""}>${last ? "Ver resultado" : "Próxima"}${icon("chevronRight")}</button>
      </div>`;

    const readAloud = () =>
      speak(
        `Questão ${q.i + 1}. ${item.text ? item.text + ". " : ""}${item.ask} ${item.options.map((o, k) => `Alternativa ${LETTERS[k]}: ${o}.`).join(" ")}`,
      );
    document.getElementById("listen").addEventListener("click", readAloud);
    if (state.a11y.speak) readAloud();

    const alts = [...box.querySelectorAll(".alt")];
    alts.forEach((b, idx) => {
      b.tabIndex = (chosen ?? 0) === idx ? 0 : -1;
      b.addEventListener("click", () => {
        q.answers[q.i] = +b.dataset.k;
        alts.forEach((x) => x.setAttribute("aria-checked", String(x === b)));
        document.getElementById("next").disabled = false;
      });
      b.addEventListener("keydown", (e) => {
        const dir = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[
          e.key
        ];
        if (!dir) return;
        e.preventDefault();
        const n = alts[(idx + dir + alts.length) % alts.length];
        alts.forEach((x) => (x.tabIndex = -1));
        n.tabIndex = 0;
        n.focus();
        n.click();
      });
    });

    document.getElementById("prev").addEventListener("click", () => {
      q.i--;
      stopSpeaking();
      drawQuestion();
    });
    document.getElementById("next").addEventListener("click", () => {
      stopSpeaking();
      if (!last) {
        q.i++;
        drawQuestion();
        const h = box.querySelector("h1");
        h.tabIndex = -1;
        h.focus({ preventScroll: true });
        window.scrollTo(0, 0);
        $app.scrollTop = 0;
        return;
      }
      finishQuiz();
    });
  }

  function finishQuiz() {
    const q = state.quiz;
    const s = SUBJECTS[q.subject];
    const items = q.order.map((qi, k) => {
      const item = s.questions[qi];
      return { q: qi, chosen: q.answers[k], ok: q.answers[k] === item.answer };
    });
    const correct = items.filter((x) => x.ok).length;
    const misses = {};
    items.forEach((x) => {
      if (!x.ok) {
        const t = s.questions[x.q].topic;
        misses[t] = (misses[t] || 0) + 1;
      }
    });
    const weakTopic = Object.keys(misses).sort(
      (a, b) => misses[b] - misses[a],
    )[0];
    state.results.push({
      subject: q.subject,
      date: Date.now(),
      correct,
      total: items.length,
      items,
      weakTopic: weakTopic === undefined ? null : +weakTopic,
    });
    save.results();
    q.finished = true;
    go(`#/resultado/${state.results.length - 1}`);
  }

  /* Resultado do quiz */
  screens.resultado = (idx) => {
    const r = state.results[+idx];
    if (!r) return screens.progresso();
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
  };

  /* Progresso */
  screens.progresso = () => {
    const has = state.results.length > 0;
    return {
      cls: "screen--nav",
      nav: "progresso",
      html: `
        <h1 class="title">Seu progresso</h1>
        <p class="lede">Acompanhe como você está em cada área.</p>
        <div class="card">${subjectBars()}</div>
        <h2 class="section-label">Quizzes feitos</h2>
        ${
          has
            ? historyList(20)
            : `<div class="empty">
          <h2>Nenhum quiz feito ainda</h2>
          <p>Faça seu primeiro quiz para ver acertos, erros e o que revisar.</p>
          <a class="btn btn--primary btn--sm" href="#/quiz/pt">Começar quiz de Português</a>
          <a class="btn btn--outline btn--sm" href="#/quiz/mat">Começar quiz de Matemática</a>
        </div>`
        }`,
    };
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
    out.after && out.after();

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
