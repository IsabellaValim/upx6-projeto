/* ==========================================================
   Estudaê — lógica do app (SPA com rotas por hash)
   ========================================================== */
(() => {
  "use strict";

  const $app = document.getElementById("app");
  const $sheetRoot = document.getElementById("sheet-root");
  const $toast = document.getElementById("toast");
  const LETTERS = ["A", "B", "C", "D"];

  /* ---------- Armazenamento local ---------- */
  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem("estudae:" + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem("estudae:" + key, JSON.stringify(value)); } catch { /* sem armazenamento */ }
    },
    remove(key) { try { localStorage.removeItem("estudae:" + key); } catch {} },
  };

  const state = {
    user: store.get("user", null),
    a11y: Object.assign({ font: "padrao", contrast: false, speak: false, motion: false, subs: false, slow: false }, store.get("a11y", {})),
    results: store.get("results", []),
    watched: store.get("watched", {}),
    quiz: null,
  };

  const save = {
    user() { store.set("user", state.user); },
    a11y() { store.set("a11y", state.a11y); applyA11y(); },
    results() { store.set("results", state.results); },
    watched() { store.set("watched", state.watched); },
  };

  function applyA11y() {
    const el = document.documentElement;
    el.dataset.font = state.a11y.font;
    el.dataset.contrast = state.a11y.contrast ? "alto" : "";
    el.dataset.motion = state.a11y.motion ? "reduce" : "";
    el.dataset.subs = state.a11y.subs ? "grande" : "";
  }

  /* ---------- Utilidades ---------- */
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const go = (hash) => { location.hash = hash; };
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

  function toast(msg) {
    $toast.textContent = msg;
    $toast.classList.add("show");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => $toast.classList.remove("show"), 2600);
  }

  function speak(text) {
    if (!("speechSynthesis" in window)) { toast("Seu navegador não tem leitura em voz alta."); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "pt-BR";
    u.rate = 0.9;
    speechSynthesis.speak(u);
  }
  const stopSpeaking = () => { if ("speechSynthesis" in window) speechSynthesis.cancel(); };

  function initials(name) {
    return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "E";
  }

  function formatDay(ts) {
    const d = new Date(ts);
    const today = new Date();
    const diff = Math.round((new Date(today.toDateString()) - new Date(d.toDateString())) / 86400000);
    if (diff === 0) return "Hoje";
    if (diff === 1) return "Ontem";
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  }

  function streakDays() {
    const days = new Set(state.results.map((r) => new Date(r.date).toDateString()));
    let count = 0;
    const d = new Date();
    if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1);
    while (days.has(d.toDateString())) { count++; d.setDate(d.getDate() - 1); }
    return count;
  }

  function subjectScore(id) {
    const list = state.results.filter((r) => r.subject === id);
    if (!list.length) return null;
    const correct = list.reduce((s, r) => s + r.correct, 0);
    const total = list.reduce((s, r) => s + r.total, 0);
    return pct(correct, total);
  }

  function watchedCount(id) {
    return Object.keys(state.watched).filter((k) => k.startsWith(id + "/")).length;
  }
  function totalLessons(id) {
    return SUBJECTS[id].topics.reduce((s, t) => s + t.videos, 0);
  }

  /* ---------- Pedaços de interface ---------- */
  const backBtn = (href, label = "Voltar") => `<a class="icon-btn" href="${href}" aria-label="${label}">${icon("back")}</a>`;

  function nav(active) {
    const items = [
      ["inicio", "#/home", "home", "Início"],
      ["progresso", "#/progresso", "trend", "Progresso"],
      ["perfil", "#/perfil", "user", "Perfil"],
    ];
    return `<nav class="bottom-nav" aria-label="Navegação principal">${items
      .map(([id, href, ic, label]) => `<a href="${href}" ${id === active ? 'aria-current="page"' : ""}>${icon(ic)}<span>${label}</span></a>`)
      .join("")}</nav>`;
  }

  function openSheet(title, options) {
    $sheetRoot.innerHTML = `
      <div class="sheet-backdrop" data-close>
        <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
          <h2 id="sheet-title">${esc(title)}</h2>
          <div class="action-list">
            ${options.map((o) => `<a class="action-row" href="${o.href}">${icon(o.icon)}${esc(o.label)}${icon("chevronRight", "chev")}</a>`).join("")}
          </div>
          <button class="btn btn--outline" style="margin-top:1rem" data-close>Cancelar</button>
        </div>
      </div>`;
    const close = () => { $sheetRoot.innerHTML = ""; document.removeEventListener("keydown", onKey); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    $sheetRoot.querySelectorAll("[data-close]").forEach((el) =>
      el.addEventListener("click", (e) => { if (e.target === el) close(); })
    );
    $sheetRoot.querySelectorAll("a").forEach((a) => a.addEventListener("click", close));
    $sheetRoot.querySelector(".action-row")?.focus();
  }

  const chooseSubject = (kind) =>
    openSheet(kind === "quiz" ? "Qual quiz você quer fazer?" : "Quais vídeo-aulas você quer ver?", [
      { label: "Português", icon: "pen", href: kind === "quiz" ? "#/quiz/pt" : "#/videos/pt" },
      { label: "Matemática", icon: "percent", href: kind === "quiz" ? "#/quiz/mat" : "#/videos/mat" },
    ]);

  /* ==========================================================
     Telas
     ========================================================== */
  const screens = {};

  /* Carregando */
  screens.loading = () => ({
    cls: "screen--center",
    html: `
      <div class="logo-mark">${icon("book")}</div>
      <h1 class="display">Carregando…</h1>
      <div class="spinner" role="progressbar" aria-label="Carregando o Estudaê"></div>
      <p class="kicker">Aguarde!</p>`,
    after() {
      setTimeout(() => { if (location.hash === "" || location.hash === "#/loading") go(state.user ? "#/home" : "#/boas-vindas"); }, 1600);
    },
  });

  /* Boas-vindas (Main-activity) */
  screens["boas-vindas"] = () => ({
    html: `
      <div class="welcome-hero">
        <div class="logo-mark">${icon("book")}</div>
        <h1 class="display">Estudaê</h1>
        <p>Estude para o Encceja com questões e vídeo-aulas, no seu ritmo. Telas simples e textos grandes, pensadas para você.</p>
      </div>
      <div class="stack">
        <a class="btn btn--soft" href="#/cadastro">Criar conta</a>
        <a class="btn btn--outline" href="#/login">Já tenho conta</a>
        <button class="link" id="guest" style="align-self:center;display:block;margin:1rem auto 0">Continuar sem conta</button>
      </div>`,
    after() {
      document.getElementById("guest").addEventListener("click", () => {
        state.user = { name: "Visitante", guest: true };
        save.user();
        go("#/home");
      });
    },
  });

  /* Login */
  screens.login = () => ({
    cls: "screen--lilac",
    html: `
      <div class="topbar">${backBtn("#/boas-vindas")}</div>
      <div style="margin-top:2rem">
        <h1 class="display">Entrar</h1>
        <p class="lede">Acesse sua conta para continuar estudando.</p>
      </div>
      <form id="login-form" novalidate style="margin-top:1rem">
        <label class="field"><span>E-mail ou CPF</span>
          <div class="input-wrap">${icon("mail")}<input class="input" id="login-id" autocomplete="username" placeholder="Digite seu e-mail ou CPF" required></div>
        </label>
        <label class="field"><span>Senha</span>
          <div class="input-wrap">${icon("lock")}
            <input class="input" id="login-pass" type="password" autocomplete="current-password" placeholder="Digite sua senha" required>
            <button type="button" class="icon-btn" id="toggle-pass" aria-label="Mostrar senha">${icon("eye")}</button>
          </div>
        </label>
        <p class="error" id="login-error" hidden></p>
        <div class="row-end"><button type="button" class="link" id="forgot">Esqueci minha senha</button></div>
        <button class="btn btn--primary" style="margin-top:1.5rem">Entrar</button>
      </form>
      <div class="divider">ou</div>
      <p class="small center">Ainda não tem conta? <a class="link" href="#/cadastro">Criar conta</a></p>`,
    after() {
      const pass = document.getElementById("login-pass");
      const toggle = document.getElementById("toggle-pass");
      toggle.addEventListener("click", () => {
        const show = pass.type === "password";
        pass.type = show ? "text" : "password";
        toggle.innerHTML = icon(show ? "eyeOff" : "eye");
        toggle.setAttribute("aria-label", show ? "Esconder senha" : "Mostrar senha");
      });
      document.getElementById("forgot").addEventListener("click", () => toast("Enviamos um link de recuperação para o seu e-mail."));
      document.getElementById("login-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const id = document.getElementById("login-id");
        const err = document.getElementById("login-error");
        id.removeAttribute("aria-invalid"); pass.removeAttribute("aria-invalid");
        if (!id.value.trim() || pass.value.length < 4) {
          err.hidden = false;
          err.textContent = !id.value.trim() ? "Digite seu e-mail ou CPF para entrar." : "A senha precisa ter pelo menos 4 caracteres.";
          (!id.value.trim() ? id : pass).setAttribute("aria-invalid", "true");
          (!id.value.trim() ? id : pass).focus();
          return;
        }
        const raw = id.value.trim();
        const name = raw.includes("@") ? raw.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Estudante";
        state.user = { name: (state.user && !state.user.guest && state.user.name) || name, login: raw };
        save.user();
        go("#/home");
      });
    },
  });

  /* Criar conta / entrar com código */
  screens.cadastro = () => ({
    html: `
      <div class="topbar">${backBtn("#/boas-vindas")}</div>
      <h1 class="title">Entrar ou criar conta</h1>
      <p class="lede">Escolha como prefere continuar. Vamos enviar um código de verificação.</p>
      <div style="text-align:center"><div class="segmented" role="group" aria-label="Receber código por">
        <button type="button" data-mode="tel" aria-pressed="true">Telefone</button>
        <button type="button" data-mode="mail" aria-pressed="false">E-mail</button>
      </div></div>
      <form id="signup" novalidate>
        <label class="field"><span id="contact-label">Número de telefone</span>
          <input class="input" id="contact" inputmode="tel" autocomplete="tel" placeholder="(00) 00000-0000">
        </label>
        <button type="button" class="btn btn--soft btn--sm" id="send-code" style="margin-top:.75rem">Enviar código de verificação</button>
        <label class="field"><span>Código recebido por SMS ou e-mail</span>
          <input class="input" id="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000">
        </label>
        <label class="field"><span>Como você quer ser chamado(a)?</span>
          <input class="input" id="name" autocomplete="given-name" placeholder="Seu nome">
        </label>
        <label class="checkbox">
          <input type="checkbox" id="has-guardian">
          <span><strong>Cadastrar uma pessoa responsável (opcional)</strong>
          <span class="small">A pessoa responsável receberá um código e informações sobre o acesso.</span></span>
        </label>
        <label class="field" id="guardian-field" hidden><span>E-mail ou telefone da pessoa responsável</span>
          <input class="input" id="guardian" placeholder="E-mail ou telefone">
        </label>
        <p class="error" id="signup-error" hidden></p>
        <button class="btn btn--primary" style="margin-top:1.5rem">Continuar</button>
      </form>`,
    after() {
      let mode = "tel";
      const contact = document.getElementById("contact");
      const label = document.getElementById("contact-label");
      document.querySelectorAll("[data-mode]").forEach((b) =>
        b.addEventListener("click", () => {
          mode = b.dataset.mode;
          document.querySelectorAll("[data-mode]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
          label.textContent = mode === "tel" ? "Número de telefone" : "E-mail";
          contact.inputMode = mode === "tel" ? "tel" : "email";
          contact.type = mode === "tel" ? "text" : "email";
          contact.placeholder = mode === "tel" ? "(00) 00000-0000" : "seuemail@exemplo.com";
          contact.value = "";
          contact.focus();
        })
      );
      contact.addEventListener("input", () => {
        if (mode !== "tel") return;
        const d = contact.value.replace(/\D/g, "").slice(0, 11);
        contact.value = d.length > 6 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length > 2 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : d;
      });
      document.getElementById("send-code").addEventListener("click", () => {
        if (!contact.value.trim()) { contact.setAttribute("aria-invalid", "true"); contact.focus(); toast(mode === "tel" ? "Digite seu telefone primeiro." : "Digite seu e-mail primeiro."); return; }
        contact.removeAttribute("aria-invalid");
        toast("Código enviado! Para testar, use 123456.");
        document.getElementById("code").focus();
      });
      const guardianField = document.getElementById("guardian-field");
      document.getElementById("has-guardian").addEventListener("change", (e) => {
        guardianField.hidden = !e.target.checked;
        if (e.target.checked) document.getElementById("guardian").focus();
      });
      document.getElementById("signup").addEventListener("submit", (e) => {
        e.preventDefault();
        const err = document.getElementById("signup-error");
        const code = document.getElementById("code").value.trim();
        const name = document.getElementById("name").value.trim();
        const fail = (msg, el) => { err.hidden = false; err.textContent = msg; el.setAttribute("aria-invalid", "true"); el.focus(); };
        if (!contact.value.trim()) return fail("Informe seu telefone ou e-mail.", contact);
        if (!/^\d{6}$/.test(code)) return fail("O código tem 6 números. Confira a mensagem que você recebeu.", document.getElementById("code"));
        if (!name) return fail("Diga como quer ser chamado(a).", document.getElementById("name"));
        state.user = { name, login: contact.value.trim(), guardian: document.getElementById("guardian").value.trim() || null };
        save.user();
        toast(`Conta criada. Bons estudos, ${name.split(" ")[0]}!`);
        go("#/home");
      });
    },
  });

  /* Início */
  screens.home = () => {
    const first = state.user.name.split(" ")[0];
    const last = state.results[state.results.length - 1];
    const tile = (id) => {
      const s = SUBJECTS[id];
      const score = subjectScore(id);
      return `<a class="subject-tile" href="#/area/${id}">
        ${icon(s.icon)}
        <strong>${s.name}</strong>
        <span>${esc(s.area)}</span>
        <div class="mini-bar" aria-hidden="true"><i style="width:${score ?? 0}%"></i></div>
        <span class="sr-only">${score === null ? "Ainda sem quiz feito" : `Aproveitamento de ${score}%`}</span>
      </a>`;
    };
    return {
      cls: "screen--nav",
      nav: "inicio",
      html: `
        <p class="kicker">${state.user.guest ? "Bem-vindo ao Estudaê!" : `Bem-vindo de volta, ${esc(first)}!`}</p>
        <h1 class="title" style="margin-top:.25rem">Pronto para estudar para o Encceja?</h1>
        <div class="subject-grid">${tile("pt")}${tile("mat")}</div>
        <h2 class="section-label">Escolha a área do Encceja</h2>
        <div class="action-list">
          <button class="action-row" data-choose="quiz">${icon("checkSquare")}Questões e quiz${icon("chevronRight", "chev")}</button>
          <button class="action-row" data-choose="videos">${icon("video")}Vídeo-aulas${icon("chevronRight", "chev")}</button>
          <a class="action-row" href="#/progresso">${icon("clock")}Progresso${icon("chevronRight", "chev")}</a>
        </div>
        ${last ? `<div class="continue-card">
          <strong>Último quiz: ${SUBJECTS[last.subject].name}</strong>
          <p>Você acertou ${last.correct} de ${last.total}. Que tal tentar de novo e melhorar?</p>
          <a class="btn btn--light" href="#/quiz/${last.subject}">Refazer quiz</a>
        </div>` : ""}`,
      after() {
        document.querySelectorAll("[data-choose]").forEach((b) => b.addEventListener("click", () => chooseSubject(b.dataset.choose)));
      },
    };
  };

  /* Área (aba-portugues / aba-matematica) */
  screens.area = (id) => {
    const s = SUBJECTS[id];
    if (!s) return screens.home();
    return {
      cls: "screen--nav",
      nav: "inicio",
      html: `
        <div class="topbar">${backBtn("#/home")}</div>
        <h1 class="title">Área ${s.name}</h1>
        <p class="lede">Escolha como deseja estudar!</p>
        <section class="mode-card" aria-labelledby="m1">
          <h2 id="m1">${icon("checkSquare")}Questões e Quiz</h2>
          <p>Exercícios no estilo do Encceja, em ordem aleatória, com conjuntos diferentes a cada tentativa.</p>
          <a class="btn btn--light" href="#/quiz/${id}">Começar quiz</a>
        </section>
        <section class="mode-card" aria-labelledby="m2">
          <h2 id="m2">${icon("video")}Vídeo Aulas</h2>
          <p>Conteúdos organizados por tema, explicados com calma, com material complementar em cada um.</p>
          <a class="btn btn--light" href="#/videos/${id}">Ver vídeo-aulas</a>
        </section>`,
    };
  };

  /* Lista de vídeo-aulas */
  screens.videos = (id) => {
    const s = SUBJECTS[id];
    if (!s) return screens.home();
    const topics = s.topics.map((t, i) => {
      const lessons = lessonsFor(t);
      return `<details class="topic" ${i === 0 ? "open" : ""}>
        <summary>
          <span class="topic-num" aria-hidden="true">${i + 1}</span>
          <span class="topic-pill">Tema ${i + 1} — ${esc(t.title)}<small>${t.videos} vídeos</small></span>
          ${icon("chevronDown", "chev")}
        </summary>
        <div class="lessons">
          ${lessons.map((l, j) => {
            const done = state.watched[`${id}/${i}/${j}`];
            return `<a class="lesson ${done ? "done" : ""}" href="#/video/${id}/${i}/${j}">
              ${icon(done ? "check" : "playCircle")}<span>${l.kind}${done ? '<span class="sr-only"> (concluído)</span>' : ""}</span>
              <span class="dur">${l.min} min</span></a>`;
          }).join("")}
        </div>
      </details>`;
    }).join("");
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
    const next = +li + 1 < lessons.length ? `#/video/${id}/${ti}/${+li + 1}` : null;
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
        let playing = false, progress = 0, timer = null;
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
          play.setAttribute("aria-label", on ? "Pausar vídeo" : "Reproduzir vídeo");
          cap.hidden = !on;
          clearInterval(timer);
          if (on) timer = setInterval(tick, 300);
        };
        play.addEventListener("click", () => toggle(!playing));
        window.addEventListener("hashchange", () => clearInterval(timer), { once: true });

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
            toast(opt === "subs" ? (state.a11y.subs ? "Legendas grandes ativadas" : "Legendas no tamanho padrão") : (state.a11y.slow ? "Velocidade calma ativada" : "Velocidade normal"));
          })
        );
        document.getElementById("done").addEventListener("click", () => {
          if (state.watched[key]) delete state.watched[key];
          else state.watched[key] = Date.now();
          save.watched();
          toast(state.watched[key] ? "Aula marcada como concluída" : "Aula desmarcada");
          render();
        });
      },
    };
  };

  /* Quiz */
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  screens.quiz = (id) => {
    const s = SUBJECTS[id];
    if (!s) return screens.home();
    if (!state.quiz || state.quiz.subject !== id || state.quiz.finished) {
      state.quiz = { subject: id, order: shuffle(s.questions.map((_, i) => i)), i: 0, answers: [], finished: false };
    }
    return {
      html: `<div id="quiz"></div>`,
      after() { drawQuestion(); },
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
        ${item.options.map((o, k) => `<button class="alt" role="radio" aria-checked="${chosen === k}" data-k="${k}">
          <span class="letter">${LETTERS[k]}</span><span>${esc(o)}</span></button>`).join("")}
      </div>
      <div class="quiz-nav">
        <button class="btn btn--outline btn--sm" id="prev" ${q.i === 0 ? "disabled" : ""}>${icon("undo")}Voltar</button>
        <button class="btn btn--primary btn--sm" id="next" ${chosen === undefined ? "disabled" : ""}>${last ? "Ver resultado" : "Próxima"}${icon("chevronRight")}</button>
      </div>`;

    const readAloud = () => speak(`Questão ${q.i + 1}. ${item.text ? item.text + ". " : ""}${item.ask} ${item.options.map((o, k) => `Alternativa ${LETTERS[k]}: ${o}.`).join(" ")}`);
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
        const dir = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
        if (!dir) return;
        e.preventDefault();
        const n = alts[(idx + dir + alts.length) % alts.length];
        alts.forEach((x) => (x.tabIndex = -1));
        n.tabIndex = 0; n.focus(); n.click();
      });
    });

    document.getElementById("prev").addEventListener("click", () => { q.i--; stopSpeaking(); drawQuestion(); });
    document.getElementById("next").addEventListener("click", () => {
      stopSpeaking();
      if (!last) { q.i++; drawQuestion(); const h = box.querySelector("h1"); h.tabIndex = -1; h.focus({ preventScroll: true }); window.scrollTo(0, 0); $app.scrollTop = 0; return; }
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
    items.forEach((x) => { if (!x.ok) { const t = s.questions[x.q].topic; misses[t] = (misses[t] || 0) + 1; } });
    const weakTopic = Object.keys(misses).sort((a, b) => misses[b] - misses[a])[0];
    state.results.push({ subject: q.subject, date: Date.now(), correct, total: items.length, items, weakTopic: weakTopic === undefined ? null : +weakTopic });
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
          ${weak
            ? `<p>Você teve mais dificuldade no tema “${esc(weak.title)}”.</p>
               <p>Você pode revisar este conteúdo antes de tentar novamente.</p>
               <a class="btn btn--primary btn--sm" href="#/video/${r.subject}/${r.weakTopic}/0">${icon("video")}Assistir vídeo-aula recomendada</a>`
            : `<p>Você acertou todas as questões. Excelente trabalho!</p>
               <p>Continue praticando para manter o ritmo até a prova.</p>
               <a class="btn btn--primary btn--sm" href="#/videos/${r.subject}">${icon("video")}Explorar vídeo-aulas</a>`}
        </div>
        <details class="review">
          <summary>Ver correção das questões</summary>
          ${r.items.map((x, k) => {
            const item = s.questions[x.q];
            return `<div class="review-item ${x.ok ? "ok" : "bad"}">
              <p><span class="mark">${x.ok ? "Acertou" : "Errou"}</span> — ${k + 1}. ${esc(item.ask)}</p>
              <p>Resposta certa: ${LETTERS[item.answer]}) ${esc(item.options[item.answer])}${!x.ok && x.chosen !== undefined ? ` · Você marcou ${LETTERS[x.chosen]}` : ""}</p>
              <p>${esc(item.why)}</p>
            </div>`;
          }).join("")}
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
  function historyList(limit) {
    const list = state.results.map((r, i) => ({ ...r, i })).reverse().slice(0, limit);
    return `<div class="history">${list.map((r) => {
      const s = SUBJECTS[r.subject];
      const p = pct(r.correct, r.total);
      const good = p >= 60;
      const label = r.weakTopic !== null ? s.topics[r.weakTopic].title : "Todos os temas";
      return `<a class="history-item ${good ? "ok" : "bad"}" href="#/resultado/${r.i}">
        <span class="badge">${icon(good ? "check" : "x")}</span>
        <span><strong>${s.name} — ${esc(label)}</strong><small>${formatDay(r.date)}</small></span>
        <span class="pct">${p}%</span></a>`;
    }).join("")}</div>`;
  }

  function subjectBars() {
    return ["pt", "mat"].map((id) => {
      const sc = subjectScore(id);
      return `<div class="bar-row">
        <header><span>${SUBJECTS[id].name}</span><span>${sc === null ? "—" : sc + "%"}</span></header>
        <div class="bar" role="progressbar" aria-label="Aproveitamento em ${SUBJECTS[id].name}" aria-valuenow="${sc ?? 0}" aria-valuemin="0" aria-valuemax="100"><i style="width:${sc ?? 0}%"></i></div>
        <p class="small" style="margin-top:.375rem">${watchedCount(id)} de ${totalLessons(id)} vídeo-aulas concluídas</p>
      </div>`;
    }).join("");
  }

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
        ${has ? historyList(20) : `<div class="empty">
          <h2>Nenhum quiz feito ainda</h2>
          <p>Faça seu primeiro quiz para ver acertos, erros e o que revisar.</p>
          <a class="btn btn--primary btn--sm" href="#/quiz/pt">Começar quiz de Português</a>
          <a class="btn btn--outline btn--sm" href="#/quiz/mat">Começar quiz de Matemática</a>
        </div>`}`,
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
          state.user = null; store.remove("user");
          go("#/boas-vindas");
        });
      },
    };
  };

  /* Acessibilidade */
  screens.acessibilidade = () => {
    const a = state.a11y;
    const sizes = [["padrao", "Padrão"], ["grande", "Grande"], ["extragrande", "Extragrande"]];
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
        const back = () => (history.length > 1 ? history.back() : go("#/perfil"));
        document.getElementById("back").addEventListener("click", back);
        document.getElementById("confirm").addEventListener("click", () => { toast("Preferências salvas"); back(); });
        document.querySelectorAll("[data-size]").forEach((b) =>
          b.addEventListener("click", () => {
            a.font = b.dataset.size; save.a11y();
            document.querySelectorAll("[data-size]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
            document.getElementById("size-desc").textContent = "Atual: " + b.getAttribute("aria-label");
          })
        );
        document.querySelectorAll(".switch").forEach((sw) =>
          sw.addEventListener("click", () => {
            const k = sw.dataset.key;
            a[k] = !a[k]; save.a11y();
            sw.setAttribute("aria-checked", String(a[k]));
            if (k === "speak" && a[k]) speak("Leitura em voz alta ativada.");
          })
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
    if (!PUBLIC.has(name) && !state.user) { go("#/boas-vindas"); return; }
    if (name !== "quiz" && state.quiz && !state.quiz.finished && name !== "acessibilidade") state.quiz = null;

    const out = screens[name](...parts.slice(1));
    $app.innerHTML = `<main class="screen ${out.cls || ""}" id="main">${out.html}</main>${out.nav ? nav(out.nav) : ""}`;
    window.scrollTo(0, 0);
    $app.scrollTop = 0;
    out.after && out.after();

    const h1 = $app.querySelector("h1");
    if (h1 && name !== "loading") { h1.tabIndex = -1; h1.focus({ preventScroll: true }); }
    document.title = (h1 ? h1.textContent.trim() + " — " : "") + "Estudaê";
  }

  applyA11y();
  window.addEventListener("hashchange", render);
  render();
})();
