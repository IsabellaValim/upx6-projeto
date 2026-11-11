import 'fake-indexeddb/auto'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import * as cap from '../core/capturaAprendizagem'
import { criarServicoAprendizagem } from '../core/aprendizagem/servico'
import { NOME_BANCO } from '../core/aprendizagem/persistencia'
import { useApp } from '../core/store'
import { useToast } from '../core/toast'
import type { CatalogSubject, DisciplinaPedagogiaApi } from '../types'
import { A11Y_PADRAO, MATERIA, type AppState } from './helpers'

const ATIVO = {
  habilitado: true,
  registrarEventos: true,
  dominio: true,
  recomendacoes: true,
  disciplinas: ['matematica'],
} as const

const PED = {
  habilidade: 'porcentagem',
  secundarias: [] as string[],
  familia: 'porc',
  dificuldade: null,
  tipo: null,
  revisao: 'aprovada' as const,
  elegivel: true,
  versao: 1,
}

// Cada questão tem a própria família: evidências independentes (a dedup por
// família é uma regra do motor — a mesma família conta uma vez só).
const QUESTOES = [1, 2, 3].map((n) => ({
  id: n,
  codigo: 'Q' + n,
  revisaoConteudo: 'r' + n,
  textoBase: null,
  enunciado: `P${n}?`,
  alternativas: ['certa', 'errada'],
  prova: { ano: 2022, edicao: 'Nacional', nivel: 'Ensino Médio', numero: n },
  imagem: null,
  pedagogia: { ...PED, familia: 'f' + n },
}))

const PEDAGOGIA: DisciplinaPedagogiaApi = {
  disciplina: 'matematica',
  matriz: { versao: '1', validada: true },
  temas: [
    {
      slug: 'porcentagem',
      habilidades: [
        { slug: 'porcentagem', titulo: 'Porcentagem', essencial: true },
      ],
      questoes: QUESTOES.map((q) => ({
        codigo: q.codigo,
        revisaoConteudo: q.revisaoConteudo,
        pedagogia: q.pedagogia,
      })),
    },
  ],
}

const json = (x: unknown, status = 200) =>
  new Response(JSON.stringify(x), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

const mockFetch = (opts: { pedagogia?: boolean } = {}) =>
  vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (init?.method === 'POST') {
      const id = +/questoes\/(\d+)/.exec(url)![1]
      const { alternativa } = JSON.parse(String(init.body))
      return json({
        acertou: alternativa === 'certa',
        respostaCorreta: 'certa',
        resolucao: 'porque sim',
        codigo: 'Q' + id,
        revisaoConteudo: 'r' + id,
      })
    }
    if (url.includes('/pedagogia'))
      return opts.pedagogia === false
        ? json({ erro: 'falha' }, 500)
        : json(PEDAGOGIA)
    if (url.includes('/questoes')) return json(QUESTOES)
    return json({ erro: 'não encontrado' }, 404)
  })

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
    subjects: { matematica: MATERIA } as Record<string, CatalogSubject>,
    catalogoStatus: 'ready',
    ...patch,
  })
}

const abrir = (rota: string) => {
  window.history.pushState({}, '', rota)
  return render(<App />)
}

const apagarBanco = () =>
  new Promise<void>((res) => {
    const r = indexedDB.deleteDatabase(NOME_BANCO)
    r.onsuccess = r.onblocked = r.onerror = () => res()
  })

afterEach(cleanup)

beforeEach(async () => {
  vi.restoreAllMocks()
  reset()
  useToast.setState({ msg: null, seq: 0 })
  document.body.id = 'app'
  await apagarBanco()
  cap.definirServicoAprendizagem(criarServicoAprendizagem({ ...ATIVO }))
})

