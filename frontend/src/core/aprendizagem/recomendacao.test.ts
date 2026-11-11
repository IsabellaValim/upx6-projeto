import { describe, expect, it } from 'vitest'
import { recomendar, situacaoHabilidade } from './recomendacao'
import { PARAMETROS_DOMINIO, PARAMETROS_RECOMENDACAO } from './config'
import type {
  EstadoAprendizagem,
  MatrizTema,
  QuestaoAprendizagem,
} from './tipos'

const hora = 60 * 60 * 1000
const agora = 1_000 * hora

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

function matriz(
  tema: string,
  habilidades: { slug: string; essencial: boolean }[],
  validada = true,
  disciplina = 'matematica',
): MatrizTema {
  return { disciplina, tema, validada, habilidades, questoes: [] }
}

let seq = 0
function evidencia(
  e: EstadoAprendizagem,
  m: MatrizTema,
  habilidade: string,
  acertou: boolean,
  instante: number,
): void {
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
    sessaoId: `s${seq}`,
    modalidade: 'licao' as const,
    codigo: questao.codigo,
    disciplina: m.disciplina,
    tema: m.tema,
    tentativaId: `t${seq}`,
    confiavel: true,
    metadados: { ...questao.pedagogia! },
    dataLocal: new Date(instante).toISOString().slice(0, 10),
  }
  e.eventos.push(
    {
      ...base,
      id: `s${seq}`,
      tipo: 'submissao',
      instante,
      respondeu: true,
      respostaTexto: 'alternativa',
      revisaoApi: 'rev',
      sequencia: seq * 2 - 1,
    },
    {
      ...base,
      id: `c${seq}`,
      tipo: 'correcao',
      instante: instante + 1,
      acertou,
      revisaoApi: 'rev',
      sequencia: seq * 2,
    },
  )
}

describe('situacaoHabilidade', () => {
  it('classifica sem evidência e em prática', () => {
    expect(
      situacaoHabilidade(
        [],
        'h',
        agora,
        PARAMETROS_RECOMENDACAO,
        PARAMETROS_DOMINIO,
      ),
    ).toBe('sem-evidencia')
    expect(
      situacaoHabilidade(
        [
          {
            habilidade: 'h',
            acertou: true,
            instante: agora - 10 * hora,
          } as never,
        ],
        'h',
        agora,
        PARAMETROS_RECOMENDACAO,
        PARAMETROS_DOMINIO,
      ),
    ).toBe('em-pratica')
  })
})

