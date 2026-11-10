/* ==========================================================
   Simulado: questões de todos os temas de uma matéria, com tempo,
   sem correção até o fim (como no dia da prova).
   ========================================================== */
import { SUBJECTS, carregarQuestoes, fonte, materiasDoNivel, figuraQuestao } from "../data.js";
import { api } from "../core/api.js";
import { icon } from "../icons.js";
import { $app } from "../core/dom.js";
import { state, save } from "../core/state.js";
import { LETTERS, esc, go, shuffle } from "../core/utils.js";
import { speak, stopSpeaking } from "../core/speech.js";
import { toast } from "../core/toast.js";
import { backBtn } from "../components/nav.js";
import { urls } from "../core/urls.js";

// Configuração única. Ajustar ao edital do Encceja quando houver questões oficiais.
export const SIMULADO = {
  maxQuestoes: 30, // no máximo; usa menos se o catálogo tiver menos
  minutosPorQuestao: 3,
  avisoMinutos: 5, // aviso quando faltar este tempo
};

const mmss = (ms) => {
  const s = Math.floor(Math.abs(ms) / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

export default function simulado(id) {
  return id && SUBJECTS[id] ? prova(id) : instrucoes();
}

/* ---------- Instruções e escolha da matéria ---------- */
function instrucoes() {
  const materias = materiasDoNivel(state.nivel).filter((s) => s.totalQuestoes > 0);
  return {
    cls: "screen--nav",
    nav: "inicio",
    html: `
        <div class="topbar">${backBtn(urls.home)}</div>
        <h1 class="title">Simulado</h1>
        <p class="lede">Teste o que aprendeu como no dia da prova.</p>
        <ul class="sim-rules">
          <li>${icon("checkSquare")}<span>Questões de todos os temas da matéria, em ordem aleatória.</span></li>
          <li>${icon("clock")}<span>${SIMULADO.minutosPorQuestao} minutos por questão. O relógio fica sempre à vista, e você pode terminar mesmo depois do tempo.</span></li>
          <li>${icon("eye")}<span>A correção aparece só no fim. Dá para voltar e mudar respostas antes de entregar.</span></li>
        </ul>
        <h2 class="section-label">Escolha a matéria</h2>
        ${
          materias.length
            ? `<div class="subject-list">${materias
                .map((s) => {
                  const n = Math.min(SIMULADO.maxQuestoes, s.totalQuestoes);
                  return `<a class="subject-row" href="${urls.simulado(s.id)}">
                  ${icon(s.icon)}
                  <span><strong>${esc(s.name)}</strong><small>${n} questões · ${n * SIMULADO.minutosPorQuestao} minutos</small></span>
                  ${icon("chevronRight", "chev")}
                </a>`;
                })
                .join("")}</div>`
            : `<div class="empty"><p>Ainda não há questões para montar um simulado.</p></div>`
        }`,
  };
}

/* ---------- A prova ---------- */
function prova(id) {
  if (!state.simulado || state.simulado.subject !== id || state.simulado.finished) {
    state.simulado = {
      subject: id,
      questions: null, // chegam da API em after()
      treino: false, // true = sem questões oficiais suficientes, usa as autorais
      i: 0,
      chosen: [],
      startedAt: null,
      limitMs: 0,
      warned: false,
      finished: false,
    };
  }
  return {
    cls: "screen--nav",
    nav: "inicio",
    html: `<div id="sim"></div>`,
    after() {
      if (state.simulado.questions) draw();
      else load(state.simulado);
    },
  };
}

async function load(q) {
  const box = document.getElementById("sim");
  const s = SUBJECTS[q.subject];
  box.innerHTML = `<h1 class="quiz-count">Montando o simulado…</h1>`;
  try {
    const porTema = await Promise.all(
      s.topics.map((t, ti) => (t.totalQuestoes ? carregarQuestoes(q.subject, ti) : [])),
    );
    if (state.simulado !== q || !box.isConnected) return;
    const todas = porTema.flat();
    // Prefere as questões do Encceja; sem quantidade suficiente, treina com as autorais.
    const oficiais = todas.filter((x) => x.prova?.ano);
    const base = oficiais.length >= Math.min(SIMULADO.maxQuestoes, todas.length) ? oficiais : todas;
    q.treino = base !== oficiais || !oficiais.length;
    q.questions = shuffle(base).slice(0, SIMULADO.maxQuestoes);
    if (!q.questions.length) {
      box.innerHTML = `<h1 class="quiz-count">Ainda não há questões nesta matéria.</h1>
        <a class="btn btn--outline" style="margin-top:1rem" href="${urls.simulado()}">Voltar</a>`;
      return;
    }
    q.startedAt = Date.now();
    q.limitMs = q.questions.length * SIMULADO.minutosPorQuestao * 60_000;
    draw();
  } catch {
    if (state.simulado !== q || !box.isConnected) return;
    box.innerHTML = `<h1 class="quiz-count">Não foi possível montar o simulado.</h1>
      <p class="lede">Confira sua conexão e tente de novo.</p>
      <button class="btn btn--primary" style="margin-top:1rem" id="retry">Tentar de novo</button>`;
    document.getElementById("retry").addEventListener("click", () => load(q));
  }
}

function draw({ panel = false } = {}) {
  const q = state.simulado;
  const s = SUBJECTS[q.subject];
  const item = q.questions[q.i];
  const total = q.questions.length;
  const answered = q.chosen.filter((x) => x !== undefined).length;
  const chosen = q.chosen[q.i];
  const box = document.getElementById("sim");

  box.innerHTML = `
      <div class="quiz-top">
        <button class="icon-btn" id="exit" aria-label="Sair do simulado">${icon("xBox")}</button>
        <div class="sim-timer" id="timer" role="timer" aria-label="Tempo restante"></div>
      </div>
      ${q.treino ? `<p class="sim-badge">Simulado de treino · questões autorais</p>` : ""}
      <div id="exit-confirm" class="tip" hidden>
        <p><strong>Sair do simulado?</strong></p>
        <p>As respostas desta tentativa serão perdidas.</p>
        <div class="quiz-nav">
          <button class="btn btn--outline" id="exit-no">Continuar o simulado</button>
          <a class="btn btn--primary" href="${urls.home}" id="exit-yes">Sair</a>
        </div>
      </div>
      <h1 class="quiz-count">Questão ${q.i + 1} de ${total} — ${esc(s.name)}</h1>
      <p class="small">${answered} de ${total} respondidas</p>
      <section class="statement" aria-labelledby="ask">
        <p class="tag">${esc(s.topics[item.topic].title.toUpperCase())}</p>
        ${item.text ? `<p class="passage">${esc(item.text)}</p>` : ""}
        ${figuraQuestao(item.imagem, esc)}
        <p class="ask" id="ask">${esc(item.ask)}</p>
        <p class="small source" style="margin-top:.5rem">${esc(fonte(item.prova))}</p>
        <button class="btn btn--light listen" id="listen">${icon("volume")}Ouvir questão</button>
      </section>
      <div class="alts" role="radiogroup" aria-labelledby="ask">
        ${item.options
          .map(
            (o, k) => `<button class="alt" role="radio" aria-checked="${chosen === k}" data-k="${k}">
          <span class="letter">${LETTERS[k]}</span><span>${esc(o)}</span></button>`,
          )
          .join("")}
      </div>
      <div class="quiz-nav">
        <button class="btn btn--outline btn--sm" id="prev" ${q.i === 0 ? "disabled" : ""}>${icon("undo")}Anterior</button>
        ${
          q.i === total - 1
            ? `<button class="btn btn--primary btn--sm" id="finish">Entregar simulado</button>`
            : `<button class="btn btn--primary btn--sm" id="next">Próxima${icon("chevronRight")}</button>`
        }
      </div>
      <details class="sim-panel" ${panel ? "open" : ""}>
        <summary>${icon("checkSquare")}Ver todas as questões</summary>
        <div class="sim-grid">
          ${q.questions
            .map(
              (_, k) =>
                `<button class="sim-cell ${q.chosen[k] !== undefined ? "is-answered" : ""} ${k === q.i ? "is-current" : ""}" data-go="${k}"
                  aria-label="Questão ${k + 1}${q.chosen[k] !== undefined ? ", respondida" : ", sem resposta"}" ${k === q.i ? 'aria-current="true"' : ""}>${k + 1}</button>`,
            )
            .join("")}
        </div>
        <p class="small">Roxo: respondida. Contorno: sem resposta.</p>
        <button class="btn btn--primary" id="finish-panel" style="margin-top:.75rem">Entregar simulado</button>
      </details>
      <div id="finish-confirm" class="tip" hidden>
        <p><strong id="finish-msg"></strong></p>
        <div class="quiz-nav">
          <button class="btn btn--outline" id="finish-no">Voltar às questões</button>
          <button class="btn btn--primary" id="finish-yes">Entregar mesmo assim</button>
        </div>
      </div>`;

  startTimer(box);

  const goTo = (k, opts) => {
    stopSpeaking();
    q.i = k;
    draw(opts);
    const h = box.querySelector("h1");
    h.tabIndex = -1;
    h.focus({ preventScroll: true });
    window.scrollTo(0, 0);
    $app.scrollTop = 0;
  };

  document.getElementById("listen").addEventListener("click", () =>
    speak(`Questão ${q.i + 1}. ${item.text ? item.text + ". " : ""}${item.imagem?.descricao ? "Imagem: " + item.imagem.descricao + ". " : ""}${item.ask} ${item.options.map((o, k) => `Alternativa ${LETTERS[k]}: ${o}.`).join(" ")}`),
  );

  const alts = [...box.querySelectorAll(".alt")];
  alts.forEach((b, idx) => {
    b.tabIndex = (chosen ?? 0) === idx ? 0 : -1;
    b.addEventListener("click", () => {
      q.chosen[q.i] = +b.dataset.k;
      alts.forEach((x) => x.setAttribute("aria-checked", String(x === b)));
      const done = q.chosen.filter((x) => x !== undefined).length;
      box.querySelector(".quiz-count + .small").textContent = `${done} de ${total} respondidas`;
      const cell = box.querySelector(`[data-go="${q.i}"]`);
      cell.classList.add("is-answered");
      cell.setAttribute("aria-label", `Questão ${q.i + 1}, respondida`);
    });
    b.addEventListener("keydown", (e) => {
      const dir = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
      if (!dir) return;
      e.preventDefault();
      const n = alts[(idx + dir + alts.length) % alts.length];
      alts.forEach((x) => (x.tabIndex = -1));
      n.tabIndex = 0;
      n.focus();
      n.click();
    });
  });

  document.getElementById("prev").addEventListener("click", () => goTo(q.i - 1));
  document.getElementById("next")?.addEventListener("click", () => goTo(q.i + 1));
  box.querySelectorAll("[data-go]").forEach((c) => c.addEventListener("click", () => goTo(+c.dataset.go, { panel: true })));

  // Sair: confirmação na própria tela (sem caixas de diálogo do navegador).
  const exitBox = document.getElementById("exit-confirm");
  document.getElementById("exit").addEventListener("click", () => {
    exitBox.hidden = false;
    document.getElementById("exit-no").focus();
  });
  document.getElementById("exit-no").addEventListener("click", () => (exitBox.hidden = true));
  document.getElementById("exit-yes").addEventListener("click", () => (state.simulado = null));

  // Entregar: avisa se ficou questão sem resposta.
  const confirmBox = document.getElementById("finish-confirm");
  const askFinish = () => {
    const missing = q.chosen.filter((x) => x !== undefined).length;
    if (missing === total) return finish(q);
    const faltam = total - missing;
    document.getElementById("finish-msg").textContent =
      `${faltam === 1 ? "Ficou 1 questão" : `Ficaram ${faltam} questões`} sem resposta. Questão sem resposta conta como erro.`;
    confirmBox.hidden = false;
    document.getElementById("finish-no").focus();
  };
  document.getElementById("finish")?.addEventListener("click", askFinish);
  document.getElementById("finish-panel").addEventListener("click", askFinish);
  document.getElementById("finish-no").addEventListener("click", () => {
    confirmBox.hidden = true;
    const first = q.chosen.findIndex((x) => x === undefined);
    goTo(first < 0 ? 0 : first, { panel: true });
  });
  document.getElementById("finish-yes").addEventListener("click", () => finish(q));
}

// Relógio: mostra o tempo que falta; depois do limite, quanto passou (sem encerrar).
function startTimer(box) {
  const q = state.simulado;
  const el = document.getElementById("timer");
  clearInterval(startTimer.id);
  const tick = () => {
    if (!box.isConnected || state.simulado !== q || q.finished) return clearInterval(startTimer.id);
    const left = q.limitMs - (Date.now() - q.startedAt);
    if (left > 0) {
      el.className = "sim-timer" + (left <= SIMULADO.avisoMinutos * 60_000 ? " is-warning" : "");
      el.innerHTML = `${icon("clock")}<span>${mmss(left)} restantes</span>`;
      if (!q.warned && left <= SIMULADO.avisoMinutos * 60_000) {
        q.warned = true;
        toast(`Faltam ${SIMULADO.avisoMinutos} minutos.`);
      }
    } else {
      el.className = "sim-timer is-over";
      el.innerHTML = `${icon("clock")}<span>Tempo esgotado · +${mmss(left)}</span>`;
      if (!q.overWarned) {
        q.overWarned = true;
        toast("O tempo da prova acabou. Você pode terminar com calma.");
      }
    }
  };
  tick();
  startTimer.id = setInterval(tick, 1000);
}

// Corrige tudo pela API (POST com o texto da alternativa) e abre o resultado.
async function finish(q) {
  const btns = document.querySelectorAll("#finish, #finish-panel, #finish-yes");
  btns.forEach((b) => (b.disabled = true));
  toast("Corrigindo o simulado…");
  let corr;
  try {
    // Questão sem resposta também é consultada (com qualquer alternativa) só para
    // trazer o gabarito e a resolução; ela conta como erro mesmo assim.
    corr = await Promise.all(
      q.questions.map((item, k) => api.resposta(item.id, item.options[q.chosen[k] ?? 0])),
    );
  } catch {
    toast("Não foi possível corrigir agora. Suas respostas foram mantidas. Tente de novo.");
    btns.forEach((b) => (b.disabled = false));
    return;
  }
  if (state.simulado !== q) return;
  q.finished = true;
  clearInterval(startTimer.id);
  const items = q.questions.map((item, k) => {
    const c = corr[k];
    const respondida = q.chosen[k] !== undefined;
    return {
      id: item.id,
      ask: item.ask,
      options: item.options,
      chosen: q.chosen[k],
      answer: item.options.indexOf(c.respostaCorreta),
      why: (respondida ? "" : "Você não respondeu esta questão. ") + c.resolucao,
      topic: item.topic,
      ok: respondida && c.acertou,
    };
  });
  const correct = items.filter((x) => x.ok).length;
  const erros = {};
  items.forEach((x) => !x.ok && (erros[x.topic] = (erros[x.topic] || 0) + 1));
  const pior = Object.keys(erros).sort((a, b) => erros[b] - erros[a])[0];
  state.results.push({
    v: 3,
    kind: "simulado",
    subject: q.subject,
    date: Date.now(),
    correct,
    total: items.length,
    items,
    treino: q.treino,
    usedMs: Date.now() - q.startedAt,
    limitMs: q.limitMs,
    weakTopic: pior === undefined ? null : +pior,
  });
  save.results();
  stopSpeaking();
  go(urls.resultado(state.results.length - 1));
}
