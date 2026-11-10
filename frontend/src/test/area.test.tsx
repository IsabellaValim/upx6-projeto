/* Área: marca visual de ação concluída (aula assistida / prática zerada). */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from '../App'
import { useApp } from '../core/store'
import { A11Y_PADRAO, MATERIA, type AppState } from './helpers'

function reset(patch: Partial<AppState> = {}) {
  localStorage.clear()
  useApp.setState({
    user: { name: 'Visitante', guest: true },
    nivel: 'medio',
    a11y: { ...A11Y_PADRAO },
    results: [],
    watched: {},
    quiz: null,
    simulado: null,
    subjects: { matematica: MATERIA },
    catalogoStatus: 'ready',
    ...patch,
  })
}

const abrirArea = async () => {
  window.history.pushState({}, '', '/area/matematica')
  render(<App />)
  // Abre o tema para ver os botões.
  fireEvent.click(await screen.findByText('Porcentagem'))
}

afterEach(cleanup)
beforeEach(() => reset())

describe('Área: ações concluídas', () => {
  it('nada feito: "Praticar" primário e "Ver aula" outline, sem verde', async () => {
    await abrirArea()
    expect(screen.getByRole('link', { name: /Praticar/ })).toHaveClass('btn--primary')
    const aula = screen.getByRole('link', { name: 'Ver aula' })
    expect(aula).toHaveClass('btn--outline')
    expect(aula.className).not.toContain('btn--done')
  })

  it('aula assistida: "Rever aula" com btn--done', async () => {
    reset({ watched: { 'matematica/0/0': 1 } })
    await abrirArea()
    const aula = screen.getByRole('link', { name: 'Rever aula' })
    expect(aula.className).toContain('btn--done')
  })

  it('prática zerada (todas acertadas): "Praticar de novo" com btn--done', async () => {
    reset({
      results: [
        {
          v: 3,
          subject: 'matematica',
          topic: 0,
          date: Date.now(),
          correct: 3,
          total: 3,
          weakTopic: null,
          items: [1, 2, 3].map((id) => ({
            id,
            topic: 0,
            ask: 'P?',
            options: ['a', 'b'],
            chosen: 0,
            answer: 0,
            why: 'w',
            ok: true,
          })),
        },
      ],
    })
    await abrirArea()
    const pratica = screen.getByRole('link', { name: 'Praticar de novo' })
    expect(pratica.className).toContain('btn--done')
  })
})