describe('recomendar', () => {
  it('rejeita parâmetros e instante inválidos', () => {
    const e = estado()
    const m = matriz('tema', [{ slug: 'h', essencial: true }])
    expect(() => recomendar(e, [m], agora, { revisaoHoras: 0 })).toThrow(
      'Parâmetros',
    )
    expect(() =>
      recomendar(e, [m], agora, { revisaoHoras: Number.NaN }),
    ).toThrow('Parâmetros')
    expect(() => recomendar(e, [m], -1)).toThrow('Instante')
    expect(() => recomendar(e, [m], Number.NaN)).toThrow('Instante')
  })

  it('ignora matriz não validada ou sem essenciais', () => {
    const e = estado()
    const m1 = matriz('a', [{ slug: 'h', essencial: true }], false)
    const m2 = matriz('b', [{ slug: 'h', essencial: false }])
    expect(recomendar(e, [m1, m2], agora)).toEqual({
      recomendacao: null,
      candidatos: [],
    })
  })

  it('sem evidência recomenda a primeira habilidade essencial nova', () => {
    const e = estado()
    const m = matriz('tema', [
      { slug: 'a', essencial: true },
      { slug: 'b', essencial: true },
    ])
    expect(recomendar(e, [m], agora)).toEqual({
      recomendacao: {
        disciplina: 'matematica',
        tema: 'tema',
        motivo: 'nova-habilidade',
        habilidade: 'a',
        revisarEm: null,
      },
      candidatos: [
        {
          disciplina: 'matematica',
          tema: 'tema',
          motivo: 'nova-habilidade',
          habilidade: 'a',
          revisarEm: null,
        },
      ],
    })
  })

  it('dificuldade recorrente em essencial vence todas as prioridades', () => {
    const e = estado()
    const dif = matriz('dif', [{ slug: 'h', essencial: true }])
    const nova = matriz('novo', [{ slug: 'x', essencial: true }])
    for (let i = 0; i < PARAMETROS_DOMINIO.erroRecorrente; i++)
      evidencia(e, dif, 'h', false, (i + 1) * hora)
    const r = recomendar(e, [nova, dif], agora)
    expect(r.recomendacao).toMatchObject({
      tema: 'dif',
      motivo: 'dificuldade',
      habilidade: 'h',
    })
    expect(r.candidatos.map((c) => c.tema)).toEqual(['dif', 'novo'])
  })

  it('erro isolado não vira dificuldade', () => {
    const e = estado()
    const m = matriz('tema', [{ slug: 'h', essencial: true }])
    evidencia(e, m, 'h', false, 1000)
    expect(recomendar(e, [m], agora).recomendacao?.motivo).toBe('continuar')
  })

  it('recorrência resolvida não gera dificuldade nem candidato', () => {
    const e = estado()
    const m = matriz('tema', [{ slug: 'h', essencial: true }])
    evidencia(e, m, 'h', false, agora - 10 * hora)
    evidencia(e, m, 'h', false, agora - 9 * hora)
    for (let i = 0; i < PARAMETROS_DOMINIO.skillCorrect; i++)
      evidencia(
        e,
        m,
        'h',
        true,
        agora - (PARAMETROS_DOMINIO.skillCorrect - i) * hora,
      )
    expect(recomendar(e, [m], agora)).toEqual({
      recomendacao: null,
      candidatos: [],
    })
  })

  it('revisão vencida aponta habilidade e instante', () => {
    const e = estado()
    const m = matriz('tema', [{ slug: 'h', essencial: true }])
    const ultima = agora - PARAMETROS_RECOMENDACAO.revisaoHoras * hora - hora
    for (let i = 0; i < PARAMETROS_DOMINIO.skillCorrect; i++)
      evidencia(
        e,
        m,
        'h',
        true,
        ultima - (PARAMETROS_DOMINIO.skillCorrect - 1 - i) * hora,
      )
    const r = recomendar(e, [m], agora).recomendacao
    expect(r).toMatchObject({
      motivo: 'revisao',
      habilidade: 'h',
      revisarEm: ultima + PARAMETROS_RECOMENDACAO.revisaoHoras * hora,
    })
  })

  it('boa recente e nada vencido não recomenda nada', () => {
    const e = estado()
    const m = matriz('tema', [{ slug: 'h', essencial: true }])
    for (let i = 0; i < PARAMETROS_DOMINIO.skillCorrect; i++)
      evidencia(e, m, 'h', true, agora - (i + 1) * hora)
    expect(recomendar(e, [m], agora)).toEqual({
      recomendacao: null,
      candidatos: [],
    })
  })

  it('dificuldade só conta para essenciais; revisão aceita secundárias', () => {
    const e = estado()
    const m = matriz('tema', [
      { slug: 'ess', essencial: true },
      { slug: 'sec', essencial: false },
    ])
    for (let i = 0; i < PARAMETROS_DOMINIO.erroRecorrente; i++)
      evidencia(e, m, 'sec', false, (i + 1) * hora)
    expect(recomendar(e, [m], agora).recomendacao?.motivo).toBe(
      'nova-habilidade',
    )
    for (let i = 0; i < PARAMETROS_DOMINIO.skillCorrect; i++)
      evidencia(e, m, 'sec', true, agora - 200 * hora + i * hora)
    for (let i = 0; i < PARAMETROS_DOMINIO.skillCorrect; i++)
      evidencia(e, m, 'ess', true, agora - i * hora - hora)
    const r = recomendar(e, [m], agora).recomendacao
    expect(r).toMatchObject({ motivo: 'revisao', habilidade: 'sec' })
  })

  it('ordena revisões por essencialidade e vencimento', () => {
    const e = estado()
    const a = matriz('a', [{ slug: 'h', essencial: true }])
    const b = matriz('b', [{ slug: 'h', essencial: true }])
    for (let i = 0; i < PARAMETROS_DOMINIO.skillCorrect; i++)
      evidencia(e, a, 'h', true, agora - 100 * hora + i)
    for (let i = 0; i < PARAMETROS_DOMINIO.skillCorrect; i++)
      evidencia(e, b, 'h', true, agora - 200 * hora + i)
    const r = recomendar(e, [a, b], agora)
    expect(r.candidatos.map((c) => c.tema)).toEqual(['b', 'a'])
  })

  it('é determinística e desempata pela ordem das matrizes', () => {
    const e = estado()
    const a = matriz('a', [{ slug: 'h', essencial: true }])
    const b = matriz('b', [{ slug: 'h', essencial: true }])
    const primeiro = recomendar(e, [a, b], agora)
    const segundo = recomendar(e, [a, b], agora)
    expect(primeiro).toEqual(segundo)
    expect(primeiro.recomendacao?.tema).toBe('a')
  })
})
