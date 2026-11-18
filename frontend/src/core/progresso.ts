/* ==========================================================
   Progresso na conta (docs/api.md, "Progresso do aluno").

   As telas continuam lendo o store (results, watched), que segue
   salvo no localStorage. Com conta, este módulo:
   - manda cada lição/simulado terminado e cada aula vista para a API;
   - sincroniza ao entrar (e a cada abertura do app): sobe o que só
     existe no aparelho (importar) e traz o que veio de outro aparelho.
   A API é idempotente pela chave: reenviar nunca duplica, então
   qualquer falha de rede se resolve na próxima sincronização.
   Visitante: nada disso roda.
   ========================================================== */
import { api } from './api'
import { carregarCatalogo } from './catalogo'
import { useApp } from './store'
import type {
  CatalogSubject,
  ResultItem,
  Resultado,
  SessaoDetalheApi,
  SessaoEnvioApi,
  SessaoResumoApi,
} from '../types'

type Materias = Record<string, CatalogSubject>

const DIA_MS = 24 * 60 * 60 * 1000
const LOTE_SESSOES = 500 // limites do POST /importar
const LOTE_AULAS = 1000

const logado = () => {
  const u = useApp.getState().user
  return !!u && !u.guest
}

export function novaChave(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  )
}

/* Chave da sessão. Resultado antigo (de antes da conta) não tem: usa a data,
   que é sempre a mesma para a mesma entrada, então reimportar não duplica. */
export const chaveDe = (r: Resultado): string => r.chave ?? `local:${r.date}`

/* ---------- Conversões (puras, testadas em progresso.test.ts) ---------- */

/* "materia/tema/aula" (posições, como em estudae:watched) → id da vídeo-aula. */
export function aulaDaChave(key: string, materias: Materias): number | null {
  const [slug, ti, li] = key.split('/')
  return materias[slug]?.topics[+ti]?.lessons[+li]?.id ?? null
}

/* id da vídeo-aula → "materia/tema/aula". */
export function chaveDaAula(id: number, materias: Materias): string | null {
  for (const s of Object.values(materias))
    for (const [ti, t] of s.topics.entries()) {
      const li = t.lessons.findIndex((l) => l.id === id)
      if (li >= 0) return `${s.id}/${ti}/${li}`
    }
  return null
}

/* Resultado do aparelho → corpo do POST. null = não dá para enviar (quiz
   antigo por matéria, tema que saiu do catálogo, questão sem id). */
export function paraSessao(
  r: Resultado,
  materias: Materias,
): SessaoEnvioApi | null {
  if (r.v < 3) return null
  const s = materias[r.subject]
  if (!s || r.items.length === 0 || r.items.some((i) => i.id === undefined))
    return null
  const sim = r.kind === 'simulado'
  const tema = sim
    ? null
    : r.topic !== undefined
      ? s.topics[r.topic]?.slug
      : undefined
  if (tema === undefined) return null
  // O front não guarda o início da lição; no simulado, início = fim - tempo usado.
  const usado = sim ? Math.min(Math.max(0, r.usedMs ?? 0), DIA_MS) : 0
  return {
    chave: chaveDe(r),
    tipo: sim ? 'simulado' : 'licao',
    disciplina: r.subject,
    tema,
    treino: sim && !!r.treino,
    iniciadaEm: new Date(r.date - usado).toISOString(),
    concluidaEm: new Date(r.date).toISOString(),
    tempoLimiteSeg: sim && r.limitMs ? Math.round(r.limitMs / 1000) : null,
    respostas: r.items.map((i) => ({
      questaoId: i.id!,
      alternativa:
        i.chosen === undefined ? null : (i.options[i.chosen] ?? null),
    })),
  }
}

const posicaoDoTema = (s: CatalogSubject, slug: string) => {
  const i = s.topics.findIndex((t) => t.slug === slug)
  return i >= 0 ? i : undefined
}

// Tema com mais erros (como o Simulado.tsx calcula na entrega).
function temaMaisFraco(items: ResultItem[]): number | null {
  const erros: Record<number, number> = {}
  for (const x of items)
    if (!x.ok && x.topic !== undefined)
      erros[x.topic] = (erros[x.topic] ?? 0) + 1
  const pior = Object.keys(erros).sort((a, b) => erros[+b] - erros[+a])[0]
  return pior === undefined ? null : +pior
}

