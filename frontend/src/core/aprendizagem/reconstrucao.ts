/* Reconstrói evidências de aprendizagem a partir do histórico de
   resultados — o que a conta trouxe do banco ou o que ficou só no
   aparelho — quando o motor não gravou aquelas sessões: período em que
   as questões vinham sem código, ou o uso em outro dispositivo/aba.

   A leitura devolve um estado mesclado: o real (IndexedDB) mais os
   eventos sintetizados do histórico. Nada é gravado — é só a visão que
   as avaliações (evolução, domínio, recomendação, jornada) consomem.
   Cada resultado vira uma sessão "conta:<chave>" com o par
   submissão+correção que a extração exige e a conclusão que sessões
   fechadas pedem; a deduplicação por questão/família já é da extração.

   O pareamento resultado → questão é pelo enunciado: o id numérico do
   item não é confiável depois de troca/reimportação do conteúdo, e o
   texto é a única âncora que sobrevive a isso. */
import { api } from '../api'
import { carregarQuestoes } from '../catalogo'
import { chaveDe } from '../progresso'
import { useApp } from '../store'
import type { CatalogSubject, Resultado, SessaoDetalheApi } from '../../types'
import type {
  ConclusaoAprendizagem,
  EstadoAprendizagem,
  EventoAprendizagem,
  MetadadosQuestao,
} from './tipos'

type Materias = Record<string, CatalogSubject>

/* Dados de aprendizagem de uma questão, recuperados do endpoint de
   questões do tema (id + codigo + pedagogia + revisão do conteúdo). */
export interface QuestaoMapeada {
  codigo: string
  pedagogia: MetadadosQuestao | null
  revisaoApi?: string
}

const norm = (s: string) => s.replace(/\s+/g, ' ').trim()

const dataDe = (ms: number) => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/* ---------- busca das âncoras (cache por tema e por sessão) ---------- */

// "disciplina/posição do tema" → enunciado normalizado → QuestaoMapeada.
const mapas = new Map<string, Promise<Map<string, QuestaoMapeada>>>()

function mapaDoTema(
  disciplina: string,
  ti: number,
): Promise<Map<string, QuestaoMapeada>> {
  const k = `${disciplina}/${ti}`
  let p = mapas.get(k)
  if (!p) {
    p = carregarQuestoes(useApp.getState().subjects, disciplina, ti).then(
      (qs) =>
        new Map(
          qs
            .filter((q) => !!q.codigo)
            .map((q) => [
              norm(q.ask),
              {
                codigo: q.codigo!,
                pedagogia: q.pedagogia,
                revisaoApi: q.revisaoConteudo,
              },
            ]),
        ),
    )
    mapas.set(k, p)
  }
  return p
}

// Sessão remota (resultado "incompleto") → correção com os enunciados.
const detalhes = new Map<number, Promise<SessaoDetalheApi | null>>()

function detalheDe(id: number): Promise<SessaoDetalheApi | null> {
  let p = detalhes.get(id)
  if (!p) {
    p = api.progresso.detalhe(id).catch(() => null)
    detalhes.set(id, p)
  }
  return p
}

/* ---------- síntese (pura, testável) ---------- */

interface ItemCandidato {
  ti: number // posição do tema na disciplina
  enunciado: string
  ok: boolean
  respondeu: boolean
}

/* Uma sessão reconstruída: par submissão+correção por questão (a
   extração exige os dois no mesmo sessaoId/tentativaId) e a conclusão
   que sessões simulado/rodada pedem — inserir sempre é inofensivo. */
export function sintetizarSessao(
  r: Resultado,
  disciplina: string,
  itens: { tema: string; q: QuestaoMapeada; ok: boolean; respondeu: boolean }[],
  geracao: number,
): { eventos: EventoAprendizagem[]; conclusao: ConclusaoAprendizagem } {
  const sessaoId = `conta:${chaveDe(r)}`
  const modalidade: EventoAprendizagem['modalidade'] =
    r.kind === 'simulado' ? 'simulado' : 'licao'
  const dataLocal = dataDe(r.date)
  const eventos: EventoAprendizagem[] = []
  for (const [i, it] of itens.entries()) {
    const tentativaId = `${sessaoId}/${i}`
    const comum = {
      geracao,
      sessaoId,
      modalidade,
      dataLocal,
      codigo: it.q.codigo,
      disciplina,
      tema: it.tema,
      tentativaId,
      metadados: it.q.pedagogia ? { ...it.q.pedagogia } : null,
      confiavel: true,
      incerta: false,
      revisaoApi: it.q.revisaoApi,
    }
    eventos.push(
      {
        ...comum,
        id: `${tentativaId}:submissao`,
        tipo: 'submissao',
        instante: r.date + i * 2,
        respondeu: it.respondeu,
        ...(it.respondeu ? { respostaTexto: '(respondida)' } : {}),
      },
      {
        ...comum,
        id: `${tentativaId}:correcao`,
        tipo: 'correcao',
        instante: r.date + i * 2 + 1,
        acertou: it.ok,
      },
    )
  }
  return {
    eventos,
    conclusao: {
      id: sessaoId,
      sessaoId,
      geracao,
      instante: r.date + itens.length * 2 + 5,
      eventoIds: eventos.map((e) => e.id).sort(),
    },
  }
}

