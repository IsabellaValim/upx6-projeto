import type {
  EstadoAprendizagem,
  EventoAprendizagem,
  Evidencia,
  MatrizTema,
  MetadadosQuestao,
} from './tipos'

export function metadadosValidos(
  m: MetadadosQuestao | null | undefined,
): m is MetadadosQuestao {
  return (
    !!m &&
    m.revisao === 'aprovada' &&
    m.elegivel &&
    !!m.habilidade &&
    !!m.familia &&
    Number.isInteger(m.versao) &&
    m.versao > 0
  )
}

export function ordenarEventos(
  eventos: readonly EventoAprendizagem[],
): EventoAprendizagem[] {
  const ordem = {
    ajuda: 0,
    apresentacao: 1,
    submissao: 2,
    correcao: 3,
    exposicao: 4,
  }
  return [...eventos].sort(
    (a, b) =>
      a.instante - b.instante ||
      (a.sequencia !== undefined && b.sequencia !== undefined
        ? a.sequencia - b.sequencia
        : 0) ||
      ordem[a.tipo] - ordem[b.tipo] ||
      a.id.localeCompare(b.id),
  )
}

export function extrairEvidencias(
  estado: EstadoAprendizagem,
  matriz: MatrizTema,
): Evidencia[] {
  if (estado.controle.resetPendente) return []
  const eventos = ordenarEventos(
    estado.eventos.filter((e) => e.geracao === estado.controle.geracao),
  )
  const atuais = new Map(matriz.questoes.map((q) => [q.codigo, q]))
  const questoes = new Set<string>()
  const familias = new Set<string>()
  const exposicoes = new Set<string>()
  const ajudas = new Set<string>()
  const pendentes = new Set<string>()
  const evidencias: Evidencia[] = []
  const correcoes = new Map<string, EventoAprendizagem[]>()
  for (const e of eventos) {
    if (e.tipo === 'correcao' && e.tentativaId) {
      const chave = JSON.stringify([e.sessaoId, e.tentativaId])
      correcoes.set(chave, [...(correcoes.get(chave) ?? []), e])
    }
  }
  for (const e of eventos) {
    if (e.disciplina !== matriz.disciplina || e.tema !== matriz.tema) continue
    const atual = atuais.get(e.codigo)?.pedagogia
    const familia = e.metadados?.familia ?? atual?.familia
    const marcas = [`q:${e.codigo}`, ...(familia ? [`f:${familia}`] : [])]
    if (e.tipo === 'ajuda') marcas.forEach((m) => ajudas.add(m))
    if (e.tipo === 'exposicao') marcas.forEach((m) => exposicoes.add(m))
    if (e.tipo !== 'submissao') continue
    const repetida = marcas.some(
      (m) => pendentes.has(m) || exposicoes.has(m) || ajudas.has(m),
    )
    marcas.forEach((m) => pendentes.add(m))
    const m = e.metadados
    if (
      !metadadosValidos(m) ||
      !metadadosValidos(atual) ||
      m.versao !== atual.versao ||
      m.habilidade !== atual.habilidade ||
      m.familia !== atual.familia ||
      !e.confiavel ||
      !Number.isFinite(e.instante) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(e.dataLocal) ||
      e.incerta ||
      !e.respondeu ||
      !e.respostaTexto?.trim() ||
      !e.revisaoApi ||
      (atuais.get(e.codigo)?.revisaoApi !== undefined &&
        atuais.get(e.codigo)?.revisaoApi !== e.revisaoApi) ||
      repetida ||
      !e.tentativaId ||
      !matriz.habilidades.some((h) => h.slug === m.habilidade)
    )
      continue
    const cs = correcoes.get(JSON.stringify([e.sessaoId, e.tentativaId])) ?? []
    if (cs.length !== 1) continue
    const c = cs[0]!
    if (
      c.codigo !== e.codigo ||
      c.disciplina !== e.disciplina ||
      c.tema !== e.tema ||
      c.modalidade !== e.modalidade ||
      !Number.isFinite(c.instante) ||
      c.instante < e.instante ||
      !c.confiavel ||
      c.incerta ||
      !c.revisaoApi ||
      c.revisaoApi !== e.revisaoApi ||
      typeof c.acertou !== 'boolean'
    )
      continue
    if (
      e.modalidade === 'simulado' &&
      !estado.conclusoes.some(
        (f) =>
          f.geracao === e.geracao &&
          f.sessaoId === e.sessaoId &&
          f.instante >= c.instante &&
          f.eventoIds.includes(e.id) &&
          f.eventoIds.includes(c.id),
      )
    )
      continue
    if (
      eventos.some(
        (x) =>
          x.tipo === 'ajuda' &&
          x.instante >= e.instante &&
          x.instante <= c.instante &&
          x.disciplina === e.disciplina &&
          x.tema === e.tema &&
          (x.codigo === e.codigo || x.metadados?.familia === m.familia),
      )
    )
      continue
    if (questoes.has(e.codigo) || familias.has(m.familia)) continue
    questoes.add(e.codigo)
    familias.add(m.familia)
    evidencias.push({
      eventoId: e.id,
      sessaoId: e.sessaoId,
      codigo: e.codigo,
      familia: m.familia,
      habilidade: m.habilidade,
      instante: e.instante,
      dataLocal: e.dataLocal,
      acertou: c.acertou,
      ...(e.sequencia !== undefined ? { sequencia: e.sequencia } : {}),
    })
  }
  return evidencias
}
