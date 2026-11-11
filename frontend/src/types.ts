/* ==========================================================
   Tipos do front: contrato da API (docs/api.md), catálogo no
   formato das telas e estado persistido (localStorage estudae:*)
   ========================================================== */

import type { SessaoAprendizagem } from './core/aprendizagem/tipos'

// ---------- API (docs/api.md) ----------
export interface DisciplinaApi {
  slug: string
  nome: string
  icone: string | null
  nivel: string // "medio" | "fundamental"
  totalQuestoes: number
}

export interface VideoApi {
  id: number
  titulo: string
  youtubeId: string
  duracaoSegundos: number | null
  habilidades: string[]
}

export interface HabilidadeApi {
  slug: string
  titulo: string
  essencial: boolean
}

export interface TemaApi {
  slug: string
  titulo: string
  sobre: string | null
  totalQuestoes: number
  videos: VideoApi[]
  habilidades: HabilidadeApi[]
}

export interface ImagemApi {
  url: string // relativa à raiz da API ("conteudo/imagens/...")
  descricao: string
}

export interface ProvaApi {
  ano: number
  edicao?: string
  nivel?: string
  numero?: number
}

export interface PedagogiaQuestaoApi {
  habilidade: string
  secundarias: string[]
  familia: string
  dificuldade: string | null
  tipo: string | null
  revisao: 'pendente' | 'aprovada' | 'rejeitada'
  elegivel: boolean
  versao: number
}

export interface QuestaoApi {
  id: number
  codigo?: string
  revisaoConteudo?: string
  textoBase: string | null
  enunciado: string
  alternativas: string[] // já embaralhadas pela API (ordem da prova se tem imagem)
  prova: ProvaApi | null // null = questão autoral
  imagem: ImagemApi | null
  pedagogia: PedagogiaQuestaoApi | null
}

export interface RespostaApi {
  acertou: boolean
  respostaCorreta: string
  resolucao: string
  codigo?: string
  revisaoConteudo?: string
}

export interface MatrizApi {
  versao: string | null
  validada: boolean
}

export interface QuestaoIndiceApi {
  codigo?: string
  revisaoConteudo?: string
  pedagogia: PedagogiaQuestaoApi | null
}

export interface TemaPedagogiaApi {
  slug: string
  habilidades: HabilidadeApi[]
  questoes: QuestaoIndiceApi[]
}

export interface DisciplinaPedagogiaApi {
  disciplina: string
  matriz: MatrizApi | null
  temas: TemaPedagogiaApi[]
}

// ---------- Catálogo (mesmo formato que o data.js antigo dava às telas) ----------
export interface CatalogLesson {
  id: number
  kind: string // título da videoaula
  min: number | null // duração em minutos, arredondada; null = não informada
  youtubeId: string
}

export interface CatalogTopic {
  slug: string
  title: string
  about: string | null
  videos: number
  totalQuestoes: number
  lessons: CatalogLesson[]
}

export interface CatalogSubject {
  id: string // slug
  nivel: string // "medio" | "fundamental" (prova do Encceja)
  name: string
  area: string // "N temas"
  icon: string
  totalQuestoes: number
  topics: CatalogTopic[]
}

// ---------- Questão no formato das telas ----------
export interface QuestaoItem {
  id: number
  codigo?: string
  revisaoConteudo?: string
  topic: number // posição do tema em subject.topics
  text: string | null // textoBase
  ask: string // enunciado
  options: string[] // alternativas (letras A–E são da posição)
  prova: ProvaApi | null
  imagem: ImagemApi | null
  pedagogia: PedagogiaQuestaoApi | null
}

// ---------- Estado persistido (localStorage estudae:*) ----------
export type Nivel = 'fundamental' | 'medio'

export interface User {
  name: string
  guest?: boolean
  login?: string | null
  guardian?: string | null
}

export type FontSize = 'padrao' | 'grande' | 'extragrande'

export interface A11y {
  font: FontSize
  contrast: boolean
  speak: boolean
  motion: boolean
  subs: boolean
  slow: boolean
}

// Uma questão dentro de um resultado (lição ou simulado).
export interface ResultItem {
  id?: number
  topic?: number
  ask: string
  options: string[]
  chosen: number | undefined // posição em options; undefined = em branco
  answer: number // posição da certa em options
  why: string // resolução
  ok: boolean
}

export interface Resultado {
  v: number // 2 = quiz por matéria (antigo); 3 = lição por tema / simulado
  kind?: 'simulado'
  subject: string
  topic?: number
  date: number
  correct: number
  total: number
  items: ResultItem[]
  weakTopic: number | null
  treino?: boolean // simulado com questões autorais
  usedMs?: number
  limitMs?: number
}

// ---------- Sessões voláteis (não persistidas) ----------
export interface QuizSession {
  subject: string
  topic: number
  questions: QuestaoItem[] | null // chegam da API
  i: number
  chosen: (number | undefined)[]
  results: (RespostaApi | undefined)[] // correção da API por questão conferida
  pendente?: (string | undefined)[]
  captura?: SessaoAprendizagem | null
  finished: boolean
}

export interface EntregaSimulado {
  congeladas: (number | undefined)[]
  correcoes: (RespostaApi | undefined)[]
  registrado: boolean
}

export interface SimuladoSession {
  subject: string
  questions: QuestaoItem[] | null
  treino: boolean // true = sem oficiais suficientes, usa as autorais
  i: number
  chosen: (number | undefined)[]
  startedAt: number | null
  limitMs: number
  warned: boolean // toast "Faltam N minutos" já foi
  overWarned?: boolean // toast "tempo esgotado" já foi
  entrega?: EntregaSimulado | null
  captura?: SessaoAprendizagem | null
  finished: boolean
}
