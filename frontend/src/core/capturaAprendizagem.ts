import { criarServicoAprendizagem } from './aprendizagem/servico'
import type {
  ContextoTentativa,
  GravacaoAprendizagem,
  ServicoAprendizagem,
} from './aprendizagem/servico'
import { avaliarDominio } from './aprendizagem/dominio'
import { avaliarPreparacao } from './aprendizagem/preparacao'
import { recomendar } from './aprendizagem/recomendacao'
import type {
  DiagnosticoDominio,
  DiagnosticoPreparacao,
  MatrizTema,
  MotivoRecomendacao,
  QuestaoAprendizagem,
  RecomendacaoTema,
  SessaoAprendizagem,
} from './aprendizagem/tipos'
import { toast } from './toast'
import { api } from './api'
import { local, useApp } from './store'
import type { DisciplinaPedagogiaApi, QuestaoItem, Resultado } from '../types'

let servico: ServicoAprendizagem = criarServicoAprendizagem()

const apresentadas = new Set<string>()
const avisadas = new Set<string>()

export function definirServicoAprendizagem(s: ServicoAprendizagem): void {
  servico = s
  apresentadas.clear()
  avisadas.clear()
}

export function obterServicoAprendizagem(): ServicoAprendizagem {
  return servico
}

const AVISO_DEGRADADO =
  'Não foi possível salvar o registro detalhado de estudo. Você pode continuar normalmente.'

function avisarDegradacao(sessao: SessaoAprendizagem): void {
  if (avisadas.has(sessao.id)) return
  avisadas.add(sessao.id)
  toast(AVISO_DEGRADADO)
}

type QuestaoCaptura = QuestaoAprendizagem & {
  legadoIncerto?: boolean
  semCodigo?: boolean
}

async function chamar(
  sessao: SessaoAprendizagem | null | undefined,
  questao: QuestaoAprendizagem | null,
  op: () => Promise<GravacaoAprendizagem>,
): Promise<boolean> {
  if (!sessao || !sessao.confiavel) return false
  if (questao && (questao as QuestaoCaptura).semCodigo) {
    sessao.confiavel = false
    avisarDegradacao(sessao)
    return false
  }
  try {
    return (await op()).status === 'salvo'
  } catch {
    avisarDegradacao(sessao)
    return false
  }
}

export const tentativaId = (
  sessao: SessaoAprendizagem | null | undefined,
  posicao: number,
): string => `${sessao?.id ?? ''}/${posicao}`

export function questaoAprendizagem(
  item: QuestaoItem,
  disciplina: string,
  tema: string,
): QuestaoCaptura {
  const legadoIncerto = useApp
    .getState()
    .results.some(
      (resultado) =>
        resultado.subject === disciplina &&
        resultado.v >= 2 &&
        (!Array.isArray(resultado.items) ||
          resultado.items.length === 0 ||
          resultado.items.some(
            (anterior) =>
              !Number.isInteger(anterior.id) || anterior.id === item.id,
          )),
    )
  const codigo = typeof item.codigo === 'string' ? item.codigo.trim() : ''
  return {
    legadoIncerto,
    semCodigo: !codigo,
    codigo,
    disciplina,
    tema,
    revisaoApi: item.revisaoConteudo,
    pedagogia: item.pedagogia,
  }
}

const ctx = (
  sessao: SessaoAprendizagem,
  questao: QuestaoAprendizagem,
  id: string,
): ContextoTentativa => ({ sessao, questao, tentativaId: id })

export async function novaSessaoCaptura(
  modalidade: SessaoAprendizagem['modalidade'],
): Promise<SessaoAprendizagem | null> {
  try {
    return await servico.iniciarSessao(modalidade)
  } catch {
    if (!avisadas.has('abertura')) {
      avisadas.add('abertura')
      toast(AVISO_DEGRADADO)
    }
    return null
  }
}

export function apresentar(
  sessao: SessaoAprendizagem | null | undefined,
  questao: QuestaoAprendizagem,
  id: string,
): Promise<boolean> {
  if (sessao?.confiavel && apresentadas.has(id)) return Promise.resolve(true)
  return chamar(sessao, questao, async () => {
    const r = await servico.apresentar(ctx(sessao!, questao, id))
    if (r.status === 'salvo') apresentadas.add(id)
    return r
  })
}

export function submeter(
  sessao: SessaoAprendizagem | null | undefined,
  questao: QuestaoAprendizagem,
  id: string,
  respondeu: boolean,
  incerta = false,
  respostaTexto?: string,
): Promise<boolean> {
  return chamar(sessao, questao, () =>
    servico.submeter(
      ctx(sessao!, questao, id),
      respondeu,
      incerta ||
        !questao.revisaoApi ||
        !!(questao as QuestaoCaptura).legadoIncerto,
      respostaTexto,
      questao.revisaoApi,
    ),
  )
}

export function corrigir(
  sessao: SessaoAprendizagem | null | undefined,
  questao: QuestaoAprendizagem,
  id: string,
  acertou: boolean,
  incerta = false,
  revisaoApi?: string,
  codigo?: string,
): Promise<boolean> {
  return chamar(sessao, questao, () =>
    servico.corrigir(
      ctx(sessao!, questao, id),
      acertou,
      incerta ||
        !revisaoApi ||
        revisaoApi !== questao.revisaoApi ||
        codigo !== questao.codigo,
      revisaoApi,
    ),
  )
}

export function concluirSessao(
  sessao: SessaoAprendizagem | null | undefined,
): Promise<boolean> {
  return chamar(sessao, null, () => servico.concluir(sessao!))
}

