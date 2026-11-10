import { beforeEach, describe, expect, it, vi } from 'vitest'
import { local, useApp } from './store'

describe('store (persistência estudae:*)', () => {
  beforeEach(() => {
    localStorage.clear()
    useApp.setState({
      user: null,
      nivel: null,
      results: [],
      watched: {},
      quiz: null,
      simulado: null,
    })
  })

  it('setUser grava e remove estudae:user', () => {
    useApp.getState().setUser({ name: 'Ana' })
    expect(local.get('user', null)).toEqual({ name: 'Ana' })
    useApp.getState().setUser(null)
    expect(localStorage.getItem('estudae:user')).toBeNull()
  })

  it('setNivel grava estudae:nivel', () => {
    useApp.getState().setNivel('medio')
    expect(local.get('nivel', null)).toBe('medio')
  })

  it('setA11y faz merge e grava estudae:a11y', () => {
    useApp.getState().setA11y({ contrast: true })
    useApp.getState().setA11y({ font: 'extragrande' })
    const a = local.get('a11y', {} as Record<string, unknown>)
    expect(a.contrast).toBe(true)
    expect(a.font).toBe('extragrande')
  })

  it('pushResult acumula e grava estudae:results', () => {
    const r = { v: 3, subject: 'matematica', topic: 0, date: 1, correct: 4, total: 5, items: [], weakTopic: 0 }
    useApp.getState().pushResult(r)
    expect(local.get('results', [])).toEqual([r])
  })

  it('setWatched/clearWatched grava estudae:watched', () => {
    useApp.getState().setWatched('matematica/0/1')
    expect(local.get<Record<string, number>>('watched', {})).toHaveProperty('matematica/0/1')
    useApp.getState().clearWatched('matematica/0/1')
    expect(local.get<Record<string, number>>('watched', {})).not.toHaveProperty('matematica/0/1')
  })

  it('results iniciais filtram v < 2 (conteúdo de exemplo antigo)', async () => {
    localStorage.setItem(
      'estudae:results',
      JSON.stringify([
        { v: 1, subject: 'x' },
        { v: 3, subject: 'matematica' },
        { semVersao: true },
      ]),
    )
    vi.resetModules()
    const novo = await import('./store')
    expect(novo.useApp.getState().results).toEqual([{ v: 3, subject: 'matematica' }])
    vi.resetModules()
  })
})
