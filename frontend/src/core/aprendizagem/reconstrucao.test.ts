/* Reconstrução das evidências do histórico: o que a conta trouxe vira
   sessão "conta:<chave>" no estado mesclado — e precisa passar pelo
   extrator estrito como qualquer registro real. */
import { describe, expect, it } from 'vitest'
import { extrairEvidencias } from './evidencias'
import {
  evidenciasDaConta,
  sintetizarSessao,
  type QuestaoMapeada,
} from './reconstrucao'
import type { EstadoAprendizagem, MatrizTema } from './tipos'
import type { CatalogSubject, Resultado, SessaoDetalheApi } from '../../types'

const DATA = Date.parse('2026-11-18T15:00:00')

const estadoBase = (): EstadoAprendizagem => ({
  controle: {
    id: 'principal',
    geracao: 0,
    resetPendente: false,
    esquema: 1,
    localLearnerId: 'aluno',
    revisao: 0,
    ultimaSequencia: 0,
  },
  eventos: [],
  conclusoes: [],
})

const ped = (habilidade: string, familia: string) => ({
  habilidade,
  secundarias: [],
  familia,
  dificuldade: null,
  revisao: 'aprovada' as const,
  elegivel: true,
  versao: 1,
})

const matriz = (
  codigos: { codigo: string; habilidade?: string; familia?: string }[],
): MatrizTema => ({
  disciplina: 'matematica',
  tema: 'equacoes',
  validada: true,
  habilidades: [{ slug: 'resolver-equacao', essencial: true }],
  questoes: codigos.map((c) => ({
    codigo: c.codigo,
    disciplina: 'matematica',
    tema: 'equacoes',
    revisaoApi: 'conteudo-v1',
    pedagogia: ped(c.habilidade ?? 'resolver-equacao', c.familia ?? 'fam'),
  })),
})

const licao = (itens: Partial<Resultado['items'][number]>[]): Resultado => ({
  v: 3,
  subject: 'matematica',
  topic: 0,
  date: DATA,
  correct: itens.filter((i) => i.ok).length,
  total: itens.length,
  items: itens.map((i) => ({
    id: 1,
    ask: 'Quanto é x?',
    options: ['1', '2'],
    chosen: 0,
    answer: 0,
    why: 'porque',
    ok: true,
    ...i,
  })),
  weakTopic: null,
  chave: 'sessao-1',
})

const mapeada = (codigo: string, familia = 'fam'): QuestaoMapeada => ({
  codigo,
  pedagogia: ped('resolver-equacao', familia),
  revisaoApi: 'conteudo-v1',
})

describe('reconstrução: síntese da sessão', () => {
  it('o par submissão+correção sintetizado passa pelo extrator estrito', () => {
    const m = matriz([{ codigo: 'q1' }, { codigo: 'q2', familia: 'f2' }])
    const r = licao([{ ok: true }, { ok: false }])
    const { eventos, conclusao } = sintetizarSessao(
      r,
      'matematica',
      [
        { tema: 'equacoes', q: mapeada('q1'), ok: true, respondeu: true },
        {
          tema: 'equacoes',
          q: mapeada('q2', 'f2'),
          ok: false,
          respondeu: true,
        },
      ],
      0,
    )
    const estado = estadoBase()
    estado.eventos = eventos
    estado.conclusoes = [conclusao]

    const ev = extrairEvidencias(estado, m)
    expect(ev.map((e) => [e.codigo, e.acertou])).toEqual([
      ['q1', true],
      ['q2', false],
    ])
    expect(ev[0]).toMatchObject({
      sessaoId: 'conta:sessao-1',
      habilidade: 'resolver-equacao',
    })
  })

  it('questão não respondida não vira evidência', () => {
    const m = matriz([{ codigo: 'q1' }])
    const r = licao([{ ok: false }])
    const { eventos, conclusao } = sintetizarSessao(
      r,
      'matematica',
      [{ tema: 'equacoes', q: mapeada('q1'), ok: false, respondeu: false }],
      0,
    )
    const estado = estadoBase()
    estado.eventos = eventos
    estado.conclusoes = [conclusao]
    expect(extrairEvidencias(estado, m)).toHaveLength(0)
  })
})

