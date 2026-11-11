/* Atividade concluída: placar pequeno, evolução do tema quando houver
   comparação honesta e próximo passo do orquestrador. Nada de "tema
   concluído" — concluída é a atividade, não o assunto. */
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
    {
      ask: 'P1?',
      options: ['a', 'b'],
      chosen: 0,
      answer: 1,
      why: 'porque',
      ok: false,
      topic: 0,
    },
    {
      ask: 'P2?',
      options: ['a', 'b'],
      chosen: 1,
      answer: 0,
      why: 'porque',
      ok: false,
      topic: 0,
    },
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

describe('Atividade concluída: o que a tela diz e o que não diz', () => {
  it('anuncia a atividade concluída, nunca o tema', async () => {
    abrir()
    expect(
      await screen.findByRole('heading', { name: 'Atividade concluída' }),
    ).toBeInTheDocument()
    // Nem com o motor desligado a tela inventa "tema concluído".
    expect(screen.queryByText(/tema concluído/i)).not.toBeInTheDocument()
    expect(
      screen.queryByText(/você já concluiu \d+ de \d+ atividades/i),
    ).not.toBeInTheDocument()
  })

  it('nota máxima não vira "tema concluído" nem disfarça a lição', async () => {
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
    expect(
      await screen.findByText(/Você acertou todas as questões/),
    ).toBeInTheDocument()
    expect(screen.queryByText(/tema concluído/i)).not.toBeInTheDocument()
  })

  it('caixas de números e correção recolhida com contagem no título', async () => {
    abrir()
    expect(await screen.findByText('Acertos')).toBeInTheDocument()
    expect(screen.getByText('Erros')).toBeInTheDocument()
    expect(screen.getByText('Questões')).toBeInTheDocument()
    const review = screen.getByText(/Correção das questões — 2 erradas/)
    expect(review.closest('details')).not.toHaveAttribute('open')
    expect(screen.getByText(/Não desanime/)).toBeInTheDocument()
  })

  it('CTA primário é praticar de novo; o aprendizado fica a um toque', async () => {
    abrir()
    expect(
      await screen.findByRole('link', { name: 'Praticar de novo' }),
    ).toHaveClass('btn--primary')
    expect(
      screen.getByRole('link', { name: 'Ver meu aprendizado' }),
    ).toHaveAttribute('href', '/aprendizado')
  })
})
