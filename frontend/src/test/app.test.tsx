/* Integração do App: guardas de usuário/prova, rotas legadas e gate do catálogo. */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from '../App'
import { useApp } from '../core/store'
import type { A11y, CatalogSubject } from '../types'
import { A11Y_PADRAO, MATERIA, type AppState } from './helpers'

function reset(patch: Partial<AppState> = {}) {
  localStorage.clear()
  useApp.setState({
    user: null,
    nivel: null,
    a11y: { ...A11Y_PADRAO } as A11y,
    results: [],
    watched: {},
    quiz: null,
    simulado: null,
    subjects: { matematica: MATERIA } as Record<string, CatalogSubject>,
    catalogoStatus: 'ready', // pula o gate (o carregamento já tem teste próprio)
    ...patch,
  })
}

const abrir = (rota: string) => {
  window.history.pushState({}, '', rota)
  return render(<App />)
}

afterEach(cleanup)
beforeEach(() => reset())

describe('App: guardas e rotas', () => {
  it('sem usuário, /home cai em boas-vindas', async () => {
    abrir('/home')
    expect(await screen.findByText('Criar conta')).toBeInTheDocument()
  })

  it('com usuário e sem prova, /home cai na escolha da prova', async () => {
    reset({ user: { name: 'Visitante', guest: true } })
    abrir('/home')
    expect(await screen.findByText(/Qual prova do Encceja/)).toBeInTheDocument()
  })

  it('com usuário e prova, /home mostra a saudação e as matérias', async () => {
    reset({ user: { name: 'Visitante', guest: true }, nivel: 'medio' })
    abrir('/home')
    expect(await screen.findByText('Olá! Vamos estudar?')).toBeInTheDocument()
    expect(screen.getByText('Matemática')).toBeInTheDocument()
    expect(screen.getByText('Simulado')).toBeInTheDocument()
  })

  it('rota desconhecida cai em boas-vindas (sem usuário)', async () => {
    abrir('/rota-que-nao-existe')
    expect(await screen.findByText('Criar conta')).toBeInTheDocument()
  })

  it('legado /quiz/:id redireciona para a área da matéria', async () => {
    reset({ user: { name: 'Visitante', guest: true }, nivel: 'medio' })
    abrir('/quiz/matematica')
    expect(
      await screen.findByRole('heading', { name: 'Matemática' }),
    ).toBeInTheDocument()
  })

  it('erro no catálogo mostra "Tentar de novo"', async () => {
    reset({ catalogoStatus: 'error' })
    abrir('/home')
    expect(
      await screen.findByText('Não foi possível carregar o conteúdo'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Tentar de novo' }),
    ).toBeInTheDocument()
  })

  it('fluxo: visitante → escolhe a prova → chega ao início', async () => {
    abrir('/boas-vindas')
    fireEvent.click(await screen.findByText('Continuar sem conta'))
    // home sem prova → guarda leva para a escolha
    expect(await screen.findByText(/Qual prova do Encceja/)).toBeInTheDocument()
    fireEvent.click(screen.getByText('Ensino Médio'))
    expect(await screen.findByText('Olá! Vamos estudar?')).toBeInTheDocument()
    expect(useApp.getState().user?.guest).toBe(true)
    expect(useApp.getState().nivel).toBe('medio')
    expect(localStorage.getItem('estudae:nivel')).toBe('"medio"')
  })
})
