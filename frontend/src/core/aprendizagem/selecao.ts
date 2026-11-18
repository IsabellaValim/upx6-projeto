/* Seleção adaptativa de questões: máximo de informação pedagógica com o
   menor número razoável de itens (prioridade: habilidades essenciais sem
   evidência → dificuldades → questões e famílias inéditas → dificuldade
   curatorial). Pura e determinística — desempate pelo código da questão,
   nunca sorteio. Não inventa cobertura: quando o banco é raso, devolve a
   melhor seleção possível E a limitação, para a jornada decidir. */
import { extrairEvidencias, metadadosValidos } from './evidencias'
import { PARAMETROS_DOMINIO, PARAMETROS_RECOMENDACAO } from './config'
import { situacaoHabilidade } from './recomendacao'
import type {
  EstadoAprendizagem,
  MatrizTema,
  ParametrosDominio,
  ParametrosRecomendacao,
  QuestaoAprendizagem,
  SituacaoHabilidade,
} from './tipos'

const ORDEM_DIFICULDADE: Record<string, number> = {
  introdutoria: 0,
  intermediaria: 1,
  avancada: 2,
}

const ORDEM_SITUACAO: Record<SituacaoHabilidade, number> = {
  'sem-evidencia': 0,
  dificuldade: 1,
  'em-pratica': 2,
  revisar: 3,
  boa: 4,
}

export interface OpcaoSelecao {
  // Intervenção direcionada: a questão que avalia esta habilidade vem primeiro.
  habilidade?: string
}

// Fotografia do que o banco oferece para um tema — nunca disfarçada.
export interface LimitacaoBanco {
  elegiveis: number
  ineditas: number
  familiasElegiveis: number
  essenciaisSemQuestao: string[]
}

export interface Selecao {
  questoes: QuestaoAprendizagem[]
  limitacao: LimitacaoBanco | null
}

function codigosSubmetidos(
  estado: EstadoAprendizagem,
  matriz: MatrizTema,
): Set<string> {
  return new Set(
    estado.eventos
      .filter(
        (e) =>
          e.tipo === 'submissao' &&
          e.disciplina === matriz.disciplina &&
          e.tema === matriz.tema,
      )
      .map((e) => e.codigo),
  )
}

function elegiveisDe(matriz: MatrizTema): QuestaoAprendizagem[] {
  const slugs = new Set(matriz.habilidades.map((h) => h.slug))
  return matriz.questoes.filter(
    (q) => metadadosValidos(q.pedagogia) && slugs.has(q.pedagogia.habilidade),
  )
}

function limitacao(
  matriz: MatrizTema,
  elegiveis: QuestaoAprendizagem[],
  ineditas: number,
): LimitacaoBanco | null {
  const comQuestao = new Set(elegiveis.map((q) => q.pedagogia!.habilidade))
  const essenciaisSemQuestao = matriz.habilidades
    .filter((h) => h.essencial && !comQuestao.has(h.slug))
    .map((h) => h.slug)
  const familiasElegiveis = new Set(elegiveis.map((q) => q.pedagogia!.familia))
    .size
  if (!essenciaisSemQuestao.length && elegiveis.length > 0) return null
  return {
    elegiveis: elegiveis.length,
    ineditas,
    familiasElegiveis,
    essenciaisSemQuestao,
  }
}

interface Candidata {
  q: QuestaoAprendizagem
  alvo: number
  situacao: number
  novidade: number // 0 nunca submetida, 1 submetida sem evidência, 2 evidenciada
  familiaNova: number
  dificuldade: number
}

/* Ordena o pool de um tema. O alvo (intervenção) vem antes de tudo; depois,
   habilidades essenciais com menos evidência, questões nunca submetidas e
   famílias ainda não usadas como evidência. */
