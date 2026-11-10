/* Lição: até 5 questões de UM tema, com a correção logo após cada resposta */
import { SUBJECTS, carregarQuestoes, fonte, figuraQuestao } from "../data.js";
import { api } from "../core/api.js";
import { icon } from "../icons.js";
import { $app } from "../core/dom.js";
import { state, save } from "../core/state.js";
import { LETTERS, esc, go, shuffle } from "../core/utils.js";
import { speak, stopSpeaking } from "../core/speech.js";
import home from "./home.js";
import { urls } from "../core/urls.js";

export const TAMANHO_LICAO = 5;

export default function quiz(id, ti) {
  const s = SUBJECTS[id];
  const t = s?.topics[+ti];
  if (!t) return home();
  const topic = +ti;
  if (!state.quiz || state.quiz.subject !== id || state.quiz.topic !== topic || state.quiz.finished) {
    state.quiz = {
      subject: id,
      topic,
      questions: null, // chegam da API em after()
      i: 0,
      chosen: [], // posição marcada em cada questão
      results: [], // correção da API de cada questão já conferida
      finished: false,
    };
  }
  return {
    html: `<div id="quiz"></div>`,
    after() {
      if (state.quiz.questions) drawQuestion();
      else loadQuestions(state.quiz);
    },
  };
}

const focusTitle = (box) => {
  const h = box.querySelector("h1");
  h.tabIndex = -1;
  h.focus({ preventScroll: true });
  window.scrollTo(0, 0);
  $app.scrollTop = 0;
};

// Busca as questões do tema e sorteia até TAMANHO_LICAO.
async function loadQuestions(q) {
  const box = document.getElementById("quiz");
  const back = `<a class="btn btn--outline" style="margin-top:1rem" href="${urls.area(q.subject)}">Voltar para os temas</a>`;
  box.innerHTML = `<h1 class="quiz-count">Preparando a lição…</h1>`;
  try {
    const all = await carregarQuestoes(q.subject, q.topic);
    if (state.quiz !== q || !box.isConnected) return; // a pessoa já saiu da tela
    q.questions = shuffle(all).slice(0, TAMANHO_LICAO);
    if (!q.questions.length) {
      box.innerHTML = `<h1 class="quiz-count">Ainda não há questões neste tema.</h1>${back}`;
      focusTitle(box);
      return;
    }
    drawQuestion();
  } catch {
    if (state.quiz !== q || !box.isConnected) return;
    box.innerHTML = `<h1 class="quiz-count">Não foi possível carregar as questões.</h1>
      <p class="lede">Confira sua conexão e tente de novo.</p>
      <button class="btn btn--primary" style="margin-top:1rem" id="retry">Tentar de novo</button>${back}`;
    document.getElementById("retry").addEventListener("click", () => loadQuestions(q));
    focusTitle(box);
  }
}

