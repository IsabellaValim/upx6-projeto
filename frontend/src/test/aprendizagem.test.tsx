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
import type { PersistenciaAprendizagem } from '../core/aprendizagem/persistencia'
import { useApp } from '../core/store'
import { useToast } from '../core/toast'
import type { CatalogSubject } from '../types'
import { A11Y_PADRAO, MATERIA, type AppState } from './helpers'

const ATIVO = {
  habilitado: true,
  registrarEventos: true,
  dominio: false,
  recomendacoes: false,
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

const QUESTOES = [1, 2, 3].map((n) => ({
  id: n,
  codigo: 'Q' + n,
  revisaoConteudo: 'r' + n,
  textoBase: null,
  enunciado: `P${n}?`,
  alternativas: ['certa', 'errada'],
  prova: { ano: 2022, edicao: 'Nacional', nivel: 'Ensino Médio', numero: n },
  imagem: null,
  pedagogia: PED,
}))

const json = (x: unknown, status = 200) =>
  new Response(JSON.stringify(x), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

const mockFetch = (
  falhar?: (url: string) => boolean,
  questoes: unknown[] = QUESTOES,
) =>
  vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (falhar?.(url)) return json({ erro: 'falha' }, 500)
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
    if (url.includes('/questoes')) return json(questoes)
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

const servicoAtivo = () => criarServicoAprendizagem({ ...ATIVO })

afterEach(cleanup)

beforeEach(async () => {
  vi.restoreAllMocks()
  reset()
  useToast.setState({ msg: null, seq: 0 })
  document.body.id = 'app'
  await apagarBanco()
})

describe('Aprendizagem: flag desligada (fluxo tradicional)', () => {
  it('lição funciona sem gravar nada no motor', async () => {
    const svc = criarServicoAprendizagem()
    cap.definirServicoAprendizagem(svc)
    vi.stubGlobal('fetch', mockFetch())
    abrir('/quiz/matematica/0')
    fireEvent.click(await screen.findByRole('radio', { name: /certa/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Conferir' }))
    expect(await screen.findByText('Você acertou!')).toBeInTheDocument()
    expect(await svc.ler()).toBeNull()
  })
})

describe('Aprendizagem: flag ligada', () => {
  it('lição grava apresentação, submissão e correção/exposição', async () => {
    const svc = servicoAtivo()
    cap.definirServicoAprendizagem(svc)
    vi.stubGlobal('fetch', mockFetch())
    abrir('/quiz/matematica/0')
    fireEvent.click(await screen.findByRole('radio', { name: /certa/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Conferir' }))
    expect(await screen.findByText('Você acertou!')).toBeInTheDocument()
    const estado = await svc.ler()
    const submissao = estado!.eventos.find((e) => e.tipo === 'submissao')!
    expect(submissao.respostaTexto).toBe('certa')
    expect(submissao.revisaoApi).toMatch(/^r[123]$/)
    expect(submissao.incerta).toBe(false)
    const tipos = estado!.eventos.map((e) => e.tipo).sort()
    expect(tipos).toEqual([
      'apresentacao',
      'correcao',
      'exposicao',
      'submissao',
    ])
    expect(estado!.eventos.find((e) => e.tipo === 'submissao')!.respondeu).toBe(
      true,
    )
  })

  it('falha de armazenamento degrada com aviso e segue tradicional', async () => {
    const persistenciaRuim: PersistenciaAprendizagem = {
      ler: () => Promise.reject(new Error('quota')),
      alterar: () => Promise.reject(new Error('quota')),
      reiniciar: () => Promise.reject(new Error('quota')),
      recuperarReset: () => Promise.resolve(),
      fechar: () => {},
    }
    const svc = criarServicoAprendizagem(
      { ...ATIVO },
      { persistencia: persistenciaRuim },
    )
    cap.definirServicoAprendizagem(svc)
    vi.stubGlobal('fetch', mockFetch())
    abrir('/quiz/matematica/0')
    fireEvent.click(await screen.findByRole('radio', { name: /certa/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Conferir' }))
    expect(await screen.findByText('Você acertou!')).toBeInTheDocument()
    expect(useToast.getState().msg ?? '').toMatch(/continuar normalmente/)
  })
})

describe('Aprendizagem: escopo e compatibilidade', () => {
  it('status desativado não congela a resposta nem avisa falha', async () => {
    const svc = criarServicoAprendizagem({
      ...ATIVO,
      disciplinas: ['linguagens'],
    })
    cap.definirServicoAprendizagem(svc)
    let falhou = false
    vi.stubGlobal(
      'fetch',
      mockFetch((url) => {
        if (!falhou && url.includes('/resposta')) {
          falhou = true
          return true
        }
        return false
      }),
    )
    abrir('/quiz/matematica/0')
    fireEvent.click(await screen.findByRole('radio', { name: /certa/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Conferir' }))
    expect(await screen.findByText(/Não foi possível conferir/)).toBeVisible()
    expect(useApp.getState().quiz?.pendente).toBeUndefined()
    fireEvent.click(screen.getByRole('radio', { name: /errada/ }))
    expect(screen.getByRole('radio', { name: /errada/ })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Conferir' }))
    expect(await screen.findByText('Não foi dessa vez')).toBeInTheDocument()
    expect(useToast.getState().msg).toBeNull()
  })

  it('questão sem código estável não grava evento e degrada a sessão', async () => {
    const svc = servicoAtivo()
    cap.definirServicoAprendizagem(svc)
    const semCodigo = QUESTOES.map(({ codigo: _c, ...q }) => q)
    vi.stubGlobal('fetch', mockFetch(undefined, semCodigo))
    abrir('/quiz/matematica/0')
    fireEvent.click(await screen.findByRole('radio', { name: /certa/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Conferir' }))
    expect(await screen.findByText('Você acertou!')).toBeInTheDocument()
    expect((await svc.ler())!.eventos).toEqual([])
    expect(useApp.getState().quiz?.captura?.confiavel).toBe(false)
    expect(useToast.getState().msg ?? '').toMatch(/continuar normalmente/)
  })
})

describe('Aprendizagem: simulado', () => {
  const entregarSimulado = async () => {
    abrir('/simulado/matematica')
    fireEvent.click(await screen.findByRole('radio', { name: /certa/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Próxima' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Próxima' }))
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Entregar simulado' })[0]!,
    )
    fireEvent.click(
      await screen.findByRole('button', { name: 'Entregar mesmo assim' }),
    )
  }

  it('omissões viram submissão respondeu=false e a conclusão é gravada', async () => {
    const svc = servicoAtivo()
    cap.definirServicoAprendizagem(svc)
    vi.stubGlobal('fetch', mockFetch())
    await entregarSimulado()
    expect(await screen.findByText('Acertos')).toBeInTheDocument()
    const estado = await svc.ler()
    const submissoes = estado!.eventos.filter((e) => e.tipo === 'submissao')
    expect(submissoes.map((s) => s.respondeu)).toEqual([true, false, false])
    expect(estado!.conclusoes).toHaveLength(1)
    expect(useApp.getState().results).toHaveLength(1)
  })

  it('correção parcial: o retry retoma sem duplicar o resultado', async () => {
    const svc = servicoAtivo()
    cap.definirServicoAprendizagem(svc)
    let falhou = false
    vi.stubGlobal(
      'fetch',
      mockFetch((url) => {
        if (!falhou && url.includes('/questoes/2/resposta')) {
          falhou = true
          return true
        }
        return false
      }),
    )
    await entregarSimulado()
    await waitFor(() =>
      expect(useToast.getState().msg ?? '').toMatch(/Tente de novo/),
    )
    expect(useApp.getState().results).toHaveLength(0)
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Entregar simulado' })[0]!,
    )
    expect(await screen.findByText('Acertos')).toBeInTheDocument()
    expect(useApp.getState().results).toHaveLength(1)
    expect(useApp.getState().results[0]!.kind).toBe('simulado')
    const estado = await svc.ler()
    expect(estado!.conclusoes).toHaveLength(1)
  })

  it('simulado abandonado não vira evidência (sem conclusão)', async () => {
    const svc = servicoAtivo()
    cap.definirServicoAprendizagem(svc)
    vi.stubGlobal('fetch', mockFetch())
    abrir('/simulado/matematica')
    expect(await screen.findByText(/Questão 1 de 3/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Sair do simulado' }))
    fireEvent.click(await screen.findByRole('link', { name: 'Sair' }))
    const estado = await svc.ler()
    expect(estado!.conclusoes).toHaveLength(0)
    expect(estado!.eventos.every((e) => e.tipo === 'apresentacao')).toBe(true)
  })
})

describe('Aprendizagem: histórico legado', () => {
  it.each([1, undefined])(
    'marca resultado legado com id %s como incerto sem reconstruir eventos',
    async (id) => {
      const svc = servicoAtivo()
      cap.definirServicoAprendizagem(svc)
      useApp.setState({
        results: [
          {
            v: 3,
            subject: 'matematica',
            date: 1,
            correct: 1,
            total: 1,
            weakTopic: null,
            items: [
              {
                id,
                ask: 'antiga',
                options: ['certa'],
                chosen: 0,
                answer: 0,
                why: 'legada',
                ok: true,
              },
            ],
          },
        ],
      })
      const sessao = await cap.novaSessaoCaptura('licao')
      expect((await svc.ler())!.eventos).toEqual([])
      const questao = cap.questaoAprendizagem(
        {
          id: 1,
          codigo: 'Q1',
          revisaoConteudo: 'r1',
          topic: 0,
          text: null,
          ask: 'P?',
          options: ['certa', 'errada'],
          prova: null,
          imagem: null,
          pedagogia: PED,
        },
        'matematica',
        'porcentagem',
      )
      const tid = cap.tentativaId(sessao, 0)
      await cap.apresentar(sessao, questao, tid)
      await cap.submeter(sessao, questao, tid, true, false, 'certa')
      await cap.corrigir(sessao, questao, tid, true, false, 'r1', 'Q1')
      const estado = (await svc.ler())!
      expect(estado.eventos).toHaveLength(4)
      expect(estado.eventos.find((e) => e.tipo === 'submissao')!.incerta).toBe(
        true,
      )
      expect(estado.eventos.every((e) => e.sessaoId === sessao!.id)).toBe(true)
      expect(useApp.getState().results).toHaveLength(1)
    },
  )
})

describe('Aprendizagem: reset com IndexedDB indisponível', () => {
  it('limpa o legado, mantém a marca pendente e mostra aviso parcial', async () => {
    const persistencia: PersistenciaAprendizagem = {
      ler: () => Promise.reject(new Error('idb')),
      alterar: () => Promise.reject(new Error('idb')),
      reiniciar: () => Promise.reject(new Error('idb')),
      recuperarReset: () => Promise.reject(new Error('idb')),
      fechar: () => {},
    }
    cap.definirServicoAprendizagem(
      criarServicoAprendizagem({ ...ATIVO }, { persistencia }),
    )
    vi.stubGlobal('fetch', mockFetch())
    const antigo = {
      v: 3,
      subject: 'matematica',
      topic: 0,
      date: Date.now(),
      correct: 1,
      total: 1,
      items: [],
      weakTopic: null,
    }
    reset({ results: [antigo], watched: { 'matematica/0/0': 1 } })
    localStorage.setItem('estudae:results', JSON.stringify([antigo]))
    localStorage.setItem('estudae:watched', '{"matematica/0/0":1}')
    abrir('/perfil')
    fireEvent.click(
      await screen.findByRole('button', { name: 'Apagar progresso' }),
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Apagar tudo' }))
    await waitFor(() =>
      expect(useToast.getState().msg ?? '').toMatch(
        /Não foi possível concluir a limpeza/,
      ),
    )
    expect(localStorage.getItem('estudae:results')).toBeNull()
    expect(localStorage.getItem('estudae:watched')).toBeNull()
    expect(useApp.getState().results).toEqual([])
    expect(localStorage.getItem('estudae:aprendizagem:limpeza')).toBe('true')
    expect(useApp.getState().user?.name).toBe('Visitante')
    expect(useApp.getState().nivel).toBe('medio')
  })
})

describe('Aprendizagem: outras abas', () => {
  it('marca de reset de outra aba invalida sessões; listener removível', () => {
    cap.definirServicoAprendizagem(criarServicoAprendizagem())
    const parar = cap.iniciarCaptura()
    const sessao = {
      subject: 'matematica',
      topic: 0,
      questions: [],
      i: 0,
      chosen: [],
      results: [],
      finished: false,
    }
    useApp.setState({ quiz: sessao })
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'estudae:aprendizagem:limpeza',
        newValue: 'true',
      }),
    )
    expect(useApp.getState().quiz).toBeNull()
    parar()
    useApp.setState({ quiz: sessao })
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'estudae:aprendizagem:limpeza',
        newValue: 'true',
      }),
    )
    expect(useApp.getState().quiz).toBe(sessao)
  })
})

describe('Aprendizagem: reset no Perfil', () => {
  it('resposta atrasada não altera uma nova lição do mesmo tema após reset', async () => {
    const svc = servicoAtivo()
    cap.definirServicoAprendizagem(svc)
    let liberar!: (r: Response) => void
    const post = new Promise<Response>((resolve) => {
      liberar = resolve
    })
    const normal = mockFetch()
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
        init?.method === 'POST' ? post : normal(input, init),
      ),
    )
    abrir('/quiz/matematica/0')
    fireEvent.click(await screen.findByRole('radio', { name: /certa/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Conferir' }))
    await waitFor(() =>
      expect(useApp.getState().quiz?.pendente?.some(Boolean)).toBe(true),
    )
    const antiga = useApp.getState().quiz!
    await cap.resetAprendizagem()
    const nova = {
      ...antiga,
      questions: antiga.questions!.slice(),
      results: [],
      pendente: [],
      captura: await cap.novaSessaoCaptura('licao'),
    }
    useApp.getState().setQuiz(nova)
    liberar(
      json({
        acertou: true,
        respostaCorreta: 'certa',
        resolucao: 'atrasada',
        codigo: 'Q1',
        revisaoConteudo: 'r1',
      }),
    )
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(useApp.getState().quiz?.results).toEqual([])
    expect(useApp.getState().results).toEqual([])
  })

  it('falha de remoção legada não anuncia reset concluído', async () => {
    cap.definirServicoAprendizagem(servicoAtivo())
    const remove = vi
      .spyOn(Storage.prototype, 'removeItem')
      .mockImplementation(() => {
        throw new Error('blocked')
      })
    expect(await cap.resetAprendizagem()).toBe(false)
    expect(localStorage.getItem('estudae:aprendizagem:limpeza')).toBe('true')
    remove.mockRestore()
  })
  it('confirmação apaga progresso e motor, preservando usuário/prova/a11y', async () => {
    const svc = servicoAtivo()
    cap.definirServicoAprendizagem(svc)
    vi.stubGlobal('fetch', mockFetch())
    reset({
      results: [
        {
          v: 3,
          subject: 'matematica',
          topic: 0,
          date: Date.now(),
          correct: 1,
          total: 1,
          items: [],
          weakTopic: null,
        },
      ],
      watched: { 'matematica/0/0': 1 },
    })
    abrir('/perfil')
    fireEvent.click(
      await screen.findByRole('button', { name: 'Apagar progresso' }),
    )
    const sim = await screen.findByRole('button', { name: 'Apagar tudo' })
    expect(
      screen.getByRole('button', { name: 'Manter progresso' }),
    ).toHaveFocus()
    fireEvent.click(sim)
    await waitFor(() => expect(useApp.getState().results).toHaveLength(0))
    expect(useApp.getState().watched).toEqual({})
    expect(localStorage.getItem('estudae:results')).toBeNull()
    expect(localStorage.getItem('estudae:watched')).toBeNull()
    expect(useApp.getState().user?.name).toBe('Visitante')
    expect(useApp.getState().nivel).toBe('medio')
    expect(useApp.getState().a11y.font).toBe('grande')
  })

  it('sessão de geração antiga não grava depois do reset', async () => {
    const svc = servicoAtivo()
    cap.definirServicoAprendizagem(svc)
    const sess = await cap.novaSessaoCaptura('licao')
    expect(sess!.confiavel).toBe(true)
    await cap.resetAprendizagem()
    const q = cap.questaoAprendizagem(
      {
        id: 1,
        codigo: 'Q1',
        topic: 0,
        text: null,
        ask: 'P?',
        options: ['certa', 'errada'],
        prova: null,
        imagem: null,
        pedagogia: PED,
      },
      'matematica',
      'porcentagem',
    )
    expect(await cap.apresentar(sess, q, cap.tentativaId(sess, 0))).toBe(false)
    const estado = await svc.ler()
    expect(estado!.eventos).toHaveLength(0)
    const nova = await cap.novaSessaoCaptura('licao')
    expect(await cap.apresentar(nova, q, cap.tentativaId(nova, 0))).toBe(true)
  })
})
