import { criarServicoAprendizagem } from './aprendizagem/servico'
import type {
  ContextoTentativa,
  GravacaoAprendizagem,
  ServicoAprendizagem,
} from './aprendizagem/servico'
import { proximaAcao } from './aprendizagem/jornada'
import type { AcaoJornada, AulaTema } from './aprendizagem/jornada'
import {
  compararDesempenho,
  destaqueEvolucao,
  habilidadesBoas,
} from './aprendizagem/evolucao'
import type { EvolucaoTema } from './aprendizagem/evolucao'
import { selecionarQuestoes, selecionarRodada } from './aprendizagem/selecao'
import { carregarQuestoes, materiasDoNivel } from './catalogo'
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
import { urls } from './urls'
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

/* ---------- Jornada guiada ---------- */

// Matriz de UM tema montada do catálogo + questões carregadas: a lição
// seleciona sem precisar do índice de pedagogia (validada fica false —
// só a seleção a usa, e ela olha a elegibilidade por questão).
function matrizDoTema(
  disciplina: string,
  ti: number,
  questoes: QuestaoItem[],
): MatrizTema {
  const t = useApp.getState().subjects[disciplina].topics[ti]
  return {
    disciplina,
    tema: t.slug,
    validada: false,
    habilidades: t.habilidades.map((h) => ({
      slug: h.slug,
      essencial: h.essencial,
    })),
    questoes: questoes
      .filter((q) => typeof q.codigo === 'string' && q.codigo !== '')
      .map((q) => ({
        codigo: q.codigo!,
        disciplina,
        tema: t.slug,
        revisaoApi: q.revisaoConteudo,
        pedagogia: q.pedagogia,
      })),
  }
}

// Reordena as questões da lição pela seleção adaptativa (o tamanho continua
// cortado no chamador). Com o motor fora ou qualquer falha, a ordem da API.
export async function ordenarLicao(
  disciplina: string,
  ti: number,
  questoes: QuestaoItem[],
  habilidade?: string,
): Promise<QuestaoItem[]> {
  try {
    const estado = await servico.ler()
    if (!estado) return questoes
    const selecao = selecionarQuestoes(
      matrizDoTema(disciplina, ti, questoes),
      estado,
      questoes.length,
      habilidade ? { habilidade } : {},
    )
    const ordem = new Map(
      selecao.questoes.map((q, i) => [q.codigo, i] as const),
    )
    return [...questoes].sort(
      (a, b) =>
        (ordem.get(a.codigo ?? '') ?? questoes.length) -
        (ordem.get(b.codigo ?? '') ?? questoes.length),
    )
  } catch {
    return questoes
  }
}

// Mapa disciplina/tema → aulas com o vínculo curado e a marca de assistida.
function aulasDoNivel(nivel: string | null): Map<string, AulaTema[]> {
  const { subjects, watched } = useApp.getState()
  const mapa = new Map<string, AulaTema[]>()
  for (const s of materiasDoNivel(subjects, nivel))
    s.topics.forEach((t, ti) =>
      mapa.set(
        `${s.id}/${t.slug}`,
        t.lessons.map((l, li) => ({
          habilidades: l.habilidades,
          assistida: !!watched[`${s.id}/${ti}/${li}`],
        })),
      ),
    )
  return mapa
}

// A próxima ação da jornada, cruzando TODAS as matérias da prova escolhida.
// null = sem matrizes avaliáveis (ou motor fora) → fluxo tradicional.
export async function proximaAcaoNivel(
  nivel: string | null,
): Promise<AcaoJornada | null> {
  try {
    const estado = await servico.ler()
    if (!estado) return null
    const disciplinas = materiasDoNivel(useApp.getState().subjects, nivel)
    const pedagogias = await Promise.all(
      disciplinas.map((s) => api.pedagogia(s.id)),
    )
    const matrizes = pedagogias.flatMap(matrizesAprendizagem)
    return proximaAcao({
      estado,
      matrizes,
      aulas: aulasDoNivel(nivel),
    })
  } catch {
    return null
  }
}

// Itens de uma rodada multi-tema (diagnóstico ou verificação por matéria):
// seleção adaptativa cruzando os temas validados. Sem motor, sem índice ou
// sem elegíveis, cai nas primeiras questões do catálogo — praticar nunca
// para por falta de curadoria.
export async function montarRodada(
  disciplina: string,
  tamanho: number,
): Promise<QuestaoItem[]> {
  const s = useApp.getState().subjects[disciplina]
  if (!s) return []
  const porTema = await Promise.all(
    s.topics.map((t, ti) =>
      t.totalQuestoes
        ? carregarQuestoes(useApp.getState().subjects, disciplina, ti)
        : Promise.resolve([]),
    ),
  )
  try {
    const [pedagogia, estado] = await Promise.all([
      api.pedagogia(disciplina),
      servico.ler(),
    ])
    if (!estado) throw new Error('sem motor')
    const selecao = selecionarRodada(
      matrizesAprendizagem(pedagogia),
      estado,
      tamanho,
    )
    const porCodigo = new Map(
      porTema.flat().map((q) => [q.codigo ?? '', q] as const),
    )
    const itens = selecao.questoes
      .map((q) => porCodigo.get(q.codigo))
      .filter((q): q is QuestaoItem => !!q)
    if (itens.length) return itens
  } catch {
    /* índice ou motor indisponível: cai no plano abaixo */
  }
  return porTema.flat().slice(0, tamanho)
}

