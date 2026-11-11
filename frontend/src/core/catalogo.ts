/* ==========================================================
   Conteúdo do Estudaê: disciplinas, temas, videoaulas e questões.
   Vem da API (core/api.ts). carregarCatalogo() roda uma vez no boot
   (CatalogoGate no App) e preenche a slice `subjects` do store, no
   mesmo formato que o data.js antigo entregava às telas.
   ========================================================== */
import { api } from './api'
import { useApp } from './store'
import type { CatalogSubject, ProvaApi, QuestaoItem } from '../types'

let carregando: Promise<void> | null = null

// Carrega matérias e temas (com os vídeos) uma vez, no início do app.
// Chamadas paralelas (o StrictMode desmonta/remonta o gate em dev)
// dividem a mesma promessa em voo; 'ready' resolve na hora e qualquer
// estado posterior a um erro tenta de novo.
export function carregarCatalogo(): Promise<void> {
  if (useApp.getState().catalogoStatus === 'ready') return Promise.resolve()
  if (!carregando) {
    carregando = carregarCatalogoDeFato()
    // Assentou (sucesso ou erro): limpa para a próxima chamada decidir pelo
    // status. then(ok, err) — não rejeita, evita unhandled rejection.
    carregando.then(
      () => {
        carregando = null
      },
      () => {
        carregando = null
      },
    )
  }
  return carregando
}

async function carregarCatalogoDeFato(): Promise<void> {
  const { setCatalogoStatus, setSubjects } = useApp.getState()
  setCatalogoStatus('loading')
  try {
    const disciplinas = await api.disciplinas()
    const temasPorDisciplina = await Promise.all(
      disciplinas.map((d) => api.temas(d.slug)),
    )
    const subjects: Record<string, CatalogSubject> = {}
    disciplinas.forEach((d, i) => {
      const topics = temasPorDisciplina[i].map((t) => ({
        slug: t.slug,
        title: t.titulo,
        about: t.sobre,
        videos: t.videos.length,
        totalQuestoes: t.totalQuestoes,
        lessons: t.videos.map((v) => ({
          id: v.id,
          kind: v.titulo,
          min: v.duracaoSegundos
            ? Math.max(1, Math.round(v.duracaoSegundos / 60))
            : null,
          youtubeId: v.youtubeId,
          habilidades: v.habilidades ?? [],
        })),
      }))
      subjects[d.slug] = {
        id: d.slug,
        nivel: d.nivel ?? 'medio', // "fundamental" ou "medio"
        name: d.nome,
        area: topics.length === 1 ? '1 tema' : `${topics.length} temas`,
        icon: d.icone || 'book',
        totalQuestoes: d.totalQuestoes,
        topics,
      }
    })
    setSubjects(subjects)
    setCatalogoStatus('ready')
  } catch (e) {
    setCatalogoStatus('error')
    throw e
  }
}

// Questões de UM tema (a lição é por tema). Não trazem gabarito: a correção
// vem do POST de resposta.
export async function carregarQuestoes(
  subjects: Record<string, CatalogSubject>,
  id: string,
  ti: number,
): Promise<QuestaoItem[]> {
  const t = subjects[id].topics[ti]
  const questoes = await api.questoes(id, t.slug)
  return questoes.map((q) => ({
    id: q.id,
    codigo: q.codigo,
    revisaoConteudo: q.revisaoConteudo,
    topic: ti,
    text: q.textoBase,
    ask: q.enunciado,
    options: q.alternativas,
    prova: q.prova,
    imagem: q.imagem, // { url, descricao } ou null: recorte da prova (figura, tabela...)
    pedagogia: q.pedagogia,
  }))
}

// Provas do Encceja (o "nível" da disciplina na API).
export const NIVEIS = {
  fundamental: {
    nome: 'Ensino Fundamental',
    sobre: 'Para quem quer o certificado de conclusão do Ensino Fundamental.',
  },
  medio: {
    nome: 'Ensino Médio',
    sobre: 'Para quem quer o certificado de conclusão do Ensino Médio.',
  },
} as const

// Matérias da prova escolhida, na ordem do catálogo.
export const materiasDoNivel = (
  subjects: Record<string, CatalogSubject>,
  nivel: string | null,
): CatalogSubject[] => Object.values(subjects).filter((s) => s.nivel === nivel)

// "Fonte: Encceja 2020, Nacional, Ensino Médio, questão 35." ou, sem prova, autoral.
export function fonte(prova: ProvaApi | null): string {
  if (!prova || !prova.ano)
    return 'Questão autoral Estudaê, feita para praticar.'
  const partes = [
    'Encceja ' + prova.ano,
    prova.edicao,
    prova.nivel,
    prova.numero && 'questão ' + prova.numero,
  ]
  return 'Fonte: ' + partes.filter(Boolean).join(', ') + '.'
}
