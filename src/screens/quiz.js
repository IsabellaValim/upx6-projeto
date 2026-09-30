/* Quiz */
import { SUBJECTS } from "../data.js";
import { icon } from "../icons.js";
import { $app } from "../core/dom.js";
import { state, save } from "../core/state.js";
import { LETTERS, esc, go, shuffle } from "../core/utils.js";
import { speak, stopSpeaking } from "../core/speech.js";
import home from "./home.js";
import { urls } from "../core/urls.js";

export default function quiz(id) {
  const s = SUBJECTS[id];
  if (!s) return home();
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
}

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
        <a class="icon-btn" href="${urls.area(q.subject)}" aria-label="Sair do quiz">${icon("xBox")}</a>
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
  go(urls.resultado(state.results.length - 1));
}