function candidatas(
  matriz: MatrizTema,
  estado: EstadoAprendizagem,
  agora: number,
  pd: Readonly<ParametrosDominio>,
  pr: Readonly<ParametrosRecomendacao>,
  opcao: OpcaoSelecao,
): { pool: Candidata[]; ineditasElegiveis: number } {
  const evidencias = extrairEvidencias(estado, matriz)
  const evidenciadas = new Set(evidencias.map((e) => e.codigo))
  const familiasUsadas = new Set(evidencias.map((e) => e.familia))
  const submetidas = codigosSubmetidos(estado, matriz)
  const essenciais = new Set(
    matriz.habilidades.filter((h) => h.essencial).map((h) => h.slug),
  )
  const situacao = (slug: string): number =>
    essenciais.has(slug)
      ? ORDEM_SITUACAO[situacaoHabilidade(evidencias, slug, agora, pr, pd)]
      : ORDEM_SITUACAO.boa + 1 // habilidade de apoio: depois das essenciais boas
  const pool = elegiveisDe(matriz).map((q) => {
    const m = q.pedagogia!
    const alvo =
      opcao.habilidade !== undefined &&
      (m.habilidade === opcao.habilidade ||
        m.secundarias.includes(opcao.habilidade))
        ? 0
        : opcao.habilidade !== undefined
          ? 1
          : 0
    return {
      q,
      alvo,
      situacao: situacao(m.habilidade),
      novidade: !submetidas.has(q.codigo)
        ? 0
        : evidenciadas.has(q.codigo)
          ? 2
          : 1,
      familiaNova: familiasUsadas.has(m.familia) ? 1 : 0,
      dificuldade: m.dificuldade ? (ORDEM_DIFICULDADE[m.dificuldade] ?? 3) : 3,
    }
  })
  const ineditasElegiveis = pool.filter((c) => c.novidade === 0).length
  return { pool, ineditasElegiveis }
}

const ordemBase = (a: Candidata, b: Candidata) =>
  a.alvo - b.alvo ||
  a.situacao - b.situacao ||
  a.novidade - b.novidade ||
  a.familiaNova - b.familiaNova ||
  a.dificuldade - b.dificuldade ||
  a.q.codigo.localeCompare(b.q.codigo)

/* Escolhe até `tamanho` questões de UM tema espalhando por habilidade e
   família: a cada passo prefere uma habilidade ainda não coberta e, em
   seguida, uma família ainda não coberta. */
export function selecionarQuestoes(
  matriz: MatrizTema,
  estado: EstadoAprendizagem,
  tamanho: number,
  opcao: OpcaoSelecao = {},
  agora = Date.now(),
  pd: Readonly<ParametrosDominio> = PARAMETROS_DOMINIO,
  pr: Readonly<ParametrosRecomendacao> = PARAMETROS_RECOMENDACAO,
): Selecao {
  if (!Number.isSafeInteger(tamanho) || tamanho < 1)
    throw new Error('Tamanho de seleção inválido.')
  const { pool, ineditasElegiveis } = candidatas(
    matriz,
    estado,
    agora,
    pd,
    pr,
    opcao,
  )
  const restantes = [...pool].sort(ordemBase)
  const indice = new Map(restantes.map((c, i) => [c.q.codigo, i] as const))
  const escolhidas: QuestaoAprendizagem[] = []
  const habilidadesCobertas = new Set<string>()
  const familiasCobertas = new Set<string>()
  const chave = (c: Candidata): readonly number[] => [
    c.alvo,
    habilidadesCobertas.has(c.q.pedagogia!.habilidade) ? 1 : 0,
    c.situacao,
    c.novidade,
    familiasCobertas.has(c.q.pedagogia!.familia) ? 1 : 0,
    c.dificuldade,
    indice.get(c.q.codigo)!,
  ]
  const menor = (a: readonly number[], b: readonly number[]) => {
    for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) return a[k]! - b[k]!
    return 0
  }
  while (escolhidas.length < tamanho && restantes.length) {
    let melhor = 0
    let melhorChave = chave(restantes[0]!)
    for (let i = 1; i < restantes.length; i++) {
      const k = chave(restantes[i]!)
      if (menor(k, melhorChave) < 0) {
        melhor = i
        melhorChave = k
      }
    }
    const c = restantes.splice(melhor, 1)[0]!
    escolhidas.push(c.q)
    habilidadesCobertas.add(c.q.pedagogia!.habilidade)
    familiasCobertas.add(c.q.pedagogia!.familia)
  }
  const elegiveis = pool.map((c) => c.q)
  // Restam poucas elegíveis: completa a rodada com itens fora da curadoria
  // (eles não geram evidência, mas permitem praticar — a limitação é
  // registrada, nunca disfarçada).
  if (escolhidas.length < tamanho) {
    const usados = new Set(escolhidas.map((q) => q.codigo))
    const resto = matriz.questoes
      .filter((q) => !usados.has(q.codigo))
      .sort((a, b) => a.codigo.localeCompare(b.codigo))
    escolhidas.push(...resto.slice(0, tamanho - escolhidas.length))
  }
  return {
    questoes: escolhidas,
    limitacao: limitacao(matriz, elegiveis, ineditasElegiveis),
  }
}

