/* Quiz */
import { SUBJECTS, carregarQuestoes, fonte } from "../data.js";
import { api } from "../core/api.js";
import { icon } from "../icons.js";
import { $app } from "../core/dom.js";
import { state, save } from "../core/state.js";
import { LETTERS, esc, go, shuffle } from "../core/utils.js";
import { speak, stopSpeaking } from "../core/speech.js";
import { toast } from "../core/toast.js";
import home from "./home.js";
import { urls } from "../core/urls.js";

export default function quiz(id) {
  const s = SUBJECTS[id];
  if (!s) return home();
  if (!state.quiz || state.quiz.subject !== id || state.quiz.finished) {
    state.quiz = {
      subject: id,
      questions: null, // chegam da API em after()
      order: [],
      i: 0,
      answers: [],
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

// Busca as questões de todos os temas da matéria e embaralha a ordem.
async function loadQuestions(q) {
  const box = document.getElementById("quiz");
  const back = `<a class="btn btn--outline" style="margin-top:1rem" href="${urls.area(q.subject)}">Voltar para a área</a>`;
  box.innerHTML = `<h1 class="quiz-count">Carregando as questões…</h1>`;
  try {
    const questions = await carregarQuestoes(q.subject);
    if (state.quiz !== q || !box.isConnected) return; // a pessoa já saiu da tela
    q.questions = questions;
    q.order = shuffle(questions.map((_, i) => i));
    if (!questions.length) {
      box.innerHTML = `<h1 class="quiz-count">Ainda não há questões nesta matéria.</h1>${back}`;
      return;
    }
    drawQuestion();
  } catch {
    if (state.quiz !== q || !box.isConnected) return;
    box.innerHTML = `<h1 class="quiz-count">Não foi possível carregar as questões.</h1>
      <p class="lede">Confira sua conexão e tente de novo.</p>
      <button class="btn btn--primary" style="margin-top:1rem" id="retry">Tentar de novo</button>${back}`;
    document.getElementById("retry").addEventListener("click", () => loadQuestions(q));
  }
  const h = box.querySelector("h1");
  h.tabIndex = -1;
  h.focus({ preventScroll: true });
}

function drawQuestion() {
  const q = state.quiz;
  const s = SUBJECTS[q.subject];
  const item = q.questions[q.order[q.i]];
  const total = q.order.length;
  const chosen = q.answers[q.i];
  const last = q.i === total - 1;
  const box = document.getElementById("quiz");
  box.innerHTML = `
      <div class="quiz-top">
        <a class="icon-btn" href="${urls.area(q.subject)}" aria-label="Sair do quiz">${icon("xBox")}</a>
        <div class="progress" role="progressbar" aria-valuemin="1" aria-valuemax="${total}" aria-valuenow="${q.i + 1}" aria-label="Progresso do quiz"><i style="width:${((q.i + 1) / total) * 100}%"></i></div>
      </div>
      <h1 class="quiz-count">Questão ${q.i + 1} de ${total} — ${esc(s.name)}</h1>
      <section class="statement" aria-labelledby="ask">
        <p class="tag">${esc(s.topics[item.topic].title.toUpperCase())}</p>
        ${item.text ? `<p class="passage">${esc(item.text)}</p>` : ""}
        <p class="ask" id="ask">${esc(item.ask)}</p>
        <p class="small" style="margin-top:.5rem">${esc(fonte(item.prova))}</p>
        <button class="btn btn--light listen" id="listen">${icon("volume")}Ouvir questão</button>
      </section>
      <div class="alts" role="radiogroup" aria-labelledby="ask">
        ${item.options
          .map(
            (o, k) =>
              `<button class="alt" role="radio" aria-checked="${chosen === k}" data-k="${k}">
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
    finishQuiz(document.getElementById("next"));
  });
}

// Corrige cada resposta pela API (POST com o texto da alternativa) e guarda no
// resultado tudo o que a tela de resultado precisa mostrar depois.
async function finishQuiz(button) {
  const q = state.quiz;
  button.disabled = true;
  toast("Conferindo suas respostas…");
  let corrections;
  try {
    corrections = await Promise.all(
      q.order.map((qi, k) => api.resposta(q.questions[qi].id, q.questions[qi].options[q.answers[k]])),
    );
  } catch {
    toast("Não foi possível conferir. Suas respostas foram mantidas. Tente de novo.");
    button.disabled = false;
    return;
  }
  if (state.quiz !== q) return;
  const items = q.order.map((qi, k) => {
    const item = q.questions[qi];
    const c = corrections[k];
    return {
      ask: item.ask,
      options: item.options,
      chosen: q.answers[k],
      answer: item.options.indexOf(c.respostaCorreta),
      why: c.resolucao,
      topic: item.topic,
      ok: c.acertou,
    };
  });
  const correct = items.filter((x) => x.ok).length;
  const misses = {};
  items.forEach((x) => {
    if (!x.ok) misses[x.topic] = (misses[x.topic] || 0) + 1;
  });
  const weakTopic = Object.keys(misses).sort(
    (a, b) => misses[b] - misses[a],
  )[0];
  state.results.push({
    v: 2, // formato com a correção da API (ver state.js)
    subject: q.subject,
    date: Date.now(),
    correct,
    total: items.length,
    items,
    weakTopic: weakTopic === undefined ? null : +weakTopic,
  });
  save.results();
  q.finished = true;
  go(urls.resultado(state.results.length - 1));
}
