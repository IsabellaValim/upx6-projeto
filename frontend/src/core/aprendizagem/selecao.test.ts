import { describe, expect, it } from 'vitest'
import { selecionarQuestoes, selecionarRodada } from './selecao'
import type {
  EstadoAprendizagem,
  EventoAprendizagem,
  MatrizTema,
  QuestaoAprendizagem,
} from './tipos'

function estadoVazio(): EstadoAprendizagem {
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

interface Fabrica {
  estado: EstadoAprendizagem
  matriz: MatrizTema
  questao: (
    codigo: string,
    habilidade: string,
    familia: string,
    dificuldade?: string,
    secundarias?: string[],
  ) => QuestaoAprendizagem
  responder: (
    codigo: string,
    acertou: boolean,
    sessaoId?: string,
    instante?: number,
  ) => void
}

function fabrica(
  tema: string,
  essenciais: string[],
  outras: string[] = [],
): Fabrica {
  const estado = estadoVazio()
  const matriz: MatrizTema = {
    disciplina: 'matematica',
    tema,
    validada: true,
    habilidades: [
      ...essenciais.map((slug) => ({ slug, essencial: true })),
      ...outras.map((slug) => ({ slug, essencial: false })),
    ],
    questoes: [],
  }
  let n = 0
  const questao: Fabrica['questao'] = (
    codigo,
    habilidade,
    familia,
    dificuldade,
    secundarias = [],
  ) => {
    const q: QuestaoAprendizagem = {
      codigo,
      disciplina: matriz.disciplina,
      tema: matriz.tema,
      pedagogia: {
        habilidade,
        secundarias,
        familia,
        dificuldade: dificuldade ?? null,
        revisao: 'aprovada',
        elegivel: true,
        versao: 1,
      },
    }
    matriz.questoes.push(q)
    return q
  }
  const responder: Fabrica['responder'] = (
    codigo,
    acertou,
    sessaoId = 's1',
    instante = ++n * 1000,
  ) => {
    const q = matriz.questoes.find((x) => x.codigo === codigo)!
    const base: EventoAprendizagem = {
      id: `${codigo}-${instante}`,
      codigo,
      disciplina: matriz.disciplina,
      tema: matriz.tema,
      geracao: 0,
      sessaoId,
      modalidade: 'licao',
      tipo: 'submissao',
      instante,
      dataLocal: new Date(instante).toISOString().slice(0, 10),
      metadados: { ...q.pedagogia! },
      confiavel: true,
      tentativaId: `${codigo}-${instante}`,
      respondeu: true,
      respostaTexto: 'x',
      revisaoApi: 'rev',
    }
    estado.eventos.push(base, {
      ...base,
      id: `${codigo}-c-${instante}`,
      tipo: 'correcao',
      instante: instante + 1,
      acertou,
    })
    estado.conclusoes = estado.conclusoes.filter((f) => f.sessaoId !== sessaoId)
    const ev = estado.eventos.filter((e) => e.sessaoId === sessaoId)
    estado.conclusoes.push({
      id: sessaoId,
      sessaoId,
      geracao: 0,
      instante: Math.max(...ev.map((e) => e.instante)) + 1,
      eventoIds: ev.map((e) => e.id),
    })
  }
  return { estado, matriz, questao, responder }
}

describe('selecionarQuestoes', () => {
  it('rejeita tamanho inválido', () => {
    const { estado, matriz } = fabrica('t', ['h1'])
    for (const t of [0, -1, 1.5, NaN])
      expect(() => selecionarQuestoes(matriz, estado, t)).toThrow('Tamanho')
  })

  it('é determinística: mesma entrada, mesma ordem', () => {
    const { estado, matriz, questao } = fabrica('t', ['h1', 'h2'])
    for (let i = 0; i < 6; i++) questao(`q${i}`, i % 2 ? 'h1' : 'h2', `f${i}`)
    const a = selecionarQuestoes(matriz, estado, 4).questoes.map(
      (q) => q.codigo,
    )
    const b = selecionarQuestoes(matriz, estado, 4).questoes.map(
      (q) => q.codigo,
    )
    expect(a).toEqual(b)
    expect(new Set(a).size).toBe(4)
  })

  it('cobre todas as habilidades essenciais sem evidência primeiro', () => {
    const { estado, matriz, questao, responder } = fabrica('t', ['h1', 'h2'])
    questao('a1', 'h1', 'fa1')
    questao('a2', 'h1', 'fa2')
    questao('b1', 'h2', 'fb1')
    questao('b2', 'h2', 'fb2')
    responder('a1', true)
    const s = selecionarQuestoes(matriz, estado, 2).questoes
    // h2 (sem evidência) vem antes de continuar h1.
    expect(s[0]!.pedagogia!.habilidade).toBe('h2')
    expect(new Set(s.map((q) => q.codigo))).toEqual(new Set(['b1', 'a2']))
  })

  it('dificuldade não resolvida volta antes de habilidade em dia', () => {
    const { estado, matriz, questao, responder } = fabrica('t', ['h1', 'h2'])
    for (let i = 0; i < 4; i++) questao(`a${i}`, 'h1', `fa${i}`)
    for (let i = 0; i < 4; i++) questao(`b${i}`, 'h2', `fb${i}`)
    // h1: dois erros seguidos, sem resolução -> 'dificuldade'. h2: sem nada.
    responder('a0', false)
    responder('a1', false)
    const s = selecionarQuestoes(matriz, estado, 4).questoes
    const slugs = s.map((q) => q.pedagogia!.habilidade)
    // Dificuldade (h1) e novidade (h2) dividem a rodada; nada de h2 sozinha.
    expect(slugs[0]).toBe('h2')
    expect(slugs).toContain('h1')
    expect(slugs).toContain('h2')
  })

  it('questão nunca submetida vem antes de submetida e de evidenciada', () => {
    const { estado, matriz, questao, responder } = fabrica('t', ['h1'])
    questao('velha', 'h1', 'f1')
    questao('meia', 'h1', 'f2')
    questao('nova', 'h1', 'f3')
    responder('velha', true)
    // 'meia' foi submetida mas a evidência não qualificou (incerta).
    estado.eventos.push({
      ...estado.eventos[0]!,
      id: 'meia-s',
      codigo: 'meia',
      tipo: 'submissao',
      instante: 9000,
      dataLocal: '1970-01-02',
      incerta: true,
      tentativaId: 'meia-t',
      metadados: { ...matriz.questoes[1]!.pedagogia! },
    })
    const s = selecionarQuestoes(matriz, estado, 3).questoes
    expect(s.map((q) => q.codigo)).toEqual(['nova', 'meia', 'velha'])
  })

  it('prefere família ainda não usada como evidência', () => {
    const { estado, matriz, questao, responder } = fabrica('t', ['h1'])
    questao('q1', 'h1', 'fam-usada')
    questao('q2', 'h1', 'fam-nova')
    questao('q3', 'h1', 'fam-usada')
    responder('q1', true)
    const s = selecionarQuestoes(matriz, estado, 2).questoes
    expect(s[0]!.codigo).toBe('q2')
  })

  it('intervenção direcionada traz a habilidade alvo primeiro', () => {
    const { estado, matriz, questao, responder } = fabrica('t', ['h1', 'h2'])
    questao('a1', 'h1', 'fa1')
    questao('b1', 'h2', 'fb1')
    questao('b2', 'h2', 'fb2')
    responder('a1', true)
    const s = selecionarQuestoes(matriz, estado, 2, {
      habilidade: 'h1',
    }).questoes
    expect(s[0]!.pedagogia!.habilidade).toBe('h1')
  })

  it('alvo bate também pela habilidade secundária', () => {
    const { estado, matriz, questao } = fabrica('t', ['h1', 'h2'])
    questao('a1', 'h1', 'fa1')
    questao('b1', 'h2', 'fb1', undefined, ['h1'])
    const s = selecionarQuestoes(matriz, estado, 2, {
      habilidade: 'h1',
    }).questoes
    // a1 (principal h1) e b1 (secundária h1) saem na frente.
    expect(s.map((q) => q.codigo)).toEqual(['a1', 'b1'])
  })

  it('banco raso registra a limitação e completa sem inventar cobertura', () => {
    const { estado, matriz, questao } = fabrica('t', ['h1', 'h2', 'h3'])
    questao('a1', 'h1', 'fa1')
    // h2 sem questão elegível; h3 sem questão nenhuma.
    const naoElegivel = questao('x1', 'h2', 'fx1')
    naoElegivel.pedagogia!.elegivel = false
    const s = selecionarQuestoes(matriz, estado, 3)
    expect(s.limitacao).not.toBeNull()
    expect(s.limitacao!.essenciaisSemQuestao).toEqual(
      expect.arrayContaining(['h3']),
    )
    expect(s.limitacao!.elegiveis).toBe(1)
    // Completa com o que existe (a não elegível entra por último).
    expect(s.questoes.map((q) => q.codigo)).toEqual(['a1', 'x1'])
  })

  it('metadados pendentes não entram como elegíveis nem escondem a limitação', () => {
    const { estado, matriz, questao } = fabrica('t', ['h1'])
    const p = questao('q1', 'h1', 'f1')
    p.pedagogia!.revisao = 'pendente'
    const s = selecionarQuestoes(matriz, estado, 1)
    expect(s.limitacao!.elegiveis).toBe(0)
    expect(s.limitacao!.essenciaisSemQuestao).toContain('h1')
  })
})

describe('selecionarRodada', () => {
  it('rejeita tamanho inválido e não inventa sem matrizes avaliáveis', () => {
    const { estado, matriz } = fabrica('a', ['h1'])
    expect(() => selecionarRodada([matriz], estado, 0)).toThrow('Tamanho')
    matriz.validada = false
    expect(selecionarRodada([matriz], estado, 5).questoes).toEqual([])
    expect(selecionarRodada([], estado, 5).questoes).toEqual([])
  })

  it('espalha a rodada entre temas em vez de esgotar um só', () => {
    const a = fabrica('tema-a', ['h1'])
    const b = fabrica('tema-b', ['h2'])
    const c = fabrica('tema-c', ['h3'])
    for (let i = 0; i < 4; i++) a.questao(`a${i}`, 'h1', `fa${i}`)
    for (let i = 0; i < 4; i++) b.questao(`b${i}`, 'h2', `fb${i}`)
    for (let i = 0; i < 4; i++) c.questao(`c${i}`, 'h3', `fc${i}`)
    const s = selecionarRodada([a.matriz, b.matriz, c.matriz], a.estado, 6)
    // Intercalado a,b,c,a,b,c — nunca 4 do tema-a antes de ir ao b.
    expect(s.questoes.map((q) => q.tema)).toEqual([
      'tema-a',
      'tema-b',
      'tema-c',
      'tema-a',
      'tema-b',
      'tema-c',
    ])
    expect(new Set(s.questoes.map((q) => q.codigo)).size).toBe(6)
  })

  it('prioriza o tema com mais habilidades sem evidência', () => {
    const a = fabrica('tema-a', ['h1'])
    const b = fabrica('tema-b', ['h2', 'h3'])
    a.questao('a1', 'h1', 'fa1')
    a.questao('a2', 'h1', 'fa2')
    b.questao('b1', 'h2', 'fb1')
    b.questao('b2', 'h3', 'fb2')
    b.questao('b3', 'h3', 'fb3')
    // tema-a já tem evidência; tema-b não tem nenhuma -> começa por ele.
    a.responder('a1', true)
    a.responder('a2', true)
    const s = selecionarRodada([a.matriz, b.matriz], a.estado, 3)
    expect(s.questoes[0]!.tema).toBe('tema-b')
  })

  it('não repete questão nem quando falta família nova', () => {
    const a = fabrica('tema-a', ['h1'])
    for (let i = 0; i < 3; i++) a.questao(`a${i}`, 'h1', 'mesma')
    const s = selecionarRodada([a.matriz], a.estado, 3)
    expect(new Set(s.questoes.map((q) => q.codigo)).size).toBe(3)
  })

  it('segunda rodada do dia não repete as questões da primeira', () => {
    const a = fabrica('tema-a', ['h1'])
    for (let i = 0; i < 6; i++) a.questao(`a${i}`, 'h1', `f${i}`)
    const r1 = selecionarRodada([a.matriz], a.estado, 3)
    for (const q of r1.questoes) a.responder(q.codigo, true, 'r1')
    const r2 = selecionarRodada([a.matriz], a.estado, 3)
    const repetidas = r2.questoes.filter((q) =>
      r1.questoes.some((x) => x.codigo === q.codigo),
    )
    expect(repetidas).toEqual([])
  })

  it('banco esgotado devolve o que há e registra a limitação', () => {
    const a = fabrica('tema-a', ['h1'])
    for (let i = 0; i < 2; i++) a.questao(`a${i}`, 'h1', `f${i}`)
    for (const q of a.matriz.questoes) a.responder(q.codigo, true, 'r1')
    const s = selecionarRodada([a.matriz], a.estado, 4)
    expect(s.questoes.length).toBeLessThan(4)
    expect(s.limitacao).not.toBeNull()
    expect(s.limitacao!.ineditas).toBe(0)
  })
})