/* Rodada multi-tema (diagnóstico ou verificação por matéria): intercala os
   temas validados priorizando quem tem mais habilidades essenciais sem
   evidência, para espalhar cobertura em vez de esgotar um tema só. */
export function selecionarRodada(
  matrizes: readonly MatrizTema[],
  estado: EstadoAprendizagem,
  tamanho: number,
  agora = Date.now(),
  pd: Readonly<ParametrosDominio> = PARAMETROS_DOMINIO,
  pr: Readonly<ParametrosRecomendacao> = PARAMETROS_RECOMENDACAO,
): Selecao {
  if (!Number.isSafeInteger(tamanho) || tamanho < 1)
    throw new Error('Tamanho de seleção inválido.')
  const avaliaveis = matrizes.filter(
    (m) => m.validada && m.habilidades.some((h) => h.essencial),
  )
  if (!avaliaveis.length) return { questoes: [], limitacao: null }
  const porMatriz = avaliaveis.map((matriz) => {
    const { pool, ineditasElegiveis } = candidatas(
      matriz,
      estado,
      agora,
      pd,
      pr,
      {},
    )
    const evidencias = extrairEvidencias(estado, matriz)
    const essenciais = matriz.habilidades.filter((h) => h.essencial)
    const semEvidencia = essenciais.filter(
      (h) => !evidencias.some((e) => e.habilidade === h.slug),
    ).length
    return {
      matriz,
      fila: [...pool].sort(ordemBase),
      necessidade: essenciais.length ? semEvidencia / essenciais.length : 0,
      elegiveis: pool.length,
      ineditasElegiveis,
    }
  })
  porMatriz.sort(
    (a, b) =>
      b.necessidade - a.necessidade ||
      a.matriz.tema.localeCompare(b.matriz.tema),
  )
  const escolhidas: QuestaoAprendizagem[] = []
  const familiasCobertas = new Set<string>()
  // Round-robin pelos temas: cada volta tenta o próximo da fila, para a
  // rodada espalhar cobertura em vez de esgotar um tema antes dos outros.
  let cursor = 0
  while (escolhidas.length < tamanho) {
    const ativas = porMatriz.filter((p) => p.fila.length)
    if (!ativas.length) break
    cursor %= ativas.length
    let escolhida: Candidata | undefined
    for (let k = 0; k < ativas.length; k++) {
      const p = ativas[(cursor + k) % ativas.length]!
      const i = p.fila.findIndex(
        (c) => !familiasCobertas.has(c.q.pedagogia!.familia),
      )
      if (i >= 0) {
        escolhida = p.fila.splice(i, 1)[0]!
        cursor += k + 1
        break
      }
    }
    if (!escolhida) {
      // Toda família elegível já coberta: aceita repetir família, não questão.
      escolhida = ativas[cursor]!.fila.shift()
      if (!escolhida) break
      cursor += 1
    }
    escolhidas.push(escolhida.q)
    familiasCobertas.add(escolhida.q.pedagogia!.familia)
  }
  const faltam = porMatriz.flatMap((p) => {
    const comQuestao = new Set(
      elegiveisDe(p.matriz).map((q) => q.pedagogia!.habilidade),
    )
    return p.matriz.habilidades
      .filter((h) => h.essencial && !comQuestao.has(h.slug))
      .map((h) => h.slug)
  })
  const limitacaoBanco: LimitacaoBanco | null =
    faltam.length || escolhidas.length < tamanho
      ? {
          elegiveis: porMatriz.reduce((s, p) => s + p.elegiveis, 0),
          ineditas: porMatriz.reduce((s, p) => s + p.ineditasElegiveis, 0),
          familiasElegiveis: familiasCobertas.size,
          essenciaisSemQuestao: faltam,
        }
      : null
  return { questoes: escolhidas, limitacao: limitacaoBanco }
}
