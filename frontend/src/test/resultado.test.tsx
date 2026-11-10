/* Resultado: destaque da videoaula assistida e CTA que muda com a situação. */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from '../App'
import { useApp } from '../core/store'
import type { Resultado } from '../types'
import { A11Y_PADRAO, MATERIA, type AppState } from './helpers'

const RESULTADO: Resultado = {
  v: 3,
  subject: 'matematica',
  topic: 0,
  date: Date.now(),
  correct: 0,
  total: 2,
  weakTopic: null,
  items: [
    { ask: 'P1?', options: ['a', 'b'], chosen: 0, answer: 1, why: 'porque', ok: false, topic: 0 },
    { ask: 'P2?', options: ['a', 'b'], chosen: 1, answer: 0, why: 'porque', ok: false, topic: 0 },
  ],
}

function reset(patch: Partial<AppState> = {}) {
  localStorage.clear()
  useApp.setState({
    user: { name: 'Visitante', guest: true },
    nivel: 'medio',
    a11y: { ...A11Y_PADRAO },
    results: [RESULTADO],
    watched: {},
    quiz: null,
    simulado: null,
    subjects: { matematica: MATERIA },
    catalogoStatus: 'ready',
    ...patch,
  })
}

const abrir = () => {
  window.history.pushState({}, '', '/resultado/0')
  return render(<App />)
}

afterEach(cleanup)
beforeEach(() => reset())

describe('Resultado: destaque da videoaula', () => {
  it('aula não assistida: "0 de 1" e CTA primária "Assistir à aula"', async () => {
    abrir()
    expect(await screen.findByText('0 de 1 aula do tema assistida')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /Assistir à aula deste tema/ }),
    ).toHaveClass('btn--primary')
  })

  it('aula assistida: destaque "já assistida" e CTA de rever (outline)', async () => {
    reset({ watched: { 'matematica/0/0': 1 } })
    abrir()
    expect(await screen.findByText('Aula do tema já assistida')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /Assistir à aula de novo/ }),
    ).toHaveClass('btn--outline')
    expect(
      screen.getByText(/vale revê-la ou conferir a correção/),
    ).toBeInTheDocument()
  })

  it('nota máxima + aula vista: "tema concluído", cartão verde, sem CTA de aula', async () => {
    reset({
      watched: { 'matematica/0/0': 1 },
      results: [
        {
          ...RESULTADO,
          correct: 2,
          items: RESULTADO.items.map((x) => ({ ...x, ok: true })),
        },
      ],
    })
    abrir()
    expect(await screen.findByText(/tema concluído/)).toBeInTheDocument()
    expect(document.querySelector('.tip--ok')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Assistir à aula/ })).not.toBeInTheDocument()
  })
})
