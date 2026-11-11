import { extrairEvidencias, ordenarEventos } from './evidencias'
import { CONFIG_DEMONSTRACAO, PARAMETROS_DOMINIO } from './config'
import type {
  ConfiguracaoDemonstracao,
  DiagnosticoDemonstracao,
  IteracaoDemonstracao,
} from './tipos'

export function avaliarDemonstracao(
  iteracoes: readonly IteracaoDemonstracao[],
  config: ConfiguracaoDemonstracao = CONFIG_DEMONSTRACAO,
): DiagnosticoDemonstracao {
  if (
    config.modo !== 'demonstracao' ||
    !Number.isSafeInteger(config.metaIteracoes) ||
    config.metaIteracoes < 1 ||
    !Number.isSafeInteger(config.minimoQuestoes) ||
    config.minimoQuestoes < 1 ||
    !Number.isFinite(config.taxaMinima) ||
    config.taxaMinima <= 0 ||
    config.taxaMinima > 1
  )
    throw new Error('Configuração de demonstração inválida.')
  const vistas = new Set<string>()
  let iteracoesConcluidas = 0
  for (const i of iteracoes) {
    if (!i.id.trim() || vistas.has(i.id)) continue
    vistas.add(i.id)
    if (
      Number.isSafeInteger(i.total) &&
      Number.isSafeInteger(i.acertos) &&
      i.total >= config.minimoQuestoes &&
      i.acertos >= 0 &&
      i.acertos <= i.total &&
      i.acertos / i.total >= config.taxaMinima
    )
      iteracoesConcluidas++
  }
  return {
    estado: 'demonstracao',
    iteracoesConcluidas,
    metaIteracoes: config.metaIteracoes,
    progresso: Math.min(1, iteracoesConcluidas / config.metaIteracoes),
    concluida: iteracoesConcluidas >= config.metaIteracoes,
    dominioConfirmado: false,
    confirmacaoTemporal: false,
  }
}
import type {
  DiagnosticoDominio,
  EstadoAprendizagem,
  Evidencia,
  MatrizTema,
  ParametrosDominio,
} from './tipos'

const taxaAcerto = (e: readonly Evidencia[]) =>
  e.length ? e.filter((x) => x.acertou).length / e.length : 0

function validarParametros(p: Readonly<ParametrosDominio>): void {
  const contagens = [
    p.window,
    p.min,
    p.boaMin,
    p.skillWindow,
    p.skillCorrect,
    p.erroRecorrente,
    p.confirmacaoMin,
  ]
  if (
    contagens.some((n) => !Number.isSafeInteger(n) || n < 1) ||
    p.window > 8 ||
    p.min > p.window ||
    p.boaMin > p.min ||
    p.skillCorrect > p.skillWindow ||
    p.erroRecorrente > p.skillWindow ||
    p.confirmacaoMin > p.window ||
    !Number.isFinite(p.taxa) ||
    p.taxa <= 0 ||
    p.taxa > 1 ||
    !Number.isFinite(p.confirmacaoHoras) ||
    p.confirmacaoHoras * 60 * 60 * 1000 < 1 ||
    p.confirmacaoHoras * 60 * 60 * 1000 > Number.MAX_SAFE_INTEGER
  )
    throw new Error('Parâmetros de domínio inválidos.')
}

function criterios(
  evidencias: Evidencia[],
  matriz: MatrizTema,
  p: Readonly<ParametrosDominio>,
) {
  const janela = evidencias.slice(-p.window)
  const taxa = taxaAcerto(janela)
  const essenciais = matriz.habilidades.filter((h) => h.essencial)
  const essenciaisAtendidas =
    matriz.validada &&
    essenciais.length > 0 &&
    essenciais.every(
      (h) =>
        evidencias
          .filter((e) => e.habilidade === h.slug)
          .slice(-p.skillWindow)
          .filter((e) => e.acertou).length >= p.skillCorrect,
    )
  const recorrenciasResolvidas = essenciais.every((h) => {
    const propria = evidencias
      .filter((e) => e.habilidade === h.slug)
      .slice(-p.skillWindow)
    const erros = propria.filter((e) => !e.acertou)
    if (erros.length < p.erroRecorrente) return true
    const ultimo = propria.lastIndexOf(erros[erros.length - 1]!)
    return (
      propria.slice(ultimo + 1).filter((e) => e.acertou).length >=
      p.skillCorrect
    )
  })
  return {
    janela,
    taxa,
    essenciaisAtendidas,
    recorrenciasResolvidas,
    bom: janela.length >= p.boaMin && taxa >= p.taxa,
  }
}

