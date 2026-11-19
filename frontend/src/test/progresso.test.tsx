/* Progresso na conta: conversões (puras) e a sincronização com a API,
   com o fetch trocado por respostas prontas (nada sai para a rede). */
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { entrarNaConta } from '../core/conta'
import {
  aulaDaChave,
  chaveDaAula,
  chaveDe,
  completar,
  deSessao,
  marcarAula,
  mesclar,
  paraSessao,
  registrarResultado,
  sincronizarProgresso,
} from '../core/progresso'
import { useApp } from '../core/store'
import type {
  CatalogSubject,
  Resultado,
  SessaoDetalheApi,
  SessaoResumoApi,
} from '../types'
import { A11Y_PADRAO, type AppState } from './helpers'

// Dois temas, para posição ≠ slug fazer diferença.
const MAT: CatalogSubject = {
  id: 'matematica',
  nivel: 'medio',
  name: 'Matemática',
  area: '2 temas',
  icon: 'percent',
  totalQuestoes: 4,
  topics: [
    {
      slug: 'porcentagem',
      title: 'Porcentagem',
      about: null,
      videos: 1,
      totalQuestoes: 2,
      habilidades: [],
      lessons: [
        { id: 11, kind: 'Aula 1', min: 5, youtubeId: 'a', habilidades: [] },
      ],
    },
    {
      slug: 'equacoes',
      title: 'Equações',
      about: null,
      videos: 2,
      totalQuestoes: 2,
      habilidades: [],
      lessons: [
        { id: 21, kind: 'Aula 2', min: 5, youtubeId: 'b', habilidades: [] },
        { id: 22, kind: 'Aula 3', min: 5, youtubeId: 'c', habilidades: [] },
      ],
    },
  ],
}
const MATERIAS = { matematica: MAT }

const DATA = Date.parse('2026-11-17T15:00:00Z')

const LICAO: Resultado = {
  v: 3,
  subject: 'matematica',
  topic: 1,
  date: DATA,
  correct: 1,
  total: 2,
  weakTopic: 1,
  items: [
    {
      id: 5,
      topic: 1,
      ask: 'P1?',
      options: ['3', '5'],
      chosen: 1,
      answer: 1,
      why: 'w',
      ok: true,
    },
    {
      id: 6,
      topic: 1,
      ask: 'P2?',
      options: ['x', 'y'],
      chosen: 0,
      answer: 1,
      why: 'w',
      ok: false,
    },
  ],
}

const SIMULADO: Resultado = {
  v: 3,
  kind: 'simulado',
  subject: 'matematica',
  date: DATA,
  correct: 0,
  total: 2,
  weakTopic: 0,
  treino: true,
  usedMs: 10 * 60_000,
  limitMs: 90 * 60_000,
  items: [
    {
      id: 1,
      topic: 0,
      ask: 'A?',
      options: ['a', 'b'],
      chosen: undefined,
      answer: 0,
      why: 'w',
      ok: false,
    },
    {
      id: 5,
      topic: 1,
      ask: 'B?',
      options: ['3', '5'],
      chosen: 0,
      answer: 1,
      why: 'w',
      ok: false,
    },
  ],
}

const RESUMO: SessaoResumoApi = {
  id: 41,
  chave: 'remota-1',
  tipo: 'simulado',
  disciplina: 'matematica',
  tema: null,
  treino: false,
  iniciadaEm: '2026-11-16T10:00:00Z',
  concluidaEm: '2026-11-16T10:30:00Z',
  tempoLimiteSeg: 5400,
  acertos: 1,
  total: 3,
  tentativas: [
    { questaoId: 1, tema: 'porcentagem', acertou: true, emBranco: false },
    { questaoId: 5, tema: 'equacoes', acertou: false, emBranco: false },
    { questaoId: 6, tema: 'equacoes', acertou: false, emBranco: true },
  ],
}

/* ---------- conversões ---------- */

