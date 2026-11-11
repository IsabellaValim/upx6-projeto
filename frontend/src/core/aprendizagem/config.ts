import type {
  ConfiguracaoAprendizagem,
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
    // Apenas critérios experimentais: falta matriz oficial e simulado representativo.
    habilitarConclusaoFavoravel: false,
  })

export const CONFIG_APRENDIZAGEM: Readonly<ConfiguracaoAprendizagem> =
  Object.freeze({
    habilitado: true,
    registrarEventos: true,
    dominio: true,
    recomendacoes: true,
    disciplinas: Object.freeze([
      'matematica',
      'linguagens',
      'matematica-fundamental',
      'linguagens-fundamental',
    ]),
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