/* ---------- orquestração ---------- */

type ResolverTema = (
  disciplina: string,
  ti: number,
) => Promise<Map<string, QuestaoMapeada>>
type BuscarDetalhe = (id: number) => Promise<SessaoDetalheApi | null>

/* Monta os eventos sintetizados de TODOS os resultados que ainda dão
   para ancorar (enunciado presente e questão ainda no catálogo). */
export async function evidenciasDaConta(
  results: Resultado[],
  subjects: Materias,
  geracao: number,
  resolverTema: ResolverTema = mapaDoTema,
  detalhe: BuscarDetalhe = detalheDe,
): Promise<{
  eventos: EventoAprendizagem[]
  conclusoes: ConclusaoAprendizagem[]
}> {
  // 1. Itens candidatos por resultado (correções da conta em paralelo).
  const sessoes = await Promise.all(
    results.map(async (r) => {
      const s = subjects[r.subject]
      if (!s || r.v < 2 || !r.items?.length) return null
      let itens: ItemCandidato[] = []
      if (r.incompleto && r.remoto !== undefined) {
        // Veio só o resumo da conta: a correção traz enunciado e tema.
        const d = await detalhe(r.remoto)
        if (!d) return null
        itens = d.questoes.flatMap((q) => {
          const ti = s.topics.findIndex((t) => t.slug === q.tema)
          return ti < 0
            ? []
            : [
                {
                  ti,
                  enunciado: q.enunciado,
                  ok: q.acertou,
                  respondeu: q.escolhida !== null,
                },
              ]
        })
      } else if (!r.incompleto) {
        itens = r.items.flatMap((i) => {
          const ti = i.topic ?? r.topic
          return ti === undefined || !i.ask
            ? []
            : [
                {
                  ti,
                  enunciado: i.ask,
                  ok: i.ok,
                  respondeu: i.chosen !== undefined,
                },
              ]
        })
      }
      // incompleto sem remoto: o servidor perdeu a sessão — sem âncora.
      return itens.length ? { r, s, itens } : null
    }),
  )

  // 2. Mapas dos temas citados, em paralelo (o resolver memoriza).
  const temas = new Set<string>()
  for (const x of sessoes)
    if (x) for (const it of x.itens) temas.add(`${x.s.id}/${it.ti}`)
  await Promise.all(
    [...temas].map((k) => {
      const [d, ti] = k.split('/')
      return resolverTema(d!, +ti).catch(() => undefined)
    }),
  )

  // 3. Âncora por enunciado e síntese.
  const eventos: EventoAprendizagem[] = []
  const conclusoes: ConclusaoAprendizagem[] = []
  for (const x of sessoes) {
    if (!x) continue
    const { r, s } = x
    const resolvidas: {
      tema: string
      q: QuestaoMapeada
      ok: boolean
      respondeu: boolean
    }[] = []
    for (const it of x.itens) {
      const mapa = await resolverTema(s.id, it.ti).catch(() => null)
      const q = mapa?.get(norm(it.enunciado))
      if (q)
        resolvidas.push({
          tema: s.topics[it.ti].slug,
          q,
          ok: it.ok,
          respondeu: it.respondeu,
        })
    }
    if (!resolvidas.length) continue
    const sessao = sintetizarSessao(r, s.id, resolvidas, geracao)
    eventos.push(...sessao.eventos)
    conclusoes.push(sessao.conclusao)
  }
  return { eventos, conclusoes }
}

/* Memorização por (lista de resultados, geração): o array do store é
   trocado a cada gravação e a geração muda a cada reinício. */
let memo: {
  results: Resultado[]
  geracao: number
  extra: { eventos: EventoAprendizagem[]; conclusoes: ConclusaoAprendizagem[] }
} | null = null

/* Estado real + reconstruído, para todas as leituras do motor. Falha
   (catálogo incompleto, API fora) devolve o estado sem a mesclagem. */
export async function estadoComConta(
  estado: EstadoAprendizagem,
): Promise<EstadoAprendizagem> {
  try {
    const { results, subjects } = useApp.getState()
    if (!Object.keys(subjects).length || !results.length) return estado
    const geracao = estado.controle.geracao
    if (!memo || memo.results !== results || memo.geracao !== geracao) {
      memo = {
        results,
        geracao,
        extra: await evidenciasDaConta(results, subjects, geracao),
      }
    }
    return {
      ...estado,
      eventos: [...estado.eventos, ...memo.extra.eventos],
      conclusoes: [...estado.conclusoes, ...memo.extra.conclusoes],
    }
  } catch {
    return estado
  }
}
