import { describe, expect, it } from 'vitest'
import { avaliarEvolucao } from './evolucao'
import type { Resultado } from '../../types'

const atividade = (subject: string, correct: number, total: number): Resultado => ({
  v: 3,
  subject,
  correct,
  total,
  date: Date.now(),
  items: [],
  weakTopic: null,
})

describe('evolução imediata com registros reais', () => {
  it('não inventa progresso sem respostas', () => {
    expect(avaliarEvolucao([], 'matematica').rotulo).toBe('Para começar')
  })
  it('informa bom desempenho após uma lição curta, sem falar em domínio', () => {
    const r = avaliarEvolucao([atividade('matematica', 4, 5)], 'matematica')
    expect(r.rotulo).toBe('Indo bem nas atividades')
    expect(r.acertos).toBe(4)
    expect(r.respondidas).toBe(5)
  })
  it('distingue disciplinas e compara sessões', () => {
    const r = avaliarEvolucao([
      atividade('matematica', 1, 5),
      atividade('linguagens', 5, 5),
      atividade('matematica', 4, 5),
    ], 'matematica')
    expect(r.respondidas).toBe(10)
    expect(r.mensagem).toContain('melhorou')
  })
  it('ignora dados incoerentes', () => {
    const r = avaliarEvolucao([
      atividade('matematica', 5, 4),
      atividade('matematica', 3, 4),
    ], 'matematica')
    expect(r.rotulo).toBe('Primeiros passos')
    expect(r.respondidas).toBe(4)
  })
})