/* Sessão da API (só o resumo) → Resultado das telas. Sem enunciado e sem
   correção (incompleto: a tela de Resultado busca ao abrir); o que as contas
   de progresso usam (id, tema e acerto de cada questão) já vem completo. */
export function deSessao(
  s: SessaoResumoApi,
  materias: Materias,
): Resultado | null {
  const m = materias[s.disciplina]
  if (!m) return null
  const sim = s.tipo === 'simulado'
  const topic = s.tema ? posicaoDoTema(m, s.tema) : undefined
  if (!sim && topic === undefined) return null
  const items: ResultItem[] = s.tentativas.map((t) => ({
    id: t.questaoId,
    topic: posicaoDoTema(m, t.tema),
    ask: '',
    options: [],
    chosen: undefined,
    answer: -1,
    why: '',
    ok: t.acertou,
  }))
  const fim = Date.parse(s.concluidaEm)
  return {
    v: 3,
    ...(sim ? { kind: 'simulado' as const } : { topic }),
    subject: s.disciplina,
    date: fim,
    correct: s.acertos,
    total: s.total,
    items,
    weakTopic: sim ? temaMaisFraco(items) : s.acertos < s.total ? topic! : null,
    ...(sim && {
      treino: s.treino,
      usedMs: fim - Date.parse(s.iniciadaEm),
      limitMs: (s.tempoLimiteSeg ?? 0) * 1000,
    }),
    chave: s.chave,
    remoto: s.id,
    incompleto: true,
  }
}

/* Junta a correção (GET /sessoes/{id}) num Resultado incompleto. */
export function completar(
  r: Resultado,
  d: SessaoDetalheApi,
  materias: Materias,
): Resultado {
  const m = materias[r.subject]
  const sim = r.kind === 'simulado'
  const items = d.questoes.map((q): ResultItem => {
    const escolhida =
      q.escolhida === null ? -1 : q.alternativas.indexOf(q.escolhida)
    return {
      id: q.questaoId,
      topic: m ? posicaoDoTema(m, q.tema) : undefined,
      ask: q.enunciado,
      options: q.alternativas,
      chosen: escolhida >= 0 ? escolhida : undefined,
      answer: q.alternativas.indexOf(q.respostaCorreta),
      why:
        (sim && q.escolhida === null
          ? 'Você não respondeu esta questão. '
          : '') + q.resolucao,
      ok: q.acertou,
    }
  })
  return { ...r, items, incompleto: false }
}

/* Junta o que está no aparelho com o que está na conta. Nada some: o que é
   só local continua (e sobe na próxima vez), o que é só da conta entra. */
export function mesclar(
  results: Resultado[],
  watched: Record<string, number>,
  servidor: {
    sessoes: SessaoResumoApi[]
    aulas: { videoaulaId: number; assistidaEm: string }[]
  },
  recusadas: Set<string>,
  materias: Materias,
): { results: Resultado[]; watched: Record<string, number> } {
  const porChave = new Map(servidor.sessoes.map((s) => [s.chave, s]))
  const juntos = results.map((r): Resultado => {
    const k = chaveDe(r)
    const s = porChave.get(k)
    if (s) return { ...r, chave: k, remoto: s.id }
    if (recusadas.has(k)) return { ...r, semSync: true }
    return r
  })
  const locais = new Set(juntos.map(chaveDe))
  for (const s of servidor.sessoes) {
    if (locais.has(s.chave)) continue
    const r = deSessao(s, materias)
    if (r) juntos.push(r)
  }
  juntos.sort((a, b) => a.date - b.date) // estável: empate fica na ordem que estava

  const aulas = { ...watched }
  for (const a of servidor.aulas) {
    const key = chaveDaAula(a.videoaulaId, materias)
    if (key && !aulas[key]) aulas[key] = Date.parse(a.assistidaEm)
  }
  return { results: juntos, watched: aulas }
}

/* ---------- Com a API ---------- */

let emVoo: Promise<void> | null = null

/* Ao entrar e a cada abertura do app com conta. Chamadas paralelas dividem
   a mesma ida. Falha (sem rede, Render acordando) não mexe em nada. */
export function sincronizarProgresso(): Promise<void> {
  if (!logado()) return Promise.resolve()
  emVoo ??= sincronizar()
    .catch((e) => {
      // Fica para a próxima sincronização; o warn deixa a falha visível.
      console.warn('[progresso] sincronização falhou:', e)
    })
    .finally(() => {
      emVoo = null
    })
  return emVoo
}

