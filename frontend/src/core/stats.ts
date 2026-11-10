/* Métricas de progresso derivadas do estado (leem o store na hora da
   chamada — as telas re-renderizam quando o estado muda). */
import { useApp } from './store'
import type { Resultado } from '../types'
import { pct } from './utils'
import { urls } from './urls'

const subjects = () => useApp.getState().subjects
const results = () => useApp.getState().results
const watched = () => useApp.getState().watched

export function streakDays(): number {
  const days = new Set(results().map((r) => new Date(r.date).toDateString()))
  let count = 0
  const d = new Date()
  if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1)
  while (days.has(d.toDateString())) {
    count++
    d.setDate(d.getDate() - 1)
  }
  return count
}

export function subjectScore(id: string): number | null {
  const list = results().filter((r) => r.subject === id)
  if (!list.length) return null
  const correct = list.reduce((s, r) => s + r.correct, 0)
  const total = list.reduce((s, r) => s + r.total, 0)
  return pct(correct, total)
}

export function watchedCount(id: string): number {
  return Object.keys(watched()).filter((k) => k.startsWith(id + '/')).length
}
export function totalLessons(id: string): number {
  return subjects()[id].topics.reduce((s, t) => s + t.videos, 0)
}

/* ---------- Atividades (progresso por tema) ----------
   Atividade = cada vídeo-aula do tema (conta quando marcada como concluída)
   + cada questão do tema (conta quando foi acertada ao menos uma vez). */

// Ids das questões já acertadas num tema, em lições ou simulados (os dois
// guardam o id e o tema de cada questão).
function acertadas(id: string, ti: number): Set<number> {
  const ids = new Set<number>()
  for (const r of results())
    if (r.subject === id)
      for (const x of r.items) if (x.topic === ti && x.ok && x.id !== undefined) ids.add(x.id)
  return ids
}

export function topicProgress(id: string, ti: number) {
  const t = subjects()[id].topics[ti]
  const aulas = t.lessons.filter((_, j) => watched()[`${id}/${ti}/${j}`]).length
  const questoes = Math.min(acertadas(id, ti).size, t.totalQuestoes)
  const total = t.videos + t.totalQuestoes
  return {
    done: aulas + questoes,
    total,
    aulas,
    questoes,
    completo: total > 0 && aulas + questoes >= total,
  }
}

export function subjectProgress(id: string) {
  return subjects()[id].topics.reduce(
    (acc, _t, ti) => {
      const p = topicProgress(id, ti)
      return {
        done: acc.done + p.done,
        total: acc.total + p.total,
        aulas: acc.aulas + p.aulas,
        totalAulas: acc.totalAulas + subjects()[id].topics[ti].videos,
        questoes: acc.questoes + p.questoes,
        totalQuestoes: acc.totalQuestoes + subjects()[id].topics[ti].totalQuestoes,
      }
    },
    { done: 0, total: 0, aulas: 0, totalAulas: 0, questoes: 0, totalQuestoes: 0 },
  )
}

export interface ResultadoIndexado extends Resultado {
  i: number
}

// Resultados (lições e simulados) da prova escolhida, do mais novo para o mais antigo.
export function resultadosDaProva(nivel?: string | null): ResultadoIndexado[] {
  return results()
    .map((r, i) => ({ ...r, i }))
    .filter((r) => subjects()[r.subject] && (!nivel || subjects()[r.subject].nivel === nivel))
    .reverse()
}

// Próxima atividade pendente da matéria: no primeiro tema incompleto, a aula
// ainda não vista; se já viu, a prática. null se está tudo feito.
export function nextActivity(id: string) {
  const s = subjects()[id]
  for (let ti = 0; ti < s.topics.length; ti++) {
    const t = s.topics[ti]
    const p = topicProgress(id, ti)
    if (p.completo || p.total === 0) continue
    const j = t.lessons.findIndex((_, k) => !watched()[`${id}/${ti}/${k}`])
    if (j >= 0) return { ti, kind: 'aula' as const, titulo: t.title, href: urls.video(id, ti, j) }
    return { ti, kind: 'pratica' as const, titulo: t.title, href: urls.quiz(id, ti) }
  }
  return null
}