// Traduz a ação do orquestrador em link e textos prontos para os cartões.
// A tela não decide nada: mostra a ação ou o fluxo tradicional.
export function linkDaAcao(acao: AcaoJornada | null): {
  href: string
  kind: 'aula' | 'pratica'
  titulo: string
  sub: string
} | null {
  if (!acao) return null
  const s = useApp.getState().subjects[acao.disciplina]
  if (!s) return null
  const ti = acao.tema ? s.topics.findIndex((t) => t.slug === acao.tema) : -1
  const t = ti >= 0 ? s.topics[ti]! : null
  const onde = t ? `${s.name} · ${t.title}` : s.name
  switch (acao.tipo) {
    case 'diagnostico':
      return {
        href: urls.estudo(s.id),
        kind: 'pratica',
        titulo: 'Começar meu estudo',
        sub: `${s.name} · algumas questões para começar`,
      }
    case 'aula':
      return t && acao.aula !== null
        ? {
            href: urls.video(s.id, ti, acao.aula),
            kind: 'aula',
            titulo: 'Ver a aula',
            sub: onde,
          }
        : null
    case 'verificacao':
      return t
        ? {
            href: urls.quiz(s.id, ti),
            kind: 'pratica',
            titulo: 'Verificar o que aprendeu',
            sub: `${onde} — questões novas`,
          }
        : null
    case 'revisar':
      return t
        ? {
            href: urls.quiz(s.id, ti, acao.habilidade ?? undefined),
            kind: 'pratica',
            titulo: 'Revisar',
            sub: onde,
          }
        : null
    case 'pratica':
      return t
        ? {
            href: urls.quiz(s.id, ti, acao.habilidade ?? undefined),
            kind: 'pratica',
            titulo: 'Praticar',
            sub: onde,
          }
        : null
    case 'simulado':
      return {
        href: urls.simulado(s.id),
        kind: 'pratica',
        titulo: 'Treinar com o simulado',
        sub: s.name,
      }
  }
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
    const pedagogia = await api.pedagogia(disciplina)
    const matrizes = matrizesAprendizagem(pedagogia)
    const [av, rec] = await Promise.all([
      servico.avaliar(matrizes),
      servico.recomendar(matrizes),
    ])
    if (!av) return null
    return {
      recomendacao: rec?.recomendacao ?? null,
      preparacao: av.preparacao,
      dominios: av.dominios,
    }
  } catch {
    return null
  }
}

/* Tudo que a tela "Meu aprendizado" precisa, numa leitura só: evolução
   antes/depois por tema, o destaque, as habilidades já demonstradas e o
   diagnóstico de domínio/preparo do motor (separado por desenho — o
   comparador nunca confirma domínio). */
export interface AprendizadoNivel {
  evolucoes: EvolucaoTema[]
  destaque: EvolucaoTema | null
  boasPorTema: Record<string, string[]> // "disc/tema" → slugs em situação "boa"
  dominios: Record<string, DiagnosticoDominio>
  preparacao: DiagnosticoPreparacao
}

export async function avaliarAprendizado(
  nivel: string | null,
): Promise<AprendizadoNivel | null> {
  try {
    const estado = await servico.ler()
    if (!estado) return null
    const disciplinas = materiasDoNivel(useApp.getState().subjects, nivel)
    const pedagogias = await Promise.all(
      disciplinas.map((s) => api.pedagogia(s.id)),
    )
    const matrizes = pedagogias.flatMap(matrizesAprendizagem)
    const av = await servico.avaliar(matrizes)
    if (!av) return null
    const evolucoes = compararDesempenho(estado, matrizes)
    const boasPorTema: Record<string, string[]> = {}
    for (const m of matrizes) {
      const boas = habilidadesBoas(estado, m)
      if (boas.length) boasPorTema[`${m.disciplina}/${m.tema}`] = boas
    }
    return {
      evolucoes,
      destaque: destaqueEvolucao(evolucoes),
      boasPorTema,
      dominios: av.dominios,
      preparacao: av.preparacao,
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
    const pedagogias = await Promise.all(
      disciplinas.map((d) => api.pedagogia(d)),
    )
    return (
      (await servico.recomendar(pedagogias.flatMap(matrizesAprendizagem)))
        ?.recomendacao ?? null
    )
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