describe('Estudo adaptativo: jornada guiada no Início', () => {
  it('primeiro acesso mostra "Começar meu estudo" para a rodada de diagnóstico', async () => {
    vi.stubGlobal('fetch', mockFetch())
    abrir('/home')
    const card = await screen.findByText('Começar meu estudo')
    const link = card.closest('a')!
    expect(link.getAttribute('href')).toBe('/estudo/matematica')
    expect(link).toHaveTextContent('Matemática · algumas questões para começar')
  })

  it('depois do diagnóstico, o Início aponta a prática seguinte', async () => {
    vi.stubGlobal('fetch', mockFetch())
    abrir('/estudo/matematica')
    // A rodada mistura os temas da disciplina; aqui há um só, com 3 itens.
    for (let k = 0; k < 3; k++) {
      fireEvent.click(await screen.findByRole('radio', { name: /certa/ }))
      fireEvent.click(screen.getByRole('button', { name: 'Conferir' }))
      await screen.findByText('Você acertou!')
      fireEvent.click(
        screen.getByRole('button', {
          name: k === 2 ? 'Ver resultado' : 'Continuar',
        }),
      )
    }
    await waitFor(() => expect(useApp.getState().results.length).toBe(1))
    cleanup()
    abrir('/home')
    const card = await screen.findByText('Praticar')
    expect(card.closest('a')!.getAttribute('href')).toBe('/quiz/matematica/0')
  })

  it('sem pedagogia disponível o Início fica no fluxo tradicional', async () => {
    vi.stubGlobal('fetch', mockFetch({ pedagogia: false }))
    abrir('/home')
    expect(await screen.findByText('Estudar por matéria')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByText('Começar meu estudo')).toBeNull(),
    )
  })
})

describe('Estudo adaptativo: próxima ação no Resultado', () => {
  it('a CTA primária vem do orquestrador, não da nota da rodada', async () => {
    vi.stubGlobal('fetch', mockFetch())
    abrir('/estudo/matematica')
    for (let k = 0; k < 3; k++) {
      fireEvent.click(await screen.findByRole('radio', { name: /certa/ }))
      fireEvent.click(screen.getByRole('button', { name: 'Conferir' }))
      await screen.findByText('Você acertou!')
      fireEvent.click(
        screen.getByRole('button', {
          name: k === 2 ? 'Ver resultado' : 'Continuar',
        }),
      )
    }
    await waitFor(() => expect(useApp.getState().results.length).toBe(1))
    // Nota 100% não decide nada: quem manda é a jornada (evidência ainda
    // insuficiente → continuar praticando o tema).
    const cta = await screen.findByRole('link', {
      name: /Praticar — Matemática/,
    })
    expect(cta.getAttribute('href')).toBe('/quiz/matematica/0')
    expect(screen.queryByRole('link', { name: 'Praticar de novo' })).toBeNull()
    expect(
      screen.queryByRole('link', { name: 'Escolher outro tema' }),
    ).toBeNull()
  })

  it('sem pedagogia o Resultado mantém o par de sempre', async () => {
    vi.stubGlobal('fetch', mockFetch({ pedagogia: false }))
    abrir('/quiz/matematica/0')
    for (let k = 0; k < 3; k++) {
      fireEvent.click(await screen.findByRole('radio', { name: /certa/ }))
      fireEvent.click(screen.getByRole('button', { name: 'Conferir' }))
      await screen.findByText('Você acertou!')
      fireEvent.click(
        screen.getByRole('button', {
          name: k === 2 ? 'Ver resultado' : 'Continuar',
        }),
      )
    }
    await waitFor(() => expect(useApp.getState().results.length).toBe(1))
    // Sem pedagogia não há ação orquestrada: fica o par simples de sempre.
    expect(
      await screen.findByRole('link', { name: 'Praticar de novo' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Ver meu aprendizado' }),
    ).toHaveAttribute('href', '/aprendizado')
    expect(
      screen.queryByRole('link', { name: /Praticar — Matemática/ }),
    ).toBeNull()
  })
})

describe('Estudo adaptativo: estágio na Área', () => {
  it('tema sem evidência aparece "Para começar" com a sugestão', async () => {
    vi.stubGlobal('fetch', mockFetch())
    abrir('/area/matematica')
    expect(await screen.findByText('Para começar')).toBeInTheDocument()
    const card = await screen.findByText('Sugestão')
    expect(card.closest('a')).toHaveTextContent(
      'Porcentagem — um assunto novo para conhecer',
    )
  })

  it('depois da lição, o tema mostra evolução "Em progresso"', async () => {
    vi.stubGlobal('fetch', mockFetch())
    abrir('/quiz/matematica/0')
    for (let k = 0; k < 3; k++) {
      fireEvent.click(await screen.findByRole('radio', { name: /certa/ }))
      fireEvent.click(screen.getByRole('button', { name: 'Conferir' }))
      await screen.findByText('Você acertou!')
      fireEvent.click(
        screen.getByRole('button', {
          name: k === 2 ? 'Ver resultado' : 'Continuar',
        }),
      )
    }
    await waitFor(() => expect(useApp.getState().results.length).toBe(1))
    // O próprio resultado já mostra a evolução do tema.
    expect(await screen.findByText('Em progresso')).toBeInTheDocument()
    cleanup()
    abrir('/area/matematica')
    expect(await screen.findByText('Em progresso')).toBeInTheDocument()
  })
})