describe('progresso: conversões', () => {
  it('chave da aula vai e volta entre "materia/tema/aula" e o id', () => {
    expect(aulaDaChave('matematica/1/1', MATERIAS)).toBe(22)
    expect(chaveDaAula(22, MATERIAS)).toBe('matematica/1/1')
    expect(aulaDaChave('matematica/9/0', MATERIAS)).toBeNull()
    expect(aulaDaChave('historia/0/0', MATERIAS)).toBeNull()
    expect(chaveDaAula(999, MATERIAS)).toBeNull()
  })

  it('resultado antigo sem chave ganha uma estável, pela data', () => {
    expect(chaveDe(LICAO)).toBe(`local:${DATA}`)
    expect(chaveDe({ ...LICAO, chave: 'abc' })).toBe('abc')
  })

  it('lição vira sessão com o slug do tema e o texto escolhido', () => {
    expect(paraSessao({ ...LICAO, chave: 'k1' }, MATERIAS)).toEqual({
      chave: 'k1',
      tipo: 'licao',
      disciplina: 'matematica',
      tema: 'equacoes',
      treino: false,
      iniciadaEm: '2026-11-17T15:00:00.000Z',
      concluidaEm: '2026-11-17T15:00:00.000Z',
      tempoLimiteSeg: null,
      respostas: [
        { questaoId: 5, alternativa: '5' },
        { questaoId: 6, alternativa: 'x' },
      ],
    })
  })

  it('simulado: início pelo tempo usado, em branco = null, limite em segundos', () => {
    const s = paraSessao(SIMULADO, MATERIAS)!
    expect(s.tipo).toBe('simulado')
    expect(s.tema).toBeNull()
    expect(s.treino).toBe(true)
    expect(s.iniciadaEm).toBe('2026-11-17T14:50:00.000Z')
    expect(s.tempoLimiteSeg).toBe(5400)
    expect(s.respostas).toEqual([
      { questaoId: 1, alternativa: null },
      { questaoId: 5, alternativa: '3' },
    ])
  })

  it('o que a API não aceitaria nem é enviado', () => {
    expect(paraSessao({ ...LICAO, v: 2 }, MATERIAS)).toBeNull() // quiz antigo por matéria
    expect(paraSessao({ ...LICAO, topic: 7 }, MATERIAS)).toBeNull() // tema que saiu
    expect(paraSessao({ ...LICAO, subject: 'historia' }, MATERIAS)).toBeNull()
    expect(
      paraSessao(
        { ...LICAO, items: [{ ...LICAO.items[0], id: undefined }] },
        MATERIAS,
      ),
    ).toBeNull()
    // Aba esquecida aberta por dias: o tempo é limitado a 24 h.
    const s = paraSessao({ ...SIMULADO, usedMs: 3 * 86_400_000 }, MATERIAS)!
    expect(Date.parse(s.concluidaEm) - Date.parse(s.iniciadaEm)).toBe(
      86_400_000,
    )
  })

  it('sessão da API vira Resultado com posições, incompleto até abrir', () => {
    const r = deSessao(RESUMO, MATERIAS)!
    expect(r).toMatchObject({
      v: 3,
      kind: 'simulado',
      subject: 'matematica',
      date: Date.parse('2026-11-16T10:30:00Z'),
      correct: 1,
      total: 3,
      usedMs: 30 * 60_000,
      limitMs: 5400_000,
      weakTopic: 1, // equações: 2 erros
      chave: 'remota-1',
      remoto: 41,
      incompleto: true,
    })
    expect(r.items.map((i) => [i.id, i.topic, i.ok])).toEqual([
      [1, 0, true],
      [5, 1, false],
      [6, 1, false],
    ])
  })

  it('lição da API: tema pela posição, e some se o tema não existe mais aqui', () => {
    const licao = {
      ...RESUMO,
      tipo: 'licao' as const,
      tema: 'equacoes',
      tempoLimiteSeg: null,
    }
    expect(deSessao(licao, MATERIAS)).toMatchObject({ topic: 1, weakTopic: 1 })
    expect(deSessao({ ...licao, tema: 'sumiu' }, MATERIAS)).toBeNull()
    expect(deSessao({ ...licao, disciplina: 'historia' }, MATERIAS)).toBeNull()
  })

  it('completar põe enunciado, alternativas e correção nas posições certas', () => {
    const detalhe: SessaoDetalheApi = {
      ...RESUMO,
      questoes: [
        {
          questaoId: 6,
          ordem: 1,
          tema: 'equacoes',
          textoBase: null,
          enunciado: 'Quanto é x?',
          alternativas: ['3', '5', '15'],
          imagem: null,
          escolhida: null,
          respostaCorreta: '5',
          resolucao: 'Porque sim.',
          acertou: false,
        },
      ],
    }
    const r = completar(deSessao(RESUMO, MATERIAS)!, detalhe, MATERIAS)
    expect(r.incompleto).toBe(false)
    expect(r.items).toEqual([
      {
        id: 6,
        topic: 1,
        ask: 'Quanto é x?',
        options: ['3', '5', '15'],
        chosen: undefined,
        answer: 1,
        why: 'Você não respondeu esta questão. Porque sim.',
        ok: false,
      },
    ])
  })

  it('mesclar: nada some, o da conta entra em ordem de data e as aulas se juntam', () => {
    const local1 = { ...LICAO, chave: 'na-conta' }
    const local2 = { ...LICAO, date: DATA + 1000 } // só no aparelho, sem chave
    const recusada = { ...LICAO, chave: 'ruim', date: DATA + 2000 }
    const obsoleto = { ...LICAO, chave: 'sumiu', remoto: 5, date: DATA + 3000 }
    const { results, watched } = mesclar(
      [local1, local2, recusada, obsoleto],
      { 'matematica/0/0': 123 },
      {
        sessoes: [{ ...RESUMO, id: 7, chave: 'na-conta' }, RESUMO],
        aulas: [
          { videoaulaId: 11, assistidaEm: '2026-11-01T00:00:00Z' }, // já marcada aqui
          { videoaulaId: 22, assistidaEm: '2026-11-02T00:00:00Z' },
          { videoaulaId: 999, assistidaEm: '2026-11-02T00:00:00Z' }, // fora do catálogo
        ],
      },
      new Set(['ruim']),
      MATERIAS,
    )
    expect(results.map((r) => [chaveDe(r), r.remoto, r.semSync])).toEqual([
      ['remota-1', 41, undefined], // 16/11, veio da conta
      ['na-conta', 7, undefined],
      [`local:${DATA + 1000}`, undefined, undefined], // sobe na próxima vez
      ['ruim', undefined, true],
      ['sumiu', undefined, undefined], // remoto obsoleto: volta a pendente
    ])
    expect(watched).toEqual({
      'matematica/0/0': 123,
      'matematica/1/1': Date.parse('2026-11-02T00:00:00Z'),
    })
  })
})

