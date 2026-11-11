import { describe, expect, it } from 'vitest'
import {
  avaliarEvolucao,
  compararDesempenho,
  destaqueEvolucao,
  habilidadesBoas,
  PARAMETROS_COMPARACAO,
} from './evolucao'
import type {
  EstadoAprendizagem,
  EventoAprendizagem,
  MatrizTema,
  QuestaoAprendizagem,
} from './tipos'
import type { Resultado } from '../../types'

const atividade = (
  subject: string,
  correct: number,
  total: number,
): Resultado => ({
  v: 3,
  subject,
  correct,
  total,
  date: Date.now(),
  items: [],
  weakTopic: null,
})

describe('evolução imediata com registros reais', () => {
  it('não inventa progresso sem respostas', () => {
    expect(avaliarEvolucao([], 'matematica').rotulo).toBe('Para começar')
  })
  it('informa bom desempenho após uma lição curta, sem falar em domínio', () => {
    const r = avaliarEvolucao([atividade('matematica', 4, 5)], 'matematica')
    expect(r.rotulo).toBe('Indo bem nas atividades')
    expect(r.acertos).toBe(4)
    expect(r.respondidas).toBe(5)
  })
  it('distingue disciplinas e compara sessões', () => {
    const r = avaliarEvolucao(
      [
        atividade('matematica', 1, 5),
        atividade('linguagens', 5, 5),
        atividade('matematica', 4, 5),
      ],
      'matematica',
    )
    expect(r.respondidas).toBe(10)
    expect(r.mensagem).toContain('melhorou')
  })
  it('ignora dados incoerentes', () => {
    const r = avaliarEvolucao(
      [atividade('matematica', 5, 4), atividade('matematica', 3, 4)],
      'matematica',
    )
    expect(r.rotulo).toBe('Primeiros passos')
    expect(r.respondidas).toBe(4)
  })
})

/* ---------- Comparação antes/depois ---------- */

