import { avaliarDominio } from './dominio'
import { PARAMETROS_DOMINIO, PARAMETROS_PREPARACAO } from './config'
import type {
  DiagnosticoPreparacao,
  EstadoAprendizagem,
  MatrizTema,
  ParametrosDominio,
  ParametrosPreparacao,
} from './tipos'

function validarParametros(p: Readonly<ParametrosPreparacao>): void {
  if (
    !Number.isSafeInteger(p.minTemas) ||
    p.minTemas < 1 ||
    !Number.isSafeInteger(p.temasConfirmados) ||
    p.temasConfirmados < 1 ||
    p.temasConfirmados > p.minTemas
  )
    throw new Error('Parâmetros de preparação inválidos.')
}

export function avaliarPreparacao(
  estado: EstadoAprendizagem,
  matrizes: readonly MatrizTema[],
  pp: Readonly<ParametrosPreparacao> = PARAMETROS_PREPARACAO,
  pd: Readonly<ParametrosDominio> = PARAMETROS_DOMINIO,
): DiagnosticoPreparacao {
  validarParametros(pp)
  const detalhes = matrizes
    .filter(
      (m) =>
        m.validada && m.habilidades.some((h) => h.essencial),
    )
    .map((m) => ({
      disciplina: m.disciplina,
      tema: m.tema,
      estado: avaliarDominio(estado, m, pd).estado,
    }))
  const confirmados = detalhes.filter(
    (d) => d.estado === 'dominio-confirmado',
  ).length
  const bomDesempenho = detalhes.filter(
    (d) => d.estado === 'bom-desempenho' || d.estado === 'dominio-confirmado',
  ).length
  const estado_: DiagnosticoPreparacao['estado'] =
    detalhes.length < pp.minTemas
      ? 'sem-dados'
      : bomDesempenho === detalhes.length &&
          confirmados >= pp.temasConfirmados
        ? 'boa-preparacao'
        : 'em-progresso'
  return {
    estado: estado_,
    temasAvaliados: detalhes.length,
    confirmados,
    bomDesempenho,
    detalhes,
  }
}