/* ---------- com a API ---------- */

type Resposta = { status: number; corpo?: unknown }
type Rotas = Record<string, Resposta | ((init?: RequestInit) => Resposta)>

function fetchFalso(rotas: Rotas) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    const chave = `${init?.method ?? 'GET'} ${String(url).replace(/^\/api/, '')}`
    const r = rotas[chave]
    const { status, corpo } =
      typeof r === 'function' ? r(init) : (r ?? { status: 401 })
    return new Response(corpo === undefined ? null : JSON.stringify(corpo), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  })
}

const chamadas = (f: ReturnType<typeof fetchFalso>, chave: string) =>
  f.mock.calls.filter(
    ([url, init]) => `${init?.method ?? 'GET'} ${String(url)}` === chave,
  )

const corpoDe = (f: ReturnType<typeof fetchFalso>, chave: string, n = 0) =>
  JSON.parse(String(chamadas(f, chave)[n][1]?.body))

const MARIA = { name: 'Maria', email: 'maria@gmail.com' }
const VAZIO = { sessoes: [], aulas: [] }
const IMPORTOU = {
  sessoesNovas: 0,
  sessoesRepetidas: 0,
  sessoesIgnoradas: [],
  aulasNovas: 0,
  aulasIgnoradas: 0,
}

function reset(patch: Partial<AppState> = {}) {
  localStorage.clear()
  useApp.setState({
    user: MARIA,
    nivel: 'medio',
    a11y: { ...A11Y_PADRAO },
    results: [],
    watched: {},
    quiz: null,
    simulado: null,
    subjects: MATERIAS,
    catalogoStatus: 'ready',
    cadastroAberto: true,
    ...patch,
  })
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
beforeEach(() => reset())

describe('progresso: sincronização', () => {
  it('visitante não fala com a API de progresso', async () => {
    reset({ user: { name: 'Visitante', guest: true }, results: [LICAO] })
    const f = fetchFalso({})
    await sincronizarProgresso()
    registrarResultado(LICAO)
    marcarAula('matematica/0/0')
    expect(f).not.toHaveBeenCalled()
    expect(useApp.getState().watched['matematica/0/0']).toBeDefined()
  })

  it('primeiro login no aparelho: sobe o progresso de visitante e marca como da conta', async () => {
    reset({
      results: [LICAO, { ...LICAO, v: 2, date: DATA - 5000 }],
      watched: { 'matematica/1/0': DATA },
    })
    let listou = 0
    const f = fetchFalso({
      'GET /progresso': () => ({
        status: 200,
        corpo:
          listou++ === 0
            ? VAZIO
            : {
                sessoes: [
                  {
                    ...RESUMO,
                    id: 9,
                    chave: `local:${DATA}`,
                    tipo: 'licao',
                    tema: 'equacoes',
                  },
                ],
                aulas: [
                  {
                    videoaulaId: 21,
                    assistidaEm: new Date(DATA).toISOString(),
                  },
                ],
              },
      }),
      'POST /progresso/importar': {
        status: 200,
        corpo: { ...IMPORTOU, sessoesNovas: 1, aulasNovas: 1 },
      },
    })

    await sincronizarProgresso()

    const corpo = corpoDe(f, 'POST /api/progresso/importar')
    expect(corpo.sessoes).toHaveLength(1) // o quiz antigo (v: 2) não tem como ir
    expect(corpo.sessoes[0]).toMatchObject({
      chave: `local:${DATA}`,
      tema: 'equacoes',
    })
    expect(corpo.aulas).toEqual([
      { videoaulaId: 21, assistidaEm: new Date(DATA).toISOString() },
    ])

    const results = useApp.getState().results
    expect(results).toHaveLength(2)
    expect(results.find((r) => r.v === 3)).toMatchObject({
      remoto: 9,
      chave: `local:${DATA}`,
    })
    expect(results.find((r) => r.v === 2)?.semSync).toBe(true)
    // Já está na conta: a próxima sincronização não reenvia.
    await sincronizarProgresso()
    expect(chamadas(f, 'POST /api/progresso/importar')).toHaveLength(1)
  })

  it('outro aparelho: traz as sessões e as aulas da conta', async () => {
    fetchFalso({
      'GET /progresso': {
        status: 200,
        corpo: {
          sessoes: [RESUMO],
          aulas: [{ videoaulaId: 22, assistidaEm: '2026-11-16T10:00:00Z' }],
        },
      },
    })
    await sincronizarProgresso()
    const { results, watched } = useApp.getState()
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      remoto: 41,
      incompleto: true,
      correct: 1,
    })
    expect(watched['matematica/1/1']).toBe(Date.parse('2026-11-16T10:00:00Z'))
  })

  it('sessão recusada pela API não é reenviada', async () => {
    reset({ results: [{ ...LICAO, chave: 'ruim' }] })
    const f = fetchFalso({
      'GET /progresso': { status: 200, corpo: VAZIO },
      'POST /progresso/importar': {
        status: 200,
        corpo: {
          ...IMPORTOU,
          sessoesIgnoradas: [
            { posicao: 0, chave: 'ruim', erro: 'Questão 5 não encontrada.' },
          ],
        },
      },
    })
    await sincronizarProgresso()
    expect(useApp.getState().results[0].semSync).toBe(true)
    await sincronizarProgresso()
    expect(chamadas(f, 'POST /api/progresso/importar')).toHaveLength(1)
  })

  it('conta perdeu a sessão: o remoto obsoleto sobe de novo', async () => {
    reset({
      results: [{ ...LICAO, chave: 'sumiu-da-conta', remoto: 5 }],
    })
    let listou = 0
    const f = fetchFalso({
      'GET /progresso': () => ({
        status: 200,
        corpo:
          listou++ === 0
            ? VAZIO // a conta não tem mais a sessão
            : {
                sessoes: [
                  {
                    ...RESUMO,
                    id: 9,
                    chave: 'sumiu-da-conta',
                    tipo: 'licao',
                    tema: 'equacoes',
                  },
                ],
                aulas: [],
              },
      }),
      'POST /progresso/importar': {
        status: 200,
        corpo: { ...IMPORTOU, sessoesNovas: 1 },
      },
    })

    await sincronizarProgresso()

    const corpo = corpoDe(f, 'POST /api/progresso/importar')
    expect(corpo.sessoes).toHaveLength(1)
    expect(corpo.sessoes[0].chave).toBe('sumiu-da-conta')
    expect(useApp.getState().results[0].remoto).toBe(9)
  })

  it('resumo da conta sem sessão no servidor não é reenviado (sem os dados)', async () => {
    reset({
      results: [{ ...LICAO, chave: 'era-remota', remoto: 5, incompleto: true }],
    })
    const f = fetchFalso({
      'GET /progresso': { status: 200, corpo: VAZIO },
      'POST /progresso/importar': { status: 200, corpo: IMPORTOU },
    })

    await sincronizarProgresso()

    expect(chamadas(f, 'POST /api/progresso/importar')).toHaveLength(0)
    expect(useApp.getState().results[0].remoto).toBeUndefined()
  })

  it('sem rede não mexe em nada', async () => {
    reset({ results: [LICAO] })
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'))
    await sincronizarProgresso()
    expect(useApp.getState().results).toEqual([LICAO])
  })

  it('saiu da conta enquanto a resposta vinha: não junta nada', async () => {
    let soltar: (r: Response) => void = () => {}
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () => new Promise<Response>((ok) => (soltar = ok)),
    )
    const sync = sincronizarProgresso()
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled())
    useApp.getState().setUser(null)
    soltar(
      new Response(JSON.stringify({ sessoes: [RESUMO], aulas: [] }), {
        status: 200,
      }),
    )
    await sync
    expect(useApp.getState().results).toEqual([])
  })

  it('entrar na conta dispara a sincronização', async () => {
    reset({ user: null })
    const f = fetchFalso({ 'GET /progresso': { status: 200, corpo: VAZIO } })
    entrarNaConta({ nome: 'Maria', email: 'maria@gmail.com' })
    await waitFor(() =>
      expect(chamadas(f, 'GET /api/progresso')).toHaveLength(1),
    )
  })

  it('lição terminada com conta vai para a API e ganha o id', async () => {
    const f = fetchFalso({
      'POST /progresso/sessoes': (init) => ({
        status: 201,
        corpo: {
          ...RESUMO,
          id: 77,
          chave: JSON.parse(String(init?.body)).chave,
        },
      }),
    })
    const chave = registrarResultado(LICAO)
    expect(chave).toMatch(/^[A-Za-z0-9_.:-]{1,64}$/)
    expect(corpoDe(f, 'POST /api/progresso/sessoes')).toMatchObject({
      chave,
      tipo: 'licao',
    })
    await waitFor(() => expect(useApp.getState().results[0].remoto).toBe(77))
  })

  it('lição terminada sem rede fica no aparelho, pronta para subir depois', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'))
    registrarResultado(LICAO)
    await new Promise((r) => setTimeout(r, 0))
    const [r] = useApp.getState().results
    expect(r.remoto).toBeUndefined()
    expect(r.semSync).toBeUndefined()
  })

  it('aula vista com conta vai para a API pelo id da vídeo-aula', async () => {
    const f = fetchFalso({ 'PUT /progresso/aulas/22': { status: 204 } })
    marcarAula('matematica/1/1')
    expect(chamadas(f, 'PUT /api/progresso/aulas/22')).toHaveLength(1)
    // Já vista: não chama de novo.
    marcarAula('matematica/1/1')
    expect(chamadas(f, 'PUT /api/progresso/aulas/22')).toHaveLength(1)
  })
})

