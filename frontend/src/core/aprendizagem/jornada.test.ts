import { describe, expect, it } from 'vitest'
import { proximaAcao, proximaAcaoEquilibrada, estadoPreparo } from './jornada'
import type { AulaTema } from './jornada'
import type {
  EstadoAprendizagem,
  EventoAprendizagem,
  MatrizTema,
  QuestaoAprendizagem,
} from './tipos'

const HORA = 60 * 60 * 1000

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

/* Cenário com N temas compartilhando o mesmo estado (como a vida real:
   sessões misturam temas da disciplina). */
function cenario(
  temas: { slug: string; essenciais: string[] }[],
  disciplina = 'matematica',
) {
  const estado = estadoVazio()
  const matrizes: MatrizTema[] = temas.map((t) => ({
    disciplina,
    tema: t.slug,
    validada: true,
    habilidades: t.essenciais.map((slug) => ({ slug, essencial: true })),
    questoes: [],
  }))
  let n = 0
  function questao(
    tema: string,
    codigo: string,
    habilidade: string,
    familia: string,
  ): QuestaoAprendizagem {
    const m = matrizes.find((x) => x.tema === tema)!
    const q: QuestaoAprendizagem = {
      codigo,
      disciplina,
      tema,
      pedagogia: {
        habilidade,
        secundarias: [],
        familia,
        revisao: 'aprovada',
        elegivel: true,
        versao: 1,
      },
    }
    m.questoes.push(q)
    return q
  }
  function responder(
    codigo: string,
    acertou: boolean,
    sessaoId: string,
    instante = ++n * 1000,
  ) {
    const m = matrizes.find((x) => x.questoes.some((q) => q.codigo === codigo))!
    const q = m.questoes.find((x) => x.codigo === codigo)!
    const base: EventoAprendizagem = {
      id: `${codigo}-${instante}`,
      codigo,
      disciplina,
      tema: m.tema,
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
  return { estado, matrizes, questao, responder }
}

const aulas = (tema: string, lista: AulaTema[]): Map<string, AulaTema[]> =>
  new Map([[`matematica/${tema}`, lista]])

describe('proximaAcao', () => {
  it('sem matrizes avaliáveis devolve null (fluxo tradicional)', () => {
    const { estado, matrizes } = cenario([{ slug: 't', essenciais: ['h'] }])
    matrizes[0]!.validada = false
    expect(proximaAcao({ estado, matrizes })).toBeNull()
    matrizes[0]!.habilidades[0]!.essencial = false
    expect(proximaAcao({ estado, matrizes })).toBeNull()
  })

  it('primeiro acesso agenda diagnóstico da disciplina, não catálogo', () => {
    const { estado, matrizes } = cenario([
      { slug: 'a', essenciais: ['h1'] },
      { slug: 'b', essenciais: ['h2'] },
    ])
    const acao = proximaAcao({ estado, matrizes })!
    expect(acao.tipo).toBe('diagnostico')
    expect(acao.disciplina).toBe('matematica')
    expect(acao.tema).toBeNull()
    expect(acao.motivo).toBe('inicio')
  })

  it('erro recorrente sem aula ligada vira prática dirigida', () => {
    const c = cenario([{ slug: 't', essenciais: ['h1'] }])
    c.questao('t', 'q1', 'h1', 'f1')
    c.questao('t', 'q2', 'h1', 'f2')
    c.responder('q1', false, 's1')
    c.responder('q2', false, 's1')
    const acao = proximaAcao({ estado: c.estado, matrizes: c.matrizes })!
    expect(acao.tipo).toBe('pratica')
    expect(acao.habilidade).toBe('h1')
    expect(acao.motivo).toBe('dificuldade')
  })

  it('erro recorrente com aula ligada pela curadoria vira aula', () => {
    const c = cenario([{ slug: 't', essenciais: ['h1'] }])
    c.questao('t', 'q1', 'h1', 'f1')
    c.questao('t', 'q2', 'h1', 'f2')
    c.responder('q1', false, 's1')
    c.responder('q2', false, 's1')
    const mapa = aulas('t', [
      { habilidades: [], assistida: false },
      { habilidades: ['h1'], assistida: true }, // já vista: rever a certa
    ])
    const acao = proximaAcao({
      estado: c.estado,
      matrizes: c.matrizes,
      aulas: mapa,
    })!
    expect(acao.tipo).toBe('aula')
    expect(acao.aula).toBe(1)
    expect(acao.habilidade).toBe('h1')
  })

  it('habilidade nova prefere aula ainda não assistida', () => {
    const c = cenario([{ slug: 't', essenciais: ['h1', 'h2'] }])
    c.questao('t', 'q1', 'h1', 'f1')
    c.questao('t', 'q2', 'h1', 'f2')
    c.responder('q1', true, 's1')
    c.responder('q2', true, 's1')
    const mapa = aulas('t', [
      { habilidades: ['h1'], assistida: true },
      { habilidades: ['h2'], assistida: false },
    ])
    const acao = proximaAcao({
      estado: c.estado,
      matrizes: c.matrizes,
      aulas: mapa,
      agora: 100_000, // eventos de teste são fabricados em instantes pequenos
    })!
    expect(acao.tipo).toBe('aula')
    expect(acao.aula).toBe(1)
    expect(acao.motivo).toBe('nova-habilidade')
  })

  it('habilidade nova sem aula disponível vira prática', () => {
    const c = cenario([{ slug: 't', essenciais: ['h1', 'h2'] }])
    c.questao('t', 'q1', 'h1', 'f1')
    c.questao('t', 'q2', 'h1', 'f2')
    c.responder('q1', true, 's1')
    c.responder('q2', true, 's1')
    const acao = proximaAcao({
      estado: c.estado,
      matrizes: c.matrizes,
      aulas: aulas('t', []),
      agora: 100_000,
    })!
    expect(acao.tipo).toBe('pratica')
    expect(acao.motivo).toBe('nova-habilidade')
  })

  it('bom desempenho com essenciais pede verificação, não mais prática', () => {
    const c = cenario([{ slug: 't', essenciais: ['h1'] }])
    for (let i = 0; i < 4; i++) c.questao('t', `q${i}`, 'h1', `f${i}`)
    for (let i = 0; i < 4; i++) c.responder(`q${i}`, true, 's1')
    const acao = proximaAcao({ estado: c.estado, matrizes: c.matrizes })!
    expect(acao.tipo).toBe('verificacao')
    expect(acao.tema).toBe('t')
  })

  it('verificação pendente passa na frente de habilidade nova de outro tema', () => {
    const c = cenario([
      { slug: 'a', essenciais: ['h1'] },
      { slug: 'b', essenciais: ['h2'] },
    ])
    for (let i = 0; i < 4; i++) c.questao('a', `a${i}`, 'h1', `fa${i}`)
    c.questao('b', 'b0', 'h2', 'fb0')
    for (let i = 0; i < 4; i++) c.responder(`a${i}`, true, 's1')
    const acao = proximaAcao({ estado: c.estado, matrizes: c.matrizes })!
    expect(acao.tipo).toBe('verificacao')
    expect(acao.tema).toBe('a')
  })

  it('habilidade em dia mas antiga agenda revisão', () => {
    const c = cenario([{ slug: 't', essenciais: ['h1'] }])
    c.questao('t', 'q1', 'h1', 'f1')
    c.questao('t', 'q2', 'h1', 'f2')
    c.responder('q1', true, 's1', 1000)
    c.responder('q2', true, 's1', 2000)
    const agora = 2000 + 73 * HORA
    const acao = proximaAcao({
      estado: c.estado,
      matrizes: c.matrizes,
      agora,
    })!
    expect(acao.tipo).toBe('revisar')
    expect(acao.motivo).toBe('revisao')
  })

  it('em prática sem recorrência continua praticando', () => {
    const c = cenario([{ slug: 't', essenciais: ['h1'] }])
    c.questao('t', 'q1', 'h1', 'f1')
    c.responder('q1', true, 's1')
    const acao = proximaAcao({ estado: c.estado, matrizes: c.matrizes })!
    expect(acao.tipo).toBe('pratica')
    expect(acao.motivo).toBe('continuar')
  })

  it('habilidades boas mas evidência insuficiente segue praticando, não simulado', () => {
    const c = cenario([{ slug: 't', essenciais: ['h1'] }])
    for (let i = 0; i < 3; i++) c.questao('t', `q${i}`, 'h1', `f${i}`)
    for (let i = 0; i < 3; i++) c.responder(`q${i}`, true, 's1')
    // 3 acertos deixam a essencial 'boa' (sem candidato a recomendar), mas o
    // tema está em-pratica: ainda não é verificação nem simulado.
    const acao = proximaAcao({
      estado: c.estado,
      matrizes: c.matrizes,
      agora: 100_000,
    })!
    expect(acao.tipo).toBe('pratica')
    expect(acao.motivo).toBe('continuar')
  })

  it('tudo confirmado sugere simulado e marca o escopo preparado', () => {
    const c = cenario([{ slug: 't', essenciais: ['h1'] }])
    for (let i = 0; i < 6; i++) c.questao('t', `q${i}`, 'h1', `f${i}`)
    for (let i = 0; i < 4; i++) c.responder(`q${i}`, true, 's1')
    c.responder('q4', true, 's2')
    c.responder('q5', true, 's2')
    const acao = proximaAcao({
      estado: c.estado,
      matrizes: c.matrizes,
      agora: 100_000,
    })!
    expect(acao.tipo).toBe('simulado')
    expect(acao.motivo).toBe('consolidado')
    expect(acao.escopoPreparado).toEqual(['t'])
  })
})

describe('proximaAcaoEquilibrada', () => {
  /* Junta os eventos de dois cenários num Estado só (responder() escreve
     no estado do próprio cenário — por isso responde-se antes de unir). */
  function juntar(...cs: ReturnType<typeof cenario>[]): EstadoAprendizagem {
    const base = cs[0]!.estado
    return {
      ...base,
      eventos: cs.flatMap((c) => c.estado.eventos),
      conclusoes: cs.flatMap((c) => c.estado.conclusoes),
    }
  }

  it('sem evidência em uma matéria, ela é a próxima (evolução uniforme)', () => {
    const a = cenario([{ slug: 'ta', essenciais: ['h1'] }], 'matematica')
    a.questao('ta', 'q1', 'h1', 'f1')
    a.responder('q1', true, 's1')
    const b = cenario([{ slug: 'tb', essenciais: ['h2'] }], 'linguagens')
    const acao = proximaAcaoEquilibrada(juntar(a, b), [
      { disciplina: 'matematica', matrizes: a.matrizes },
      { disciplina: 'linguagens', matrizes: b.matrizes },
    ])!
    expect(acao.disciplina).toBe('linguagens')
    expect(acao.tipo).toBe('diagnostico')
  })

  it('dificuldade recorrente vence o equilíbrio de matérias', () => {
    const a = cenario([{ slug: 'ta', essenciais: ['h1'] }], 'matematica')
    a.questao('ta', 'q1', 'h1', 'f1')
    a.questao('ta', 'q2', 'h1', 'f2')
    a.responder('q1', false, 's1')
    a.responder('q2', false, 's1')
    const b = cenario([{ slug: 'tb', essenciais: ['h2'] }], 'linguagens')
    const acao = proximaAcaoEquilibrada(juntar(a, b), [
      { disciplina: 'matematica', matrizes: a.matrizes },
      { disciplina: 'linguagens', matrizes: b.matrizes },
    ])!
    expect(acao.disciplina).toBe('matematica')
    expect(acao.motivo).toBe('dificuldade')
  })

  it('bom nível com largura (≥3 temas) vira treino de simulado graduado', () => {
    // Em cada tema: h1 consolidada (4 acertos) + h2 iniciada (1 acerto).
    // Bom desempenho sem essenciais atendidas → a recomendação é 'continuar'.
    // Com 70% de aprendizado e 3 temas tocados, vira treino de 10.
    const c = cenario(
      [
        { slug: 't1', essenciais: ['h1', 'h2'] },
        { slug: 't2', essenciais: ['h1', 'h2'] },
        { slug: 't3', essenciais: ['h1', 'h2'] },
      ],
      'matematica',
    )
    for (const t of ['t1', 't2', 't3']) {
      for (let i = 0; i < 4; i++) c.questao(t, `${t}a${i}`, 'h1', `${t}fa${i}`)
      c.questao(t, `${t}b0`, 'h2', `${t}fb0`)
    }
    for (const t of ['t1', 't2', 't3']) {
      for (let i = 0; i < 4; i++) c.responder(`${t}a${i}`, true, `s${t}`)
      c.responder(`${t}b0`, true, `s${t}`)
    }
    const acao = proximaAcaoEquilibrada(
      c.estado,
      [{ disciplina: 'matematica', matrizes: c.matrizes }],
      undefined,
      100_000,
    )!
    expect(acao.tipo).toBe('simulado')
    expect(acao.tamanho).toBe(10)
    expect(acao.tema).toBeNull()
  })

  it('um tema só, mesmo indo bem, ainda não é treino de simulado', () => {
    const c = cenario([{ slug: 't', essenciais: ['h1', 'h2'] }], 'matematica')
    for (let i = 0; i < 4; i++) c.questao('t', `a${i}`, 'h1', `fa${i}`)
    c.questao('t', 'b0', 'h2', 'fb0')
    for (let i = 0; i < 4; i++) c.responder(`a${i}`, true, 's1')
    c.responder('b0', true, 's1')
    const acao = proximaAcaoEquilibrada(
      c.estado,
      [{ disciplina: 'matematica', matrizes: c.matrizes }],
      undefined,
      100_000,
    )!
    expect(acao.tipo).toBe('pratica')
    expect(acao.motivo).toBe('continuar')
  })

  it('nível baixo mantém a prática normal — sem simulado cedo demais', () => {
    const c = cenario([{ slug: 't', essenciais: ['h1'] }], 'matematica')
    c.questao('t', 'q1', 'h1', 'f1')
    c.responder('q1', true, 's1')
    const acao = proximaAcaoEquilibrada(c.estado, [
      { disciplina: 'matematica', matrizes: c.matrizes },
    ])!
    expect(acao.tipo).toBe('pratica')
    expect(acao.motivo).toBe('continuar')
  })

  it('tudo confirmado libera o simulado completo, sem limite de tamanho', () => {
    const c = cenario([{ slug: 't', essenciais: ['h1'] }], 'matematica')
    for (let i = 0; i < 6; i++) c.questao('t', `q${i}`, 'h1', `f${i}`)
    for (let i = 0; i < 4; i++) c.responder(`q${i}`, true, 's1')
    c.responder('q4', true, 's2')
    c.responder('q5', true, 's2')
    const acao = proximaAcaoEquilibrada(
      c.estado,
      [{ disciplina: 'matematica', matrizes: c.matrizes }],
      undefined,
      100_000,
    )!
    expect(acao.tipo).toBe('simulado')
    expect(acao.tamanho).toBeUndefined()
  })
})

describe('estadoPreparo', () => {
  it('só sai preparado com dominio-confirmado, nunca por bom desempenho', () => {
    const c = cenario([{ slug: 't', essenciais: ['h1'] }])
    for (let i = 0; i < 6; i++) c.questao('t', `q${i}`, 'h1', `f${i}`)
    for (let i = 0; i < 4; i++) c.responder(`q${i}`, true, 's1')
    const antes = proximaAcao({ estado: c.estado, matrizes: c.matrizes })!
    expect(antes.tipo).toBe('verificacao')
    expect(estadoPreparo({ estado: 'bom-desempenho' } as never)).toBe(
      'continue',
    )
    c.responder('q4', true, 's2')
    c.responder('q5', true, 's2')
    expect(estadoPreparo({ estado: 'dominio-confirmado' } as never)).toBe(
      'preparado',
    )
  })
})
