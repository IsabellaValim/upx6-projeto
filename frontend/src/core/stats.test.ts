import { beforeEach, describe, expect, it } from 'vitest'
import { useApp } from './store'
import {
  nextActivity,
  resultadosDaProva,
  subjectProgress,
  subjectScore,
  topicProgress,
  watchedCount,
} from './stats'
import type { CatalogSubject, Resultado } from '../types'

const matematica: CatalogSubject = {
  id: 'matematica',
  nivel: 'medio',
  name: 'Matemática',
  area: '2 temas',
  icon: 'percent',
  totalQuestoes: 8,
  topics: [
    {
      slug: 'porcentagem',
      title: 'Porcentagem',
      about: null,
      videos: 2,
      totalQuestoes: 5,
      lessons: [
        { id: 1, kind: 'Aula 1', min: 8, youtubeId: 'AAAAAAAAAAA' },
        { id: 2, kind: 'Aula 2', min: null, youtubeId: 'BBBBBBBBBBB' },
      ],
    },
    {
      slug: 'equacoes',
      title: 'Equações',
      about: null,
      videos: 1,
      totalQuestoes: 3,
      lessons: [{ id: 3, kind: 'Aula 3', min: 5, youtubeId: 'CCCCCCCCCCC' }],
    },
  ],
}

const licoes = (extra: Partial<Resultado> = {}): Resultado => ({
  v: 3,
  subject: 'matematica',
  topic: 0,
  date: Date.now(),
  correct: 3,
  total: 5,
  items: [],
  weakTopic: 0,
  ...extra,
})

beforeEach(() => {
  useApp.setState({ subjects: { matematica }, results: [], watched: {} })
})

describe('stats', () => {
  it('topicProgress soma aulas vistas + questões acertadas (sem repetir acerto)', () => {
    useApp.setState({
      watched: { 'matematica/0/0': 1 },
      results: [
        licoes({
          items: [
            { id: 10, topic: 0, ask: '', options: [], chosen: 0, answer: 0, why: '', ok: true },
            { id: 10, topic: 0, ask: '', options: [], chosen: 0, answer: 0, why: '', ok: true },
            { id: 11, topic: 0, ask: '', options: [], chosen: 0, answer: 0, why: '', ok: false },
          ],
        }),
      ],
    })
    const p = topicProgress('matematica', 0)
    expect(p.aulas).toBe(1)
    expect(p.questoes).toBe(1) // id 10 conta uma vez só
    expect(p.done).toBe(2)
    expect(p.total).toBe(7) // 2 vídeos + 5 questões
    expect(p.completo).toBe(false)
  })

  it('subjectProgress agrega os temas', () => {
    const p = subjectProgress('matematica')
    expect(p.totalAulas).toBe(3)
    expect(p.totalQuestoes).toBe(8)
    expect(p.total).toBe(11)
  })

  it('nextActivity: aula não vista do 1º tema incompleto; senão a prática', () => {
    expect(nextActivity('matematica')).toMatchObject({
      ti: 0,
      kind: 'aula',
      href: '/video/matematica/0/0',
    })
    useApp.setState({ watched: { 'matematica/0/0': 1, 'matematica/0/1': 2 } })
    expect(nextActivity('matematica')).toMatchObject({ kind: 'pratica', href: '/quiz/matematica/0' })
  })

  it('subjectScore: % de acertos somando lições e simulados', () => {
    useApp.setState({
      results: [licoes({ correct: 3, total: 5 }), licoes({ kind: 'simulado', correct: 7, total: 10 })],
    })
    expect(subjectScore('matematica')).toBe(67)
    expect(subjectScore('inexistente' as string)).toBeNull()
  })

  it('watchedCount conta aulas da matéria', () => {
    useApp.setState({ watched: { 'matematica/0/0': 1, 'matematica/1/0': 2, 'outra/0/0': 3 } })
    expect(watchedCount('matematica')).toBe(2)
  })

  it('resultadosDaProva filtra por nível, do mais novo ao mais antigo', () => {
    useApp.setState({
      subjects: {
        matematica,
        matfund: { ...matematica, id: 'matfund', nivel: 'fundamental' },
      },
      results: [
        licoes({ subject: 'matematica', date: 100 }),
        licoes({ subject: 'matfund', date: 200 }),
        licoes({ subject: 'matematica', date: 300 }),
        licoes({ subject: 'sumiu', date: 400 }), // disciplina fora do catálogo
      ],
    })
    const meds = resultadosDaProva('medio')
    expect(meds.map((r) => r.date)).toEqual([300, 100])
    expect(meds[0].i).toBe(2) // índice no results original (para a rota /resultado/:i)
  })
})
