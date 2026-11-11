import { PARAMETROS_DOMINIO, PARAMETROS_RECOMENDACAO } from './config'
import { extrairEvidencias } from './evidencias'
import { situacaoHabilidade } from './recomendacao'
import type {
  EstadoAprendizagem,
  Evidencia,
  MatrizTema,
  ParametrosDominio,
  ParametrosRecomendacao,
  SessaoAprendizagem,
} from './tipos'
import type { CatalogSubject, Resultado } from '../../types'

/** Feedback de atividades reais, separado de domínio e preparo para o exame.
 *  Inclui tentativas repetidas, portanto NUNCA serve de prova de domínio. */
export function avaliarEvolucao(
  resultados: readonly Resultado[],
  disciplina: string,
) {
  const recentes = resultados
    .filter(
      (r) =>
        r.subject === disciplina &&
        Number.isSafeInteger(r.total) &&
        r.total > 0 &&
        Number.isSafeInteger(r.correct) &&
        r.correct >= 0 &&
        r.correct <= r.total,
    )
    .slice(-3)
  const respondidas = recentes.reduce((s, r) => s + r.total, 0)
  const acertos = recentes.reduce((s, r) => s + r.correct, 0)
  const rotulo =
    respondidas === 0
      ? 'Para começar'
      : respondidas < 5
        ? 'Primeiros passos'
        : acertos / respondidas >= 0.8
          ? 'Indo bem nas atividades'
          : 'Em aprendizagem'
  let mensagem = 'Continue praticando no seu ritmo.'
  if (recentes.length >= 2) {
    const anterior = recentes[recentes.length - 2]!
    const ultima = recentes[recentes.length - 1]!
    if (ultima.correct / ultima.total > anterior.correct / anterior.total)
      mensagem = 'Seu resultado na última atividade melhorou.'
  }
  return { rotulo, respondidas, acertos, atividades: recentes.length, mensagem }
}

/* ---------- Comparação antes/depois por tema ----------

   A pergunta que esta parte responde: "o desempenho da pessoa mudou depois
   de estudar?". É uma avaliação de EVOLUÇÃO, independente do motor de
   domínio — não confirma domínio, não mede retenção e nunca fala em prova.

   Rodada = as evidências de uma sessão num tema. Como evidência só nasce
   de questão e família inéditas, toda rodada posterior já é "questões
   novas": a comparabilidade se resume a tamanho mínimo, habilidade em
   comum e dificuldade média próxima. Quando as rodadas não se comparam,
   o resultado é mostrado separado — nunca com conclusão inventada. */

export interface RodadaAprendizagem {
  sessaoId: string
  modalidade: SessaoAprendizagem['modalidade']
  papel: 'inicial' | 'pratica' | 'verificacao'
  instante: number
  acertos: number
  total: number
  codigos: string[]
  familias: string[]
  habilidades: string[]
  dificuldadeMedia: number | null // 0 introdutória → 2 avançada; null se mal informada
}

export type MotivoNaoComparavel =
  | 'poucas-questoes'
  | 'questoes-repetidas'
  | 'familias-repetidas'
  | 'habilidades-distintas'
  | 'dificuldade-diferente'

export type InterpretacaoEvolucao = 'melhorou' | 'manteve' | 'continuar'

export interface EvolucaoTema {
  disciplina: string
  tema: string
  rodadas: RodadaAprendizagem[]
  referencia: RodadaAprendizagem | null // primeira rodada grande o bastante
  verificacao: RodadaAprendizagem | null // última rodada comparável com ela
  ultima: RodadaAprendizagem | null // rodada mais recente, se outra (exibir separado)
  comparavel: boolean
  motivo: MotivoNaoComparavel | null // por que a mais recente não compara
  interpretacao: InterpretacaoEvolucao | null // só existe quando comparavel
}

export interface OpcoesComparacao {
  minQuestoes: number // rodada menor não vira referência nem verificação
  minGanho: number // melhora mínima em "questões equivalentes" p/ dizer "melhorou"
  taxaBoa: number // piso das duas taxas para dizer "manteve um bom desempenho"
  maxDifDificuldade: number // distância máxima entre as dificuldades médias
}

export const PARAMETROS_COMPARACAO: Readonly<OpcoesComparacao> = Object.freeze({
  minQuestoes: 3,
  minGanho: 1,
  taxaBoa: 0.8,
  maxDifDificuldade: 1,
})

