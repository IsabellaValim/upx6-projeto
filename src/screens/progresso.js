/* Progresso: resumo da prova escolhida, cada matéria e as últimas lições/simulados */
import { NIVEIS, materiasDoNivel } from "../data.js";
import { icon } from "../icons.js";
import { state } from "../core/state.js";
import { esc, pct } from "../core/utils.js";
import { subjectProgress, nextActivity, resultadosDaProva, streakDays } from "../core/stats.js";
import { historyList, subjectCards } from "../components/progress.js";
import { urls } from "../core/urls.js";

export default function progresso() {
  const materias = materiasDoNivel(state.nivel);
  const geral = materias.reduce(
    (acc, s) => {
      const p = subjectProgress(s.id);
      return { done: acc.done + p.done, total: acc.total + p.total };
    },
    { done: 0, total: 0 },
  );
  const resultados = resultadosDaProva(state.nivel);
  const certas = resultados.reduce((s, r) => s + r.correct, 0);
  const respondidas = resultados.reduce((s, r) => s + r.total, 0);
  const dias = streakDays();
  // "Continuar": primeiro a matéria estudada por último (como no início), depois as outras.
  const ultima = resultados[0]?.subject;
  const ordem = [...materias].sort((a, b) => (b.id === ultima) - (a.id === ultima));
  const next = ordem.map((s) => ({ s, n: nextActivity(s.id) })).find((x) => x.n);

  const destaque = (valor, rotulo) =>
    `<div class="stat"><strong>${valor}</strong><span>${rotulo}</span></div>`;

  return {
    cls: "screen--nav",
    nav: "progresso",
    html: `
        <h1 class="title">Seu progresso</h1>
        <p class="lede">Prova: <strong>${NIVEIS[state.nivel]?.nome ?? ""}</strong> · <a class="link" href="${urls.nivel}">Trocar</a></p>

        <section class="card progress-card" aria-labelledby="resumo">
          <h2 id="resumo">Atividades concluídas</h2>
          <p><strong>${geral.done}</strong> de ${geral.total}</p>
          <div class="bar" role="progressbar" aria-label="Atividades concluídas na prova" aria-valuenow="${geral.done}" aria-valuemin="0" aria-valuemax="${geral.total}"><i style="width:${geral.total ? (geral.done / geral.total) * 100 : 0}%"></i></div>
          <div class="stats" style="margin-top:1rem">
            ${destaque(dias, dias === 1 ? "dia seguido" : "dias seguidos")}
            ${destaque(resultados.length, resultados.length === 1 ? "lição ou simulado" : "lições e simulados")}
            ${destaque(respondidas ? pct(certas, respondidas) + "%" : "—", "de acertos")}
          </div>
        </section>

        ${
          next
            ? `<a class="continue-btn" href="${next.n.href}">
          ${icon(next.n.kind === "aula" ? "playCircle" : "checkSquare")}
          <span><strong>Continuar estudando</strong><small>${esc(next.s.name)} · ${esc(next.n.titulo)}</small></span>
          ${icon("chevronRight", "chev")}
        </a>`
            : ""
        }

        <h2 class="section-label">Por matéria</h2>
        <div class="subject-list">${subjectCards()}</div>

        <h2 class="section-label">Últimas lições e simulados</h2>
        ${
          resultados.length
            ? historyList(10)
            : `<div class="empty">
          <p>Quando você praticar um tema ou fizer um simulado, o resultado aparece aqui.</p>
          <a class="btn btn--primary btn--sm" href="${urls.home}">Escolher um tema</a>
        </div>`
        }`,
  };
}