function drawQuestion() {
  const q = state.quiz;
  const s = SUBJECTS[q.subject];
  const t = s.topics[q.topic];
  const item = q.questions[q.i];
  const total = q.questions.length;
  const chosen = q.chosen[q.i];
  const result = q.results[q.i]; // já conferida?
  const answer = result ? item.options.indexOf(result.respostaCorreta) : -1;
  const last = q.i === total - 1;
  const box = document.getElementById("quiz");

  const altState = (k) => {
    if (!result) return "";
    if (k === answer) return "alt--ok";
    if (k === chosen) return "alt--bad";
    return "alt--off";
  };
  const altNote = (k) => {
    if (!result) return "";
    if (k === answer) return `<span class="alt-note">${icon("check")}Resposta certa</span>`;
    if (k === chosen) return `<span class="alt-note">${icon("x")}Sua resposta</span>`;
    return "";
  };

  box.innerHTML = `
      <div class="quiz-top">
        <a class="icon-btn" href="${urls.area(q.subject)}" aria-label="Sair da lição">${icon("xBox")}</a>
        <div class="progress" role="progressbar" aria-valuemin="1" aria-valuemax="${total}" aria-valuenow="${q.i + 1}" aria-label="Progresso da lição"><i style="width:${((q.i + 1) / total) * 100}%"></i></div>
      </div>
      <h1 class="quiz-count">Questão ${q.i + 1} de ${total} — ${esc(t.title)}</h1>
      <section class="statement" aria-labelledby="ask">
        <p class="tag">${esc(s.name.toUpperCase())}</p>
        ${item.text ? `<p class="passage">${esc(item.text)}</p>` : ""}
        ${figuraQuestao(item.imagem, esc)}
        <p class="ask" id="ask">${esc(item.ask)}</p>
        <p class="small source" style="margin-top:.5rem">${esc(fonte(item.prova))}</p>
        <button class="btn btn--light listen" id="listen">${icon("volume")}Ouvir questão</button>
      </section>
      <div class="alts" role="radiogroup" aria-labelledby="ask" ${result ? 'aria-disabled="true"' : ""}>
        ${item.options
          .map(
            (o, k) =>
              `<button class="alt ${altState(k)}" role="radio" aria-checked="${chosen === k}" data-k="${k}" ${result ? "disabled" : ""}>
          <span class="letter">${LETTERS[k]}</span><span>${esc(o)}${altNote(k)}</span></button>`,
          )
          .join("")}
      </div>
      ${
        result
          ? `<section class="tip feedback ${result.acertou ? "feedback--ok" : "feedback--bad"}" aria-labelledby="feedback-title">
          <h2 id="feedback-title">${icon(result.acertou ? "check" : "x")}${result.acertou ? "Você acertou!" : "Não foi dessa vez"}</h2>
          ${result.acertou ? "" : `<p><strong>Resposta certa:</strong> ${LETTERS[answer]}) ${esc(result.respostaCorreta)}</p>`}
          <p>${esc(result.resolucao)}</p>
        </section>
        <div class="quiz-nav">
          <button class="btn btn--primary" id="next">${last ? "Ver resultado" : "Continuar"}${icon("chevronRight")}</button>
        </div>`
          : `<p class="error" id="check-error" role="alert" hidden></p>
        <div class="quiz-nav">
          <button class="btn btn--primary" id="check" ${chosen === undefined ? "disabled" : ""}>Conferir</button>
        </div>`
      }`;

  const readAloud = () =>
    speak(
      `Questão ${q.i + 1}. ${item.text ? item.text + ". " : ""}${item.imagem?.descricao ? "Imagem: " + item.imagem.descricao + ". " : ""}${item.ask} ${item.options.map((o, k) => `Alternativa ${LETTERS[k]}: ${o}.`).join(" ")}`,
    );
  document.getElementById("listen").addEventListener("click", readAloud);

  if (result) {
    document.getElementById("next").addEventListener("click", () => {
      stopSpeaking();
      if (last) return finishLesson();
      q.i++;
      drawQuestion();
      focusTitle(box);
      if (state.a11y.speak) readAloudCurrent();
    });
    return;
  }

  const alts = [...box.querySelectorAll(".alt")];
  const check = document.getElementById("check");
  alts.forEach((b, idx) => {
    b.tabIndex = (chosen ?? 0) === idx ? 0 : -1;
    b.addEventListener("click", () => {
      q.chosen[q.i] = +b.dataset.k;
      alts.forEach((x) => x.setAttribute("aria-checked", String(x === b)));
      check.disabled = false;
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

  // Conferir: manda o TEXTO da alternativa para a API e mostra a correção na hora.
  check.addEventListener("click", async () => {
    if (check.disabled) return;
    check.disabled = true;
    check.textContent = "Conferindo…";
    stopSpeaking();
    const error = document.getElementById("check-error");
    try {
      const r = await api.resposta(item.id, item.options[q.chosen[q.i]]);
      if (state.quiz !== q || !box.isConnected) return;
      q.results[q.i] = r;
      drawQuestion();
      const fb = document.getElementById("feedback-title");
      fb.tabIndex = -1;
      fb.focus();
      if (state.a11y.speak)
        speak(`${r.acertou ? "Você acertou!" : "Não foi dessa vez. A resposta certa é: " + r.respostaCorreta + "."} ${r.resolucao}`);
    } catch {
      if (!box.isConnected) return;
      error.hidden = false;
      error.textContent = "Não foi possível conferir. Sua escolha foi mantida. Tente de novo.";
      check.disabled = false;
      check.textContent = "Conferir";
      check.focus();
    }
  });

  if (state.a11y.speak && q.i === 0 && chosen === undefined) readAloud();
}

function readAloudCurrent() {
  document.getElementById("listen")?.click();
}

// Guarda o resumo da lição (com a correção que veio da API) e abre o resultado.
function finishLesson() {
  const q = state.quiz;
  const items = q.questions.map((item, k) => {
    const r = q.results[k];
    return {
      id: item.id, // conta como atividade concluída quando acertada (stats.js)
      ask: item.ask,
      options: item.options,
      chosen: q.chosen[k],
      answer: item.options.indexOf(r.respostaCorreta),
      why: r.resolucao,
      topic: item.topic,
      ok: r.acertou,
    };
  });
  const correct = items.filter((x) => x.ok).length;
  state.results.push({
    v: 3, // lição por tema (ver state.js)
    subject: q.subject,
    topic: q.topic,
    date: Date.now(),
    correct,
    total: items.length,
    items,
    weakTopic: correct < items.length ? q.topic : null,
  });
  save.results();
  q.finished = true;
  go(urls.resultado(state.results.length - 1));
}