const ORDEM_DIFICULDADE: Record<string, number> = {
  introdutoria: 0,
  intermediaria: 1,
  avancada: 2,
}

function rodadasDoTema(
  estado: EstadoAprendizagem,
  matriz: MatrizTema,
): RodadaAprendizagem[] {
  const evidencias = extrairEvidencias(estado, matriz)
  if (!evidencias.length) return []
  const modalidade = new Map<string, SessaoAprendizagem['modalidade']>()
  for (const e of estado.eventos)
    if (!modalidade.has(e.sessaoId)) modalidade.set(e.sessaoId, e.modalidade)
  const dificuldade = new Map(
    matriz.questoes.map((q) => [
      q.codigo,
      q.pedagogia?.dificuldade
        ? (ORDEM_DIFICULDADE[q.pedagogia.dificuldade] ?? null)
        : null,
    ]),
  )
  const porSessao = new Map<string, Evidencia[]>()
  for (const e of evidencias) {
    const lista = porSessao.get(e.sessaoId) ?? []
    lista.push(e)
    porSessao.set(e.sessaoId, lista)
  }
  return [...porSessao.entries()]
    .map(([sessaoId, evs]) => {
      const notas = evs
        .map((e) => dificuldade.get(e.codigo) ?? null)
        .filter((d): d is number => d !== null)
      return {
        sessaoId,
        modalidade: modalidade.get(sessaoId) ?? 'licao',
        papel: 'pratica' as const,
        instante: evs[evs.length - 1]!.instante,
        acertos: evs.filter((e) => e.acertou).length,
        total: evs.length,
        codigos: evs.map((e) => e.codigo),
        familias: evs.map((e) => e.familia),
        habilidades: [...new Set(evs.map((e) => e.habilidade))],
        // Média só com a metade das questões classificadas; senão, incógnita.
        dificuldadeMedia:
          notas.length * 2 >= evs.length
            ? notas.reduce((s, d) => s + d, 0) / notas.length
            : null,
      }
    })
    .sort(
      (a, b) => a.instante - b.instante || a.sessaoId.localeCompare(b.sessaoId),
    )
}

function motivoNaoComparavel(
  ref: RodadaAprendizagem,
  ver: RodadaAprendizagem,
  o: Readonly<OpcoesComparacao>,
): MotivoNaoComparavel | null {
  if (ver.total < o.minQuestoes) return 'poucas-questoes'
  if (ver.codigos.some((c) => ref.codigos.includes(c)))
    return 'questoes-repetidas'
  if (ver.familias.some((f) => ref.familias.includes(f)))
    return 'familias-repetidas'
  if (!ver.habilidades.some((h) => ref.habilidades.includes(h)))
    return 'habilidades-distintas'
  if (
    ref.dificuldadeMedia !== null &&
    ver.dificuldadeMedia !== null &&
    Math.abs(ver.dificuldadeMedia - ref.dificuldadeMedia) > o.maxDifDificuldade
  )
    return 'dificuldade-diferente'
  return null
}

/* "Melhorou" pede um ganho de ao menos uma questão equivalente — diferenças
   menores que isso em amostras curtas não são evidência de aprendizagem.
   Sem melhora, só se fala em bom desempenho quando as DUAS rodadas ficaram
   altas; no resto, a orientação é seguir praticando, sem mensagem negativa. */
function interpretar(
  ref: RodadaAprendizagem,
  ver: RodadaAprendizagem,
  o: Readonly<OpcoesComparacao>,
): InterpretacaoEvolucao {
  const taxa = (r: RodadaAprendizagem) => r.acertos / r.total
  const delta = taxa(ver) - taxa(ref)
  if (delta > 0 && delta * Math.min(ref.total, ver.total) >= o.minGanho)
    return 'melhorou'
  if (taxa(ref) >= o.taxaBoa && taxa(ver) >= o.taxaBoa) return 'manteve'
  return 'continuar'
}

/* Por tema: rodadas em ordem, a referência inicial (primeira grande o
   bastante), a verificação mais recente que se compara a ela e a leitura
   honesta do resultado. Matriz não validada também entra: validação mede
   cobertura da área; aqui cada evidência já é confiável por si só. */
