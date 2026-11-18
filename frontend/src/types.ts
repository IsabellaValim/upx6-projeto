/* ==========================================================
   Tipos do front: contrato da API (docs/api.md), catálogo no
   formato das telas e estado persistido (localStorage estudae:*)
   ========================================================== */

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
}

export interface TemaApi {
  slug: string
  titulo: string
  sobre: string | null
  totalQuestoes: number
  videos: VideoApi[]
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

export interface QuestaoApi {
  id: number
  textoBase: string | null
  enunciado: string
  alternativas: string[] // já embaralhadas pela API (ordem da prova se tem imagem)
  prova: ProvaApi | null // null = questão autoral
  imagem: ImagemApi | null
}

export interface RespostaApi {
  acertou: boolean
  respostaCorreta: string
  resolucao: string
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
  topic: number // posição do tema em subject.topics
  text: string | null // textoBase
  ask: string // enunciado
  options: string[] // alternativas (letras A–E são da posição)
  prova: ProvaApi | null
  imagem: ImagemApi | null
}

// ---------- Estado persistido (localStorage estudae:*) ----------
export type Nivel = 'fundamental' | 'medio'

// Visitante: { name: 'Visitante', guest: true }. Conta: nome e e-mail da API
// (a sessão de verdade é o cookie; isto é só o espelho para as telas).
export interface User {
  name: string
  guest?: boolean
  email?: string
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
  // Progresso na conta (core/progresso.ts). chave: única por aluno, gerada
  // aqui (resultado antigo sem chave usa "local:<date>", ver chaveDe).
  chave?: string
  remoto?: number // id da sessão na API: já está na conta
  incompleto?: boolean // veio da API só com o resumo; a correção carrega ao abrir
  semSync?: boolean // a API recusou (ou não dá para converter): não reenvia
}

// ---------- Sessões voláteis (não persistidas) ----------
export interface QuizSession {
  subject: string
  topic: number
  questions: QuestaoItem[] | null // chegam da API
  i: number
  chosen: (number | undefined)[]
  results: (RespostaApi | undefined)[] // correção da API por questão conferida
  finished: boolean
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
  finished: boolean
}

// ---------- Conta (docs/api.md, "Conta do aluno") ----------
export interface UsuarioApi {
  nome: string
  email: string
}

export interface OpcoesContaApi {
  cadastroAberto: boolean
}

// ---------- Progresso (docs/api.md, "Progresso do aluno") ----------
export interface RespostaSessaoApi {
  questaoId: number
  alternativa: string | null // null = em branco (só no simulado)
}

export interface SessaoEnvioApi {
  chave: string
  tipo: 'licao' | 'simulado'
  disciplina: string
  tema: string | null
  treino: boolean
  iniciadaEm: string
  concluidaEm: string
  tempoLimiteSeg: number | null
  respostas: RespostaSessaoApi[]
}

export interface TentativaResumoApi {
  questaoId: number
  tema: string
  acertou: boolean
  emBranco: boolean
}

export interface SessaoResumoApi {
  id: number
  chave: string
  tipo: 'licao' | 'simulado'
  disciplina: string
  tema: string | null
  treino: boolean
  iniciadaEm: string
  concluidaEm: string
  tempoLimiteSeg: number | null
  acertos: number
  total: number
  tentativas: TentativaResumoApi[]
}

export interface AulaApi {
  videoaulaId: number
  assistidaEm: string
}

export interface ProgressoApi {
  sessoes: SessaoResumoApi[]
  aulas: AulaApi[]
}

export interface TentativaDetalheApi {
  questaoId: number
  ordem: number
  tema: string
  textoBase: string | null
  enunciado: string
  alternativas: string[]
  imagem: ImagemApi | null
  escolhida: string | null
  respostaCorreta: string
  resolucao: string
  acertou: boolean
}

export interface SessaoDetalheApi extends Omit<SessaoResumoApi, 'tentativas'> {
  questoes: TentativaDetalheApi[]
}

export interface ImportacaoApi {
  sessoesNovas: number
  sessoesRepetidas: number
  sessoesIgnoradas: { posicao: number; chave: string | null; erro: string }[]
  aulasNovas: number
  aulasIgnoradas: number
}