describe('reconstrução: evidências da conta', () => {
  const subjects: Record<string, CatalogSubject> = {
    matematica: {
      id: 'matematica',
      nivel: 'medio',
      name: 'Matemática',
      area: '8 temas',
      icon: 'percent',
      totalQuestoes: 5,
      topics: [
        {
          slug: 'equacoes',
          title: 'Equações',
          about: null,
          videos: 0,
          totalQuestoes: 5,
          lessons: [],
          habilidades: [
            {
              slug: 'resolver-equacao',
              titulo: 'Resolver equação',
              essencial: true,
            },
          ],
        },
      ],
    },
  }
  const resolver = async () => new Map([['Quanto é x?', mapeada('q1')]])
  const semResolver = async () => new Map<string, QuestaoMapeada>()

  it('resultado completo ancora pelo enunciado e vira sessão reconstruída', async () => {
    const { eventos, conclusoes } = await evidenciasDaConta(
      [licao([{ ok: true }])],
      subjects,
      0,
      resolver,
    )
    expect(eventos).toHaveLength(2) // submissão + correção
    expect(conclusoes).toHaveLength(1)
    expect(eventos[0]).toMatchObject({
      sessaoId: 'conta:sessao-1',
      codigo: 'q1',
      tema: 'equacoes',
      modalidade: 'licao',
    })
  })

  it('resumo da conta usa a correção (detalhe) para ancorar', async () => {
    const remoto: Resultado = {
      ...licao([]),
      items: [
        {
          id: 9,
          topic: 0,
          ask: '',
          options: [],
          chosen: undefined,
          answer: -1,
          why: '',
          ok: true,
        },
      ],
      incompleto: true,
      remoto: 42,
    }
    const detalhe: SessaoDetalheApi = {
      id: 42,
      chave: 'sessao-1',
      tipo: 'licao',
      disciplina: 'matematica',
      tema: 'equacoes',
      treino: false,
      iniciadaEm: new Date(DATA).toISOString(),
      concluidaEm: new Date(DATA).toISOString(),
      tempoLimiteSeg: null,
      acertos: 1,
      total: 1,
      questoes: [
        {
          questaoId: 9,
          ordem: 0,
          tema: 'equacoes',
          textoBase: null,
          enunciado: 'Quanto é x?',
          alternativas: ['1', '2'],
          imagem: null,
          escolhida: '1',
          respostaCorreta: '1',
          resolucao: '',
          acertou: true,
        },
      ],
    }
    const { eventos } = await evidenciasDaConta(
      [remoto],
      subjects,
      0,
      resolver,
      async () => detalhe,
    )
    expect(eventos).toHaveLength(2)
    expect(eventos[0]!.codigo).toBe('q1')
  })

  it('enunciado fora do catálogo e incompleto sem remoto ficam de fora', async () => {
    const { eventos } = await evidenciasDaConta(
      [licao([{ ok: true }]), { ...licao([]), incompleto: true }],
      subjects,
      0,
      semResolver,
      async () => null,
    )
    expect(eventos).toHaveLength(0)
  })

  it('simulado vira sessão de modalidade simulado com conclusão', async () => {
    const sim: Resultado = {
      ...licao([{ ok: true }]),
      kind: 'simulado',
      items: [
        {
          id: 1,
          topic: 0,
          ask: 'Quanto é x?',
          options: ['1', '2'],
          chosen: 0,
          answer: 0,
          why: '',
          ok: true,
        },
      ],
    }
    const { eventos, conclusoes } = await evidenciasDaConta(
      [sim],
      subjects,
      0,
      resolver,
    )
    expect(eventos[0]!.modalidade).toBe('simulado')
    expect(conclusoes[0]!.eventoIds).toContain(eventos[0]!.id)
    expect(conclusoes[0]!.eventoIds).toContain(eventos[1]!.id)
  })
})
