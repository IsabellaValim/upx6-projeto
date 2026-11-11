import type { Resultado } from '../../types'

/** Feedback de atividades reais, separado de domínio e preparo para o exame.
 *  Inclui tentativas repetidas, portanto NUNCA serve de prova de domínio. */
export function avaliarEvolucao(resultados: readonly Resultado[], disciplina: string) {
  const recentes = resultados
    .filter(
      (r) =>
        r.subject === disciplina &&
        Number.isSafeInteger(r.total) &&
        r.total > 0 &&
        Number.isSafeInteger(r.correct) &&
        r.correct >= 0 &&
        r.correct <= r.total,
    )
    .slice(-3)
  const respondidas = recentes.reduce((s, r) => s + r.total, 0)
  const acertos = recentes.reduce((s, r) => s + r.correct, 0)
  const rotulo =
    respondidas === 0
      ? 'Para começar'
      : respondidas < 5
        ? 'Primeiros passos'
        : acertos / respondidas >= 0.8
          ? 'Indo bem nas atividades'
          : 'Em aprendizagem'
  let mensagem = 'Continue praticando no seu ritmo.'
  if (recentes.length >= 2) {
    const anterior = recentes[recentes.length - 2]!
    const ultima = recentes[recentes.length - 1]!
    if (ultima.correct / ultima.total > anterior.correct / anterior.total)
      mensagem = 'Seu resultado na última atividade melhorou.'
  }
  return { rotulo, respondidas, acertos, atividades: recentes.length, mensagem }
}
