import { extrairEvidencias, ordenarEventos } from './evidencias'
import { PARAMETROS_DOMINIO } from './config'
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
    p.taxa > 1
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
  let verificacaoIndependente = false
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
      verificacaoIndependente = false
      continue
    }
    // Verificação por rodada independente: basta uma sessão posterior,
    // concluída, com acertos próprios em questões inéditas — sem esperar
    // horas nem virar o dia. As evidências já são uma por questão/família.
    if (
      marcoBomDesempenho &&
      sessao.id !== marcoBomDesempenho.sessaoId &&
      sessao.proprias.filter((e) => e.acertou).length >= p.confirmacaoMin
    )
      verificacaoIndependente = true
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
    verificacaoIndependente
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
    verificacaoIndependente,
  }
}

/* A % de aprendizado granulada (por habilidade) vive em recomendacao.ts —
   ela sai da situacaoHabilidade de cada essencial, não do estágio do tema. */