describe('Resultado: sessão de outro aparelho', () => {
  const abrir = (rota: string) => {
    window.history.pushState({}, '', rota)
    return render(<App />)
  }

  it('abre pela chave e carrega a correção da API', async () => {
    reset({ results: [deSessao(RESUMO, MATERIAS)!] })
    fetchFalso({
      'GET /conta/eu': {
        status: 200,
        corpo: { nome: 'Maria', email: 'maria@gmail.com' },
      },
      'GET /progresso': {
        status: 200,
        corpo: { sessoes: [RESUMO], aulas: [] },
      },
      'GET /progresso/sessoes/41': {
        status: 200,
        corpo: {
          ...RESUMO,
          questoes: [
            {
              questaoId: 1,
              ordem: 1,
              tema: 'porcentagem',
              textoBase: null,
              enunciado: 'Quanto é 20% de 150?',
              alternativas: ['30', '120'],
              imagem: null,
              escolhida: '30',
              respostaCorreta: '30',
              resolucao: 'Conta simples.',
              acertou: true,
            },
          ],
        },
      },
    })
    abrir('/resultado/remota-1')
    expect(
      await screen.findByRole('heading', { name: 'Simulado concluído' }),
    ).toBeInTheDocument()
    expect(await screen.findByText(/Quanto é 20% de 150\?/)).toBeInTheDocument()
    expect(useApp.getState().results[0].incompleto).toBe(false)
  })

  it('sem rede: avisa que a correção não carregou', async () => {
    reset({ results: [deSessao(RESUMO, MATERIAS)!] })
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'))
    abrir('/resultado/remota-1')
    expect(
      await screen.findByText(/Não foi possível carregar a correção/),
    ).toBeInTheDocument()
  })

  it('link antigo por posição continua abrindo', async () => {
    reset({ user: { name: 'Visitante', guest: true }, results: [LICAO] })
    abrir('/resultado/0')
    expect(
      await screen.findByRole('heading', { name: 'Atividade concluída' }),
    ).toBeInTheDocument()
  })
})