export function compararDesempenho(
  estado: EstadoAprendizagem,
  matrizes: readonly MatrizTema[],
  o: Readonly<OpcoesComparacao> = PARAMETROS_COMPARACAO,
): EvolucaoTema[] {
  return matrizes.map((matriz) => {
    const rodadas = rodadasDoTema(estado, matriz)
    const referencia = rodadas.find((r) => r.total >= o.minQuestoes) ?? null
    let verificacao: RodadaAprendizagem | null = null
    let motivo: MotivoNaoComparavel | null = null
    if (referencia) {
      for (let i = rodadas.length - 1; i >= 0; i--) {
        const r = rodadas[i]!
        if (r === referencia) break
        const m = motivoNaoComparavel(referencia, r, o)
        if (m === null) {
          verificacao = r
          break
        }
        if (i === rodadas.length - 1) motivo = m
      }
    }
    if (referencia) referencia.papel = 'inicial'
    if (verificacao) verificacao.papel = 'verificacao'
    const ultima =
      rodadas.length && rodadas[rodadas.length - 1] !== referencia
        ? rodadas[rodadas.length - 1]!
        : null
    const comparavel = !!verificacao
    return {
      disciplina: matriz.disciplina,
      tema: matriz.tema,
      rodadas,
      referencia,
      verificacao,
      ultima,
      comparavel,
      motivo: comparavel ? null : motivo,
      interpretacao: comparavel
        ? interpretar(referencia!, verificacao!, o)
        : null,
    }
  })
}

/* O assunto em destaque na tela: a comparação válida mais recente; sem
   nenhuma, o tema mexido por último (primeiro resultado ou rodadas ainda
   incomparáveis). */
export function destaqueEvolucao(
  evolucoes: readonly EvolucaoTema[],
): EvolucaoTema | null {
  const comparadas = evolucoes.filter((e) => e.comparavel && e.verificacao)
  if (comparadas.length)
    return comparadas.reduce((a, b) =>
      a.verificacao!.instante >= b.verificacao!.instante ? a : b,
    )
  const comRodada = evolucoes.filter((e) => e.rodadas.length)
  if (!comRodada.length) return null
  return comRodada.reduce((a, b) =>
    a.rodadas[a.rodadas.length - 1]!.instante >=
    b.rodadas[b.rodadas.length - 1]!.instante
      ? a
      : b,
  )
}

/* Habilidades do tema em situação "boa" — evidência real de bom desempenho
   (acertos próprios, sem dificuldade recorrente), nunca inferida do nome do
   tema. A tela limita a quantidade e resolve os títulos pelo catálogo. */
export function habilidadesBoas(
  estado: EstadoAprendizagem,
  matriz: MatrizTema,
  agora = Date.now(),
  pr: Readonly<ParametrosRecomendacao> = PARAMETROS_RECOMENDACAO,
  pd: Readonly<ParametrosDominio> = PARAMETROS_DOMINIO,
): string[] {
  const evidencias = extrairEvidencias(estado, matriz)
  const essenciais = new Set(
    matriz.habilidades.filter((h) => h.essencial).map((h) => h.slug),
  )
  return matriz.habilidades
    .filter(
      (h) => situacaoHabilidade(evidencias, h.slug, agora, pr, pd) === 'boa',
    )
    .sort(
      (a, b) => Number(essenciais.has(b.slug)) - Number(essenciais.has(a.slug)),
    )
    .map((h) => h.slug)
}

/* ---------- Frases curtas para as telas ----------

   Os componentes compartilham estas duas resoluções de texto: o título do
   tema pelo catálogo e a frase-resumo de uma matéria. Textos de linha
   única, feitos para serem lidos de relance. */

export function tituloEvolucao(
  subjects: Record<string, CatalogSubject>,
  e: EvolucaoTema,
): string {
  return (
    subjects[e.disciplina]?.topics.find((t) => t.slug === e.tema)?.title ??
    e.tema
  )
}

export function fraseEvolucao(
  subjects: Record<string, CatalogSubject>,
  e: EvolucaoTema | null,
): string {
  if (!e || !e.rodadas.length) return 'Ainda não começou.'
  const tema = tituloEvolucao(subjects, e)
  if (e.comparavel) {
    if (e.interpretacao === 'melhorou') return `Você melhorou em ${tema}.`
    if (e.interpretacao === 'manteve') return `Bom desempenho em ${tema}.`
    return `Praticando ${tema}.`
  }
  return `Começou em ${tema}.`
}
