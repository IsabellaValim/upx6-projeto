import { extrairEvidencias } from './evidencias'
import { PARAMETROS_DOMINIO, PARAMETROS_RECOMENDACAO } from './config'
import type {
  DiagnosticoRecomendacao,
  EstadoAprendizagem,
  Evidencia,
  MatrizTema,
  MotivoRecomendacao,
  ParametrosDominio,
  ParametrosRecomendacao,
  RecomendacaoTema,
  SituacaoHabilidade,
} from './tipos'

const HORA_MS = 60 * 60 * 1000

function validarParametros(
  p: Readonly<ParametrosRecomendacao>,
  pd: Readonly<ParametrosDominio>,
): void {
  if (
    !Number.isFinite(p.revisaoHoras) ||
    p.revisaoHoras * HORA_MS < 1 ||
    p.revisaoHoras * HORA_MS > Number.MAX_SAFE_INTEGER ||
    !Number.isSafeInteger(pd.skillWindow) ||
    pd.skillWindow < 1 ||
    !Number.isSafeInteger(pd.skillCorrect) ||
    pd.skillCorrect < 1 ||
    pd.skillCorrect > pd.skillWindow ||
    !Number.isSafeInteger(pd.erroRecorrente) ||
    pd.erroRecorrente < 1 ||
    pd.erroRecorrente > pd.skillWindow
  )
    throw new Error('Parâmetros de recomendação inválidos.')
}

function recorrenciaResolvida(
  propria: readonly Evidencia[],
  pd: Readonly<ParametrosDominio>,
): boolean {
  const erros = propria.filter((e) => !e.acertou)
  if (erros.length < pd.erroRecorrente) return true
  const ultimo = propria.lastIndexOf(erros[erros.length - 1]!)
  return (
    propria.slice(ultimo + 1).filter((e) => e.acertou).length >= pd.skillCorrect
  )
}

export function situacaoHabilidade(
  evidencias: readonly Evidencia[],
  slug: string,
  agora: number,
  pr: Readonly<ParametrosRecomendacao>,
  pd: Readonly<ParametrosDominio>,
): SituacaoHabilidade {
  const propria = evidencias
    .filter((e) => e.habilidade === slug)
    .slice(-pd.skillWindow)
  if (!propria.length) return 'sem-evidencia'
  if (!recorrenciaResolvida(propria, pd)) return 'dificuldade'
  if (propria.filter((e) => e.acertou).length < pd.skillCorrect)
    return 'em-pratica'
  const ultima = propria[propria.length - 1]!
  return agora - ultima.instante >= pr.revisaoHoras * HORA_MS
    ? 'revisar'
    : 'boa'
}

const PRIORIDADE: Record<MotivoRecomendacao, number> = {
  dificuldade: 0,
  revisao: 1,
  'nova-habilidade': 2,
  continuar: 3,
}

function candidato(
  estado: EstadoAprendizagem,
  matriz: MatrizTema,
  agora: number,
  pr: Readonly<ParametrosRecomendacao>,
  pd: Readonly<ParametrosDominio>,
): RecomendacaoTema | null {
  if (!matriz.validada) return null
  const essenciais = matriz.habilidades.filter((h) => h.essencial)
  if (!essenciais.length) return null
  const evidencias = extrairEvidencias(estado, matriz)
  const situacoes = new Map(
    matriz.habilidades.map((h) => [
      h.slug,
      situacaoHabilidade(evidencias, h.slug, agora, pr, pd),
    ]),
  )
  const base = { disciplina: matriz.disciplina, tema: matriz.tema }
  const dificil = essenciais.find(
    (h) => situacoes.get(h.slug) === 'dificuldade',
  )
  if (dificil)
    return {
      ...base,
      motivo: 'dificuldade',
      habilidade: dificil.slug,
      revisarEm: null,
    }
  const revisoes = matriz.habilidades
    .filter((h) => situacoes.get(h.slug) === 'revisar')
    .map((h) => {
      const ultima = evidencias
        .filter((e) => e.habilidade === h.slug)
        .slice(-1)[0]!
      return {
        slug: h.slug,
        essencial: h.essencial,
        revisarEm: ultima.instante + pr.revisaoHoras * HORA_MS,
      }
    })
    .sort(
      (a, b) =>
        Number(b.essencial) - Number(a.essencial) || a.revisarEm - b.revisarEm,
    )
  if (revisoes.length)
    return {
      ...base,
      motivo: 'revisao',
      habilidade: revisoes[0]!.slug,
      revisarEm: revisoes[0]!.revisarEm,
    }
  const nova = essenciais.find((h) => situacoes.get(h.slug) === 'sem-evidencia')
  if (nova)
    return {
      ...base,
      motivo: 'nova-habilidade',
      habilidade: nova.slug,
      revisarEm: null,
    }
  const pendente = essenciais.find((h) => situacoes.get(h.slug) !== 'boa')
  if (pendente)
    return {
      ...base,
      motivo: 'continuar',
      habilidade: pendente.slug,
      revisarEm: null,
    }
  return null
}