async function sincronizar(): Promise<void> {
  await carregarCatalogo()
  const email = useApp.getState().user?.email
  // Saiu (ou trocou de conta) enquanto a resposta vinha: não mexe.
  const mesmaConta = () => logado() && useApp.getState().user?.email === email

  let servidor = await api.progresso.listar()
  if (!mesmaConta()) return

  const { results, watched, subjects } = useApp.getState()
  const naConta = new Set(servidor.sessoes.map((s) => s.chave))
  const recusadas = new Set<string>()
  const envio: SessaoEnvioApi[] = []
  for (const r of results) {
    if (r.remoto !== undefined || r.semSync || naConta.has(chaveDe(r))) continue
    const s = paraSessao(r, subjects)
    if (s) envio.push(s)
    else recusadas.add(chaveDe(r))
  }
  const aulasNaConta = new Set(servidor.aulas.map((a) => a.videoaulaId))
  const aulas = Object.entries(watched).flatMap(([key, quando]) => {
    const id = aulaDaChave(key, subjects)
    return id === null || aulasNaConta.has(id)
      ? []
      : [{ videoaulaId: id, assistidaEm: new Date(quando).toISOString() }]
  })

  if (envio.length > 0 || aulas.length > 0) {
    const lotes = Math.max(
      Math.ceil(envio.length / LOTE_SESSOES),
      Math.ceil(aulas.length / LOTE_AULAS),
    )
    for (let i = 0; i < lotes; i++) {
      const sessoes = envio.slice(i * LOTE_SESSOES, (i + 1) * LOTE_SESSOES)
      const r = await api.progresso.importar(
        sessoes,
        aulas.slice(i * LOTE_AULAS, (i + 1) * LOTE_AULAS),
      )
      for (const ig of r.sessoesIgnoradas)
        recusadas.add(sessoes[ig.posicao].chave)
    }
    servidor = await api.progresso.listar()
    if (!mesmaConta()) return
  }

  // Lê de novo: uma lição pode ter terminado enquanto a rede trabalhava.
  const agora = useApp.getState()
  const juntos = mesclar(
    agora.results,
    agora.watched,
    servidor,
    recusadas,
    agora.subjects,
  )
  agora.setResults(juntos.results)
  agora.setWatchedTodos(juntos.watched)
}

/* Lição ou simulado terminado: guarda no aparelho (como sempre) e, com
   conta, manda para a API. Devolve a chave (a URL do Resultado usa). */
export function registrarResultado(r: Resultado): string {
  const chave = r.chave ?? novaChave()
  const comChave = { ...r, chave }
  useApp.getState().pushResult(comChave)
  if (logado()) void enviar(comChave)
  return chave
}

async function enviar(r: Resultado): Promise<void> {
  const s = paraSessao(r, useApp.getState().subjects)
  if (!s) return
  try {
    const salvo = await api.progresso.gravar(s)
    const { results, setResults } = useApp.getState()
    setResults(
      results.map((x) =>
        x.chave === r.chave ? { ...x, remoto: salvo.id } : x,
      ),
    )
  } catch (e) {
    // Sem rede: continua só no aparelho e sobe na próxima sincronização.
    console.warn('[progresso] envio da sessão falhou:', e)
  }
}

/* Aula vista ("materia/tema/aula"). Falha de rede: sobe na sincronização. */
export function marcarAula(key: string): void {
  const { watched, setWatched, subjects } = useApp.getState()
  if (watched[key]) return
  setWatched(key)
  const id = aulaDaChave(key, subjects)
  if (logado() && id !== null)
    api.progresso.marcarAula(id).catch((e) => {
      // Idem: sobe na próxima sincronização.
      console.warn('[progresso] marcação de aula falhou:', e)
    })
}

/* Correção de uma sessão que veio de outro aparelho (tela de Resultado). */
export async function carregarCorrecao(chave: string): Promise<void> {
  const { results } = useApp.getState()
  const r = results.find((x) => chaveDe(x) === chave)
  if (!r?.incompleto || r.remoto === undefined) return
  const d = await api.progresso.detalhe(r.remoto)
  const agora = useApp.getState()
  agora.setResults(
    agora.results.map((x) =>
      chaveDe(x) === chave ? completar(x, d, agora.subjects) : x,
    ),
  )
}
