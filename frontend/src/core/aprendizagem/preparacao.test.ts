import { describe, expect, it } from 'vitest'
import { avaliarPreparacao } from './preparacao'
import { PARAMETROS_DOMINIO } from './config'
import type {
  EstadoAprendizagem,
  MatrizTema,
  QuestaoAprendizagem,
} from './tipos'

const dia = 24 * 60 * 60 * 1000

function estado(): EstadoAprendizagem {
  return {
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
  }
}

function matriz(tema: string, essenciais = ['h'], validada = true): MatrizTema {
  return {
    disciplina: 'matematica',
    tema,
    validada,
    habilidades: essenciais.map((slug) => ({ slug, essencial: true })),
    questoes: [],
  }
}

let seq = 0
function sessao(
  e: EstadoAprendizagem,
  m: MatrizTema,
  habilidade: string,
  acertos: number,
  instante: number,
): void {
  seq++
  const sessaoId = `sess${seq}`
  const ids: string[] = []
  for (let k = 0; k < acertos; k++) {
    seq++
    const questao: QuestaoAprendizagem = {
      codigo: `q${seq}`,
      disciplina: m.disciplina,
      tema: m.tema,
      pedagogia: {
        habilidade,
        secundarias: [],
        familia: `f${seq}`,
        revisao: 'aprovada',
        elegivel: true,
        versao: 1,
      },
    }
    m.questoes.push(questao)
    const base = {
      geracao: 0,
      sessaoId,
      modalidade: 'licao' as const,
      codigo: questao.codigo,
      disciplina: m.disciplina,
      tema: m.tema,
      tentativaId: `t${seq}`,
      confiavel: true,
      metadados: { ...questao.pedagogia! },
      dataLocal: new Date(instante + k).toISOString().slice(0, 10),
    }
    const sub = {
      ...base,
      id: `s${seq}`,
      tipo: 'submissao' as const,
      instante: instante + k,
      respondeu: true,
      respostaTexto: 'x',
      revisaoApi: 'rev',
      sequencia: seq * 2 - 1,
    }
    const cor = {
      ...base,
      id: `c${seq}`,
      tipo: 'correcao' as const,
      instante: instante + k + 0.5,
      acertou: true,
      revisaoApi: 'rev',
      sequencia: seq * 2,
    }
    e.eventos.push(sub, cor)
    ids.push(sub.id, cor.id)
  }
  e.conclusoes.push({
    id: sessaoId,
    sessaoId,
    geracao: 0,
    instante: instante + acertos + 1,
    eventoIds: ids,
  })
}

function confirmado(e: EstadoAprendizagem, m: MatrizTema, h = 'h'): void {
  for (let i = 0; i < PARAMETROS_DOMINIO.boaMin; i++)
    sessao(e, m, h, 1, i * 1000 + 1)
  sessao(e, m, h, PARAMETROS_DOMINIO.confirmacaoMin, 3 * dia)
}

describe('avaliarPreparacao', () => {
  it('rejeita parâmetros inválidos', () => {
    expect(() =>
      avaliarPreparacao(estado(), [], { minTemas: 0, temasConfirmados: 1 }),
    ).toThrow('Parâmetros')
    expect(() =>
      avaliarPreparacao(estado(), [], { minTemas: 2, temasConfirmados: 3 }),
    ).toThrow('Parâmetros')
  })

  it('sem temas avaliáveis suficientes fica sem-dados', () => {
    const e = estado()
    const ms = [matriz('a'), matriz('b')]
    const r = avaliarPreparacao(e, ms)
    expect(r.estado).toBe('sem-dados')
    expect(r.temasAvaliados).toBe(2)
  })

  it('ignora matriz não validada ou sem essenciais', () => {
    const e = estado()
    const ms = [
      matriz('a', ['h'], false),
      matriz('b', []),
      matriz('c'),
      matriz('d'),
      matriz('e'),
    ]
    const r = avaliarPreparacao(e, ms)
    expect(r.temasAvaliados).toBe(3)
    expect(r.detalhes.map((d) => d.tema)).toEqual(['c', 'd', 'e'])
  })

  it('em-progresso quando temas existem mas não confirmam', () => {
    const e = estado()
    const ms = [matriz('a'), matriz('b'), matriz('c')]
    for (let i = 0; i < PARAMETROS_DOMINIO.boaMin; i++)
      sessao(e, ms[0], 'h', 1, i * 1000 + 1)
    const r = avaliarPreparacao(e, ms)
    expect(r.estado).toBe('em-progresso')
    expect(r.detalhes.map((d) => d.estado)).toEqual([
      'bom-desempenho',
      'insuficiente',
      'insuficiente',
    ])
  })

  it('boa-preparacao exige todos em bom desempenho e confirmados mínimos', () => {
    const e = estado()
    const ms = [matriz('a'), matriz('b'), matriz('c')]
    confirmado(e, ms[0])
    confirmado(e, ms[1])
    for (let i = 0; i < PARAMETROS_DOMINIO.boaMin; i++)
      sessao(e, ms[2], 'h', 1, i * 1000 + 1)
    const r = avaliarPreparacao(e, ms)
    expect(r).toMatchObject({
      estado: 'boa-preparacao',
      temasAvaliados: 3,
      confirmados: 2,
      bomDesempenho: 3,
    })
  })

  it('todos bons mas confirmados insuficientes fica em-progresso', () => {
    const e = estado()
    const ms = [matriz('a'), matriz('b'), matriz('c')]
    confirmado(e, ms[0])
    for (let i = 0; i < PARAMETROS_DOMINIO.boaMin; i++)
      sessao(e, ms[1], 'h', 1, i * 1000 + 1)
    for (let i = 0; i < PARAMETROS_DOMINIO.boaMin; i++)
      sessao(e, ms[2], 'h', 1, i * 1000 + 1)
    const r = avaliarPreparacao(e, ms)
    expect(r.estado).toBe('em-progresso')
    expect(r.confirmados).toBe(1)
    expect(r.bomDesempenho).toBe(3)
  })
})