export function avaliarDominio(
  estado: EstadoAprendizagem,
  matriz: MatrizTema,
  p: Readonly<ParametrosDominio> = PARAMETROS_DOMINIO,
): DiagnosticoDominio {
  validarParametros(p)
  const evidencias = extrairEvidencias(estado, matriz)
  const base = criterios(evidencias, matriz, p)
  const eventos = ordenarEventos(
    estado.eventos.filter((e) => e.geracao === estado.controle.geracao),
  )
  const submissoes = eventos.filter((e) => e.tipo === 'submissao')
  const sessoes = [
    ...new Set(
      evidencias
        .map((e) => e.sessaoId)
        .concat(
          submissoes
            .filter(
              (e) =>
                e.disciplina === matriz.disciplina && e.tema === matriz.tema,
            )
            .map((e) => e.sessaoId),
        ),
    ),
  ]
    .map((id) => {
      const todas = submissoes.filter((e) => e.sessaoId === id)
      const escopo = todas.filter(
        (e) => e.disciplina === matriz.disciplina && e.tema === matriz.tema,
      )
      const proprias = evidencias.filter((e) => e.sessaoId === id)
      return {
        id,
        primeira: todas[0]!,
        ultima: todas[todas.length - 1]!,
        escopo,
        proprias,
      }
    })
    .sort(
      (a, b) =>
        a.ultima.instante - b.ultima.instante ||
        (a.ultima.sequencia ?? 0) - (b.ultima.sequencia ?? 0) ||
        a.id.localeCompare(b.id),
    )
  let marcoBomDesempenho: Evidencia | null = null
  let confirmacaoTemporal = false
  for (const sessao of sessoes) {
    const ateAqui = evidencias.filter(
      (e) =>
        e.instante < sessao.ultima.instante ||
        (e.instante === sessao.ultima.instante &&
          (e.sequencia === undefined ||
            sessao.ultima.sequencia === undefined ||
            e.sequencia <= sessao.ultima.sequencia)),
    )
    const parcial = criterios(ateAqui, matriz, p)
    const eventosSessao = eventos.filter((e) => e.sessaoId === sessao.id)
    const fechada = estado.conclusoes.some(
      (f) =>
        f.geracao === estado.controle.geracao &&
        f.sessaoId === sessao.id &&
        f.eventoIds.length === eventosSessao.length &&
        eventosSessao.every(
          (e) => f.eventoIds.includes(e.id) && e.instante <= f.instante,
        ),
    )
    const valida = fechada && sessao.proprias.length > 0
    if (!sessao.proprias.length) continue
    const boa = valida && taxaAcerto(sessao.proprias) >= p.taxa
    if (!boa || !parcial.bom || !parcial.recorrenciasResolvidas) {
      marcoBomDesempenho = null
      confirmacaoTemporal = false
      continue
    }
    if (
      marcoBomDesempenho &&
      sessao.id !== marcoBomDesempenho.sessaoId &&
      sessao.primeira.instante - marcoBomDesempenho.instante >=
        p.confirmacaoHoras * 60 * 60 * 1000 &&
      sessao.primeira.dataLocal !== marcoBomDesempenho.dataLocal &&
      sessao.proprias.every(
        (e) => e.dataLocal !== marcoBomDesempenho!.dataLocal,
      ) &&
      sessao.proprias.filter((e) => e.acertou).length >= p.confirmacaoMin
    )
      confirmacaoTemporal = true
    if (!marcoBomDesempenho) {
      const ultima = sessao.proprias[sessao.proprias.length - 1]!
      marcoBomDesempenho = {
        ...ultima,
        instante: sessao.ultima.instante,
        dataLocal: sessao.ultima.dataLocal,
      }
    }
  }
  const dominio =
    base.bom &&
    base.janela.length >= p.min &&
    base.essenciaisAtendidas &&
    base.recorrenciasResolvidas &&
    confirmacaoTemporal
  return {
    estado: dominio
      ? 'dominio-confirmado'
      : base.bom
        ? 'bom-desempenho'
        : base.janela.length
          ? 'em-pratica'
          : 'insuficiente',
    janela: base.janela,
    taxa: base.taxa,
    essenciaisAtendidas: base.essenciaisAtendidas,
    recorrenciasResolvidas: base.recorrenciasResolvidas,
    marcoBomDesempenho,
    confirmacaoTemporal,
  }
}