/* % de aprendizado de um recorte (matéria ou prova): dentro de cada tema
   avaliável, a média do peso da situação de cada habilidade essencial —
   e depois a média dos temas (tema grande não vale mais que tema pequeno).
   'revisar' conta como aprendida: a evidência continua valendo, a revisão
   é só lembrete. Uma atividade move pontos percentuais, não dezenas —
   o número cresce no ritmo do conteúdo, não da interface. */
const PESO_SITUACAO: Record<SituacaoHabilidade, number> = {
  'sem-evidencia': 0,
  dificuldade: 0.1,
  'em-pratica': 0.4,
  revisar: 1,
  boa: 1,
}

export function aprendizadoPct(
  estado: EstadoAprendizagem,
  matrizes: readonly MatrizTema[],
  agora = Date.now(),
  pr: Readonly<ParametrosRecomendacao> = PARAMETROS_RECOMENDACAO,
  pd: Readonly<ParametrosDominio> = PARAMETROS_DOMINIO,
): number | null {
  const avaliaveis = matrizes.filter(
    (m) => m.validada && m.habilidades.some((h) => h.essencial),
  )
  if (!avaliaveis.length) return null
  const soma = avaliaveis.reduce((acc, m) => {
    const evidencias = extrairEvidencias(estado, m)
    const essenciais = m.habilidades.filter((h) => h.essencial)
    const porHabilidade =
      essenciais.reduce(
        (s, h) =>
          s +
          PESO_SITUACAO[situacaoHabilidade(evidencias, h.slug, agora, pr, pd)],
        0,
      ) / essenciais.length
    return acc + porHabilidade
  }, 0)
  return Math.round((100 * soma) / avaliaveis.length)
}

export function recomendar(
  estado: EstadoAprendizagem,
  matrizes: readonly MatrizTema[],
  agora: number,
  pr: Readonly<ParametrosRecomendacao> = PARAMETROS_RECOMENDACAO,
  pd: Readonly<ParametrosDominio> = PARAMETROS_DOMINIO,
): DiagnosticoRecomendacao {
  validarParametros(pr, pd)
  if (!Number.isFinite(agora) || agora < 0)
    throw new Error('Instante de referência inválido.')
  const candidatos = matrizes
    .map((m, i) => ({ i, r: candidato(estado, m, agora, pr, pd) }))
    .filter((c): c is { i: number; r: RecomendacaoTema } => c.r !== null)
  candidatos.sort(
    (a, b) =>
      PRIORIDADE[a.r.motivo] - PRIORIDADE[b.r.motivo] ||
      (a.r.revisarEm ?? Number.MAX_SAFE_INTEGER) -
        (b.r.revisarEm ?? Number.MAX_SAFE_INTEGER) ||
      a.i - b.i,
  )
  return {
    recomendacao: candidatos[0]?.r ?? null,
    candidatos: candidatos.map((c) => c.r),
  }
}