export function matrizesAprendizagem(
  pedagogia: DisciplinaPedagogiaApi,
): MatrizTema[] {
  const validada = !!pedagogia.matriz?.validada
  return pedagogia.temas.map((t) => ({
    disciplina: pedagogia.disciplina,
    tema: t.slug,
    validada,
    habilidades: t.habilidades.map((h) => ({
      slug: h.slug,
      essencial: h.essencial,
    })),
    questoes: t.questoes
      .filter((q) => typeof q.codigo === 'string' && q.codigo.trim() !== '')
      .map((q) => ({
        codigo: q.codigo!,
        disciplina: pedagogia.disciplina,
        tema: t.slug,
        revisaoApi: q.revisaoConteudo,
        pedagogia: q.pedagogia,
      })),
  }))
}

export interface AvaliacaoEstudo {
  recomendacao: RecomendacaoTema | null
  preparacao: DiagnosticoPreparacao
  dominios: Record<string, DiagnosticoDominio>
}

export const MOTIVO_TEXTO: Record<MotivoRecomendacao, string> = {
  dificuldade: 'para reforçar onde ficou difícil',
  revisao: 'para revisar antes de esquecer',
  'nova-habilidade': 'um assunto novo para conhecer',
  continuar: 'para continuar de onde você parou',
}

export const ESTADO_TEXTO: Record<DiagnosticoDominio['estado'], string> = {
  insuficiente: 'Para começar',
  'em-pratica': 'Em progresso',
  'bom-desempenho': 'Indo bem',
  'dominio-confirmado': 'Consolidado',
}

// Avaliação completa de UMA área: recomendação, preparo e estágio por tema.
// Falha ou motor desligado devolvem null — a tela segue no modo tradicional.
export async function avaliarArea(
  disciplina: string,
): Promise<AvaliacaoEstudo | null> {
  try {
    const [pedagogia, estado] = await Promise.all([
      api.pedagogia(disciplina),
      servico.ler(),
    ])
    if (!estado) return null
    const matrizes = matrizesAprendizagem(pedagogia)
    const dominios: Record<string, DiagnosticoDominio> = {}
    for (const m of matrizes)
      if (m.validada && m.habilidades.some((h) => h.essencial))
        dominios[m.tema] = avaliarDominio(estado, m)
    return {
      recomendacao: recomendar(estado, matrizes, Date.now()).recomendacao,
      preparacao: avaliarPreparacao(estado, matrizes),
      dominios,
    }
  } catch {
    return null
  }
}

// A sugestão do Início cruza TODAS as matérias da prova escolhida.
export async function sugestaoDoDia(
  disciplinas: readonly string[],
): Promise<RecomendacaoTema | null> {
  try {
    const [estado, pedagogias] = await Promise.all([
      servico.ler(),
      Promise.all(disciplinas.map((d) => api.pedagogia(d))),
    ])
    if (!estado) return null
    return recomendar(
      estado,
      pedagogias.flatMap(matrizesAprendizagem),
      Date.now(),
    ).recomendacao
  } catch {
    return null
  }
}

const CHAVE_LIMPEZA = 'estudae:aprendizagem:limpeza'

function lerLegado(): {
  results: Resultado[]
  watched: Record<string, number>
} {
  return {
    results: local.get<Resultado[]>('results', []).filter((r) => r && r.v >= 2),
    watched: local.get<Record<string, number>>('watched', {}),
  }
}

export async function resetAprendizagem(): Promise<boolean> {
  useApp.setState({ quiz: null, simulado: null })
  apresentadas.clear()
  avisadas.clear()
  let marcado = false
  try {
    localStorage.setItem(CHAVE_LIMPEZA, 'true')
    marcado = localStorage.getItem(CHAVE_LIMPEZA) === 'true'
  } catch {
    marcado = false
  }
  let adaptativo = false
  try {
    await servico.reiniciar()
    adaptativo = true
  } catch {
    adaptativo = false
  }
  let legado = false
  try {
    localStorage.removeItem('estudae:results')
    localStorage.removeItem('estudae:watched')
    legado =
      localStorage.getItem('estudae:results') === null &&
      localStorage.getItem('estudae:watched') === null
  } catch {
    legado = false
  }
  useApp.setState({ quiz: null, simulado: null })
  if (legado) useApp.setState({ results: [], watched: {} })
  if (!marcado || !adaptativo || !legado) return false
  try {
    localStorage.removeItem(CHAVE_LIMPEZA)
    return localStorage.getItem(CHAVE_LIMPEZA) === null
  } catch {
    return false
  }
}

let retomada: Promise<void> | null = null

export function iniciarCaptura(): () => void {
  const aoMudar = (event: StorageEvent) => {
    if (event.key === CHAVE_LIMPEZA && event.newValue !== null)
      useApp.setState({ quiz: null, simulado: null })
    if (
      event.key === null ||
      event.key === CHAVE_LIMPEZA ||
      event.key === 'estudae:results' ||
      event.key === 'estudae:watched'
    )
      useApp.setState(lerLegado())
  }
  window.addEventListener('storage', aoMudar)
  retomada ??= (async () => {
    let pendente = false
    try {
      pendente = localStorage.getItem(CHAVE_LIMPEZA) !== null
    } catch {
      pendente = false
    }
    if (pendente) {
      await resetAprendizagem()
      return
    }
    try {
      await servico.ler()
    } catch {
      return
    }
  })().finally(() => {
    retomada = null
  })
  return () => window.removeEventListener('storage', aoMudar)
}