let seq = 0
function cenario() {
  const estado: EstadoAprendizagem = {
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
  const matrizes = new Map<string, MatrizTema>()
  function matriz(
    tema: string,
    habilidades: { slug: string; essencial?: boolean }[],
    disciplina = 'matematica',
  ): MatrizTema {
    const m: MatrizTema = {
      disciplina,
      tema,
      validada: true,
      habilidades: habilidades.map((h) => ({
        slug: h.slug,
        essencial: h.essencial ?? true,
      })),
      questoes: [],
    }
    matrizes.set(tema, m)
    return m
  }
  function responder(
    m: MatrizTema,
    n: number,
    acertou: boolean,
    o: {
      instante?: number
      sessaoId?: string
      habilidade?: string
      familia?: string
      dificuldade?: string
      codigo?: string
      modalidade?: 'licao' | 'simulado' | 'rodada'
      concluida?: boolean
    } = {},
  ) {
    const instante = o.instante ?? ++seq * 1000
    const sessaoId = o.sessaoId ?? 's1'
    const codigo = o.codigo ?? `${m.tema}-q${n}`
    const questao: QuestaoAprendizagem = {
      codigo,
      disciplina: m.disciplina,
      tema: m.tema,
      pedagogia: {
        habilidade: o.habilidade ?? m.habilidades[0]!.slug,
        secundarias: [],
        familia: o.familia ?? `${m.tema}-f${n}`,
        dificuldade: o.dificuldade ?? null,
        revisao: 'aprovada',
        elegivel: true,
        versao: 1,
      },
    }
    if (!m.questoes.some((q) => q.codigo === codigo)) m.questoes.push(questao)
    const submissao: EventoAprendizagem = {
      id: `e${estado.eventos.length}`,
      codigo,
      disciplina: m.disciplina,
      tema: m.tema,
      geracao: 0,
      sessaoId,
      modalidade: o.modalidade ?? 'licao',
      tipo: 'submissao',
      instante,
      dataLocal: new Date(instante).toISOString().slice(0, 10),
      metadados: { ...questao.pedagogia! },
      confiavel: true,
      tentativaId: `t${estado.eventos.length}`,
      respondeu: true,
      respostaTexto: 'alternativa',
      revisaoApi: 'conteudo-v1',
    }
    const correcao: EventoAprendizagem = {
      ...submissao,
      id: `e${estado.eventos.length + 1}`,
      tipo: 'correcao',
      instante: instante + 1,
      acertou,
    }
    estado.eventos.push(submissao, correcao)
    if (o.concluida !== false) {
      estado.conclusoes = estado.conclusoes.filter(
        (f) => f.sessaoId !== sessaoId,
      )
      const eventosSessao = estado.eventos.filter(
        (e) => e.sessaoId === sessaoId,
      )
      estado.conclusoes.push({
        id: sessaoId,
        sessaoId,
        geracao: 0,
        instante: Math.max(...eventosSessao.map((e) => e.instante)) + 1,
        eventoIds: eventosSessao.map((e) => e.id),
      })
    }
    return { submissao, correcao, questao }
  }
  let nq = 0
  function rodada(
    m: MatrizTema,
    acertos: boolean[],
    o: { sessaoId?: string; instante?: number; habilidades?: string[] } = {},
  ) {
    const sessaoId = o.sessaoId ?? `r${++seq}`
    const base = o.instante ?? ++seq * 100000 // cada rodada bem depois da anterior
    acertos.forEach((acertou, i) =>
      responder(m, ++nq, acertou, {
        sessaoId,
        instante: base + i * 1000,
        habilidade:
          o.habilidades?.[i] ?? m.habilidades[i % m.habilidades.length]!.slug,
      }),
    )
    return sessaoId
  }
  return { estado, matrizes, matriz, responder, rodada }
}

describe('comparação antes/depois por tema', () => {
  it('sem evidência não gera rodada nem comparação', () => {
    const { estado, matriz } = cenario()
    const m = matriz('porcentagem', [{ slug: 'calcular' }])
    const [e] = compararDesempenho(estado, [m])
    expect(e!.rodadas).toHaveLength(0)
    expect(e!.referencia).toBeNull()
    expect(e!.comparavel).toBe(false)
    expect(destaqueEvolucao([e!])).toBeNull()
  })
  it('uma única rodada é o primeiro resultado, sem conclusão comparativa', () => {
    const { estado, matriz, rodada } = cenario()
    const m = matriz('porcentagem', [{ slug: 'calcular' }])
    rodada(m, [true, true, false, true, false])
    const [e] = compararDesempenho(estado, [m])
    expect(e!.referencia!.acertos).toBe(3)
    expect(e!.referencia!.total).toBe(5)
    expect(e!.referencia!.papel).toBe('inicial')
    expect(e!.verificacao).toBeNull()
    expect(e!.comparavel).toBe(false)
    expect(e!.interpretacao).toBeNull()
    expect(destaqueEvolucao([e!])).toBe(e)
  })
  it('duas rodadas comparáveis com melhora real', () => {
    const { estado, matriz, rodada } = cenario()
    const m = matriz('porcentagem', [
      { slug: 'calcular' },
      { slug: 'comparar' },
    ])
    rodada(m, [true, false, true, false, false], { sessaoId: 'antes' })
    rodada(m, [true, true, true, true, false], { sessaoId: 'depois' })
    const [e] = compararDesempenho(estado, [m])
    expect(e!.comparavel).toBe(true)
    expect(e!.referencia!.acertos).toBe(2)
    expect(e!.verificacao!.acertos).toBe(4)
    expect(e!.verificacao!.papel).toBe('verificacao')
    expect(e!.interpretacao).toBe('melhorou')
  })
  it('rodadas comparáveis sem melhora não viram vitória', () => {
    const { estado, matriz, rodada } = cenario()
    const m = matriz('porcentagem', [{ slug: 'calcular' }])
    rodada(m, [true, true, true, true, false], { sessaoId: 'a' })
    rodada(m, [true, true, false, false, false], { sessaoId: 'b' })
    const [e] = compararDesempenho(estado, [m])
    expect(e!.comparavel).toBe(true)
    expect(e!.interpretacao).toBe('continuar')
  })
  it('desempenho alto nas duas rodadas é "manteve", não "melhorou"', () => {
    const { estado, matriz, rodada } = cenario()
    const m = matriz('porcentagem', [{ slug: 'calcular' }])
    rodada(m, [true, true, true, true, true], { sessaoId: 'a' })
    rodada(m, [true, true, true, true, false], { sessaoId: 'b' })
    const [e] = compararDesempenho(estado, [m])
    expect(e!.interpretacao).toBe('manteve')
  })
  it('ganho menor que uma questão equivalente não é "melhorou"', () => {
    const { estado, matriz, rodada } = cenario()
    const m = matriz('porcentagem', [{ slug: 'calcular' }])
    rodada(m, [true, true, true, false], { sessaoId: 'a' }) // 75%
    rodada(m, [true, true, true, true, false], { sessaoId: 'b' }) // 80%
    const [e] = compararDesempenho(estado, [m])
    expect(e!.comparavel).toBe(true)
    expect(e!.interpretacao).not.toBe('melhorou')
  })
  it('compara rodadas de tamanhos diferentes', () => {
    const { estado, matriz, rodada } = cenario()
    const m = matriz('porcentagem', [{ slug: 'calcular' }])
    rodada(m, [true, false, false], { sessaoId: 'a' }) // 1/3
    rodada(m, [true, true, true, true, false], { sessaoId: 'b' }) // 4/5
    const [e] = compararDesempenho(estado, [m])
    expect(e!.comparavel).toBe(true)
    expect(e!.interpretacao).toBe('melhorou')
  })
  it('rodada curta antes da cheia é só preliminar, não verificação falha', () => {
    const { estado, matriz, rodada } = cenario()
    const m = matriz('porcentagem', [{ slug: 'calcular' }])
    rodada(m, [true, true], { sessaoId: 'curta' })
    rodada(m, [true, true, true, true, false], { sessaoId: 'cheia' })
    const [e] = compararDesempenho(estado, [m])
    expect(e!.referencia!.sessaoId).toBe('cheia')
    expect(e!.comparavel).toBe(false)
    expect(e!.motivo).toBeNull() // nenhuma candidata depois da referência
    expect(e!.ultima).toBeNull() // a última É a referência
  })
  it('rodada curta depois da referência é verificação com poucas questões', () => {
    const { estado, matriz, rodada } = cenario()
    const m = matriz('porcentagem', [{ slug: 'calcular' }])
    rodada(m, [true, true, true, true, false], { sessaoId: 'cheia' })
    rodada(m, [true, true], { sessaoId: 'curta' })
    const [e] = compararDesempenho(estado, [m])
    expect(e!.referencia!.sessaoId).toBe('cheia')
    expect(e!.comparavel).toBe(false)
    expect(e!.motivo).toBe('poucas-questoes')
    expect(e!.ultima!.sessaoId).toBe('curta')
  })
  it('verificação sem habilidade em comum não compara', () => {
    const { estado, matriz, rodada } = cenario()
    const m = matriz('porcentagem', [
      { slug: 'calcular' },
      { slug: 'comparar' },
    ])
    rodada(m, [true, false, false, true, false], {
      sessaoId: 'a',
      habilidades: ['calcular', 'calcular', 'calcular', 'calcular', 'calcular'],
    })
    rodada(m, [true, true, true, true, false], {
      sessaoId: 'b',
      habilidades: ['comparar', 'comparar', 'comparar', 'comparar', 'comparar'],
    })
    const [e] = compararDesempenho(estado, [m])
    expect(e!.comparavel).toBe(false)
    expect(e!.motivo).toBe('habilidades-distintas')
    expect(e!.ultima!.acertos).toBe(4) // mostrada separada, sem conclusão
  })
  it('refazer as mesmas questões não produz rodada nova nem melhora artificial', () => {
    const { estado, matriz, responder, rodada } = cenario()
    const m = matriz('porcentagem', [{ slug: 'calcular' }])
    rodada(m, [true, false, false, true, false], { sessaoId: 'a' })
    for (const q of m.questoes)
      responder(m, 0, true, {
        sessaoId: 'repetida',
        codigo: q.codigo,
        familia: q.pedagogia!.familia,
      })
    const [e] = compararDesempenho(estado, [m])
    expect(e!.rodadas).toHaveLength(1)
    expect(e!.comparavel).toBe(false)
  })
  it('questões novas de famílias já usadas não viram verificação', () => {
    const { estado, matriz, responder, rodada } = cenario()
    const m = matriz('porcentagem', [{ slug: 'calcular' }])
    rodada(m, [true, false, false, true, false], { sessaoId: 'a' })
    m.questoes.forEach((q, i) =>
      responder(m, 100 + i, true, {
        sessaoId: 'familias',
        familia: q.pedagogia!.familia, // família repetida, questão inédita
      }),
    )
    const [e] = compararDesempenho(estado, [m])
    expect(e!.comparavel).toBe(false)
  })
  it('resposta depois de ver a solução não conta como verificação', () => {
    const { estado, matriz, responder, rodada } = cenario()
    const m = matriz('porcentagem', [{ slug: 'calcular' }])
    rodada(m, [true, false, false, true, false])
    // A pessoa revê a correção e tenta as mesmas questões de novo.
    for (const q of m.questoes) {
      const instante = ++seq * 100000
      estado.eventos.push({
        id: `exp-${q.codigo}`,
        codigo: q.codigo,
        disciplina: m.disciplina,
        tema: m.tema,
        geracao: 0,
        sessaoId: 'revisao',
        modalidade: 'licao',
        tipo: 'exposicao',
        instante,
        dataLocal: new Date(instante).toISOString().slice(0, 10),
        metadados: { ...q.pedagogia! },
        confiavel: true,
      })
      responder(m, 0, true, {
        sessaoId: 'repetida',
        instante: instante + 1,
        codigo: q.codigo,
        familia: q.pedagogia!.familia,
      })
    }
    const [e] = compararDesempenho(estado, [m])
    expect(e!.rodadas).toHaveLength(1)
    expect(e!.comparavel).toBe(false)
  })
  it('resposta legada sem metadados pedagógicos não vira evidência', () => {
    const { estado, matriz, rodada, responder } = cenario()
    const m = matriz('porcentagem', [{ slug: 'calcular' }])
    rodada(m, [true, false, false, true, false], { sessaoId: 'a' })
    const antiga = responder(m, 50, true, { sessaoId: 'legada' })
    antiga.submissao.metadados = null
    const [e] = compararDesempenho(estado, [m])
    expect(e!.rodadas).toHaveLength(1)
    expect(e!.comparavel).toBe(false)
  })
  it('dificuldade média muito distante não compara', () => {
    const { estado, matriz, responder } = cenario()
    const m = matriz('porcentagem', [{ slug: 'calcular' }])
    for (let i = 0; i < 4; i++)
      responder(m, i, i < 2, { sessaoId: 'a', dificuldade: 'introdutoria' })
    for (let i = 0; i < 4; i++)
      responder(m, 10 + i, true, { sessaoId: 'b', dificuldade: 'avancada' })
    const [e] = compararDesempenho(estado, [m])
    expect(e!.comparavel).toBe(false)
    expect(e!.motivo).toBe('dificuldade-diferente')
  })
  it('usa a verificação comparável mais recente e mostra a última separada', () => {
    const { estado, matriz, rodada } = cenario()
    const m = matriz('porcentagem', [
      { slug: 'calcular' },
      { slug: 'comparar' },
    ])
    rodada(m, [true, false, false, true, false], {
      sessaoId: 'a',
      habilidades: ['calcular'],
    })
    rodada(m, [true, true, true, true, false], {
      sessaoId: 'b',
      habilidades: ['calcular'],
    })
    rodada(m, [true, true], { sessaoId: 'c' }) // curta demais
    const [e] = compararDesempenho(estado, [m])
    expect(e!.comparavel).toBe(true)
    expect(e!.verificacao!.sessaoId).toBe('b')
    expect(e!.ultima!.sessaoId).toBe('c')
  })
  it('destaque prefere a comparação válida mais recente entre os temas', () => {
    const { estado, matrizes, matriz, rodada } = cenario()
    const a = matriz('porcentagem', [{ slug: 'calcular' }])
    const b = matriz('equacoes', [{ slug: 'resolver' }])
    rodada(a, [true, false, false, true, false], { sessaoId: 'a1' })
    rodada(a, [true, true, true, true, false], { sessaoId: 'a2' })
    rodada(b, [true, false, false, true, false], { sessaoId: 'b1' })
    const evolucoes = compararDesempenho(estado, [...matrizes.values()])
    const d = destaqueEvolucao(evolucoes)
    expect(d!.tema).toBe('porcentagem')
    expect(d!.comparavel).toBe(true)
  })
  it('rodada multi-tema vira uma rodada por tema, comparável por tema', () => {
    const { estado, matrizes, matriz, responder, rodada } = cenario()
    const a = matriz('porcentagem', [{ slug: 'calcular' }])
    const b = matriz('equacoes', [{ slug: 'resolver' }])
    for (let i = 0; i < 3; i++)
      responder(a, i, i === 0, { sessaoId: 'diag', instante: 1000 + i })
    for (let i = 0; i < 3; i++)
      responder(b, i, true, { sessaoId: 'diag', instante: 1003 + i })
    rodada(a, [true, true, true, true, false], { sessaoId: 'verificacao' })
    const evolucoes = compararDesempenho(estado, [...matrizes.values()])
    const pa = evolucoes.find((e) => e.tema === 'porcentagem')!
    const pb = evolucoes.find((e) => e.tema === 'equacoes')!
    expect(pa.comparavel).toBe(true)
    expect(pa.referencia!.total).toBe(3)
    expect(pb.comparavel).toBe(false) // equações só tem a fatia do diagnóstico
    expect(pb.referencia!.total).toBe(3)
  })
})

describe('habilidades já demonstradas', () => {
  // O "agora" é logo depois da última resposta do cenário: sem isso a
  // habilidade cai em "revisar" pela idade do evento, não por mérito.
  it('habilidade com acertos suficientes aparece como "boa"', () => {
    const { estado, matriz, responder } = cenario()
    const m = matriz('porcentagem', [
      { slug: 'calcular' },
      { slug: 'comparar' },
    ])
    responder(m, 1, true, { habilidade: 'calcular' })
    responder(m, 2, true, { habilidade: 'calcular' })
    responder(m, 3, false, { habilidade: 'comparar' })
    expect(habilidadesBoas(estado, m, seq * 1000)).toEqual(['calcular'])
  })
  it('não declara habilidade por um acerto isolado', () => {
    const { estado, matriz, responder } = cenario()
    const m = matriz('porcentagem', [{ slug: 'calcular' }])
    responder(m, 1, true, { habilidade: 'calcular' })
    expect(habilidadesBoas(estado, m, seq * 1000)).toEqual([])
  })
  it('dificuldade recorrente não resolvida não entra na lista', () => {
    const { estado, matriz, responder } = cenario()
    const m = matriz('porcentagem', [{ slug: 'calcular' }])
    responder(m, 1, true, { habilidade: 'calcular' })
    responder(m, 2, false, { habilidade: 'calcular' })
    responder(m, 3, false, { habilidade: 'calcular' })
    expect(habilidadesBoas(estado, m, seq * 1000)).toEqual([])
  })
  it('parâmetros de comparação vêm congelados', () => {
    expect(PARAMETROS_COMPARACAO).toEqual({
      minQuestoes: 3,
      minGanho: 1,
      taxaBoa: 0.8,
      maxDifDificuldade: 1,
    })
    expect(Object.isFrozen(PARAMETROS_COMPARACAO)).toBe(true)
  })
})
