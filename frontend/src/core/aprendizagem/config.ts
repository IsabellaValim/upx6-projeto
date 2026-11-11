import type {
  ConfiguracaoAprendizagem,
  ConfiguracaoDemonstracao,
  ParametrosDominio,
  ParametrosPreparacao,
  ParametrosRecomendacao,
} from './tipos'

export const PARAMETROS_DOMINIO: Readonly<ParametrosDominio> = Object.freeze({
  window: 8,
  min: 6,
  taxa: 0.8,
  boaMin: 4,
  skillWindow: 4,
  skillCorrect: 2,
  erroRecorrente: 2,
  confirmacaoHoras: 48,
  confirmacaoMin: 2,
})

export const PARAMETROS_RECOMENDACAO: Readonly<ParametrosRecomendacao> =
  Object.freeze({
    revisaoHoras: 72,
  })

export const PARAMETROS_PREPARACAO: Readonly<ParametrosPreparacao> =
  Object.freeze({
    minTemas: 3,
    temasConfirmados: 2,
  })

export const CONFIG_DEMONSTRACAO: Readonly<ConfiguracaoDemonstracao> =
  Object.freeze({
    modo: 'demonstracao',
    metaIteracoes: 3,
    minimoQuestoes: 2,
    taxaMinima: 0.8,
  })

export const CONFIG_APRENDIZAGEM: Readonly<ConfiguracaoAprendizagem> =
  Object.freeze({
    habilitado: false,
    registrarEventos: false,
    dominio: false,
    recomendacoes: false,
    disciplinas: Object.freeze([] as string[]),
    temas: Object.freeze([] as string[]),
  })

const lista = (v: unknown): v is readonly string[] =>
  Array.isArray(v) &&
  v.every((x) => typeof x === 'string' && x.trim().length > 0)
const listaTemas = (v: unknown): v is readonly string[] =>
  lista(v) &&
  v.every((x) => {
    const partes = x.split('/')
    return partes.length === 2 && partes.every((p) => p.trim().length > 0)
  })

export function aprendizagemAtiva(
  config: ConfiguracaoAprendizagem,
  disciplina?: string,
  tema?: string,
): boolean {
  if (
    typeof config.habilitado !== 'boolean' ||
    typeof config.registrarEventos !== 'boolean' ||
    typeof config.dominio !== 'boolean' ||
    typeof config.recomendacoes !== 'boolean' ||
    !lista(config.disciplinas) ||
    (config.temas !== undefined && !listaTemas(config.temas))
  )
    return false
  const escopoDisponivel =
    config.temas === undefined
      ? config.disciplinas.length > 0
      : config.temas.length > 0
  if (!config.habilitado || !config.registrarEventos || !escopoDisponivel)
    return false
  if (disciplina === undefined) return true
  if (config.temas !== undefined) {
    if (tema === undefined) return false
    return config.temas.includes(`${disciplina}/${tema}`)
  }
  return config.disciplinas.includes(disciplina)
}
