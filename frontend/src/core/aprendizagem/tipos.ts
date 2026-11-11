export interface MetadadosQuestao {
  habilidade: string
  secundarias: string[]
  familia: string
  revisao: 'pendente' | 'aprovada' | 'rejeitada'
  elegivel: boolean
  versao: number
}

export interface QuestaoAprendizagem {
  codigo: string
  disciplina: string
  tema: string
  pedagogia: MetadadosQuestao | null
  revisaoApi?: string
}

export interface SessaoAprendizagem {
  id: string
  geracao: number
  confiavel: boolean
  modalidade: 'licao' | 'simulado'
  inicio: number
  localLearnerId?: string
}

export type TipoEvento =
  | 'apresentacao'
  | 'submissao'
  | 'correcao'
  | 'exposicao'
  | 'ajuda'

export interface EventoAprendizagem {
  id: string
  geracao: number
  sessaoId: string
  modalidade: SessaoAprendizagem['modalidade']
  tipo: TipoEvento
  instante: number
  dataLocal: string
  codigo: string
  disciplina: string
  tema: string
  tentativaId?: string
  metadados?: MetadadosQuestao | null
  confiavel: boolean
  acertou?: boolean
  respondeu?: boolean
  incerta?: boolean
  respostaTexto?: string
  revisaoApi?: string
  sequencia?: number
  localLearnerId?: string
}

export interface ConclusaoAprendizagem {
  id: string
  sessaoId: string
  geracao: number
  instante: number
  eventoIds: string[]
}

export interface ControleAprendizagem {
  id: 'principal'
  geracao: number
  resetPendente: boolean
  esquema: 1
  localLearnerId: string
  revisao: number
  ultimaSequencia: number
}

export interface EstadoAprendizagem {
  controle: ControleAprendizagem
  eventos: EventoAprendizagem[]
  conclusoes: ConclusaoAprendizagem[]
}

export interface Evidencia {
  eventoId: string
  sessaoId: string
  codigo: string
  familia: string
  habilidade: string
  instante: number
  dataLocal: string
  acertou: boolean
  sequencia?: number
}

export interface ConfiguracaoAprendizagem {
  habilitado: boolean
  registrarEventos: boolean
  dominio: boolean
  recomendacoes: boolean
  disciplinas: readonly string[]
  temas?: readonly string[]
}

export interface MatrizTema {
  disciplina: string
  tema: string
  validada: boolean
  habilidades: { slug: string; essencial: boolean }[]
  questoes: QuestaoAprendizagem[]
}

export interface ParametrosDominio {
  window: number
  min: number
  taxa: number
  boaMin: number
  skillWindow: number
  skillCorrect: number
  erroRecorrente: number
  confirmacaoMin: number
}

export interface DiagnosticoDominio {
  estado:
    | 'insuficiente'
    | 'em-pratica'
    | 'bom-desempenho'
    | 'dominio-confirmado'
  janela: Evidencia[]
  taxa: number
  essenciaisAtendidas: boolean
  recorrenciasResolvidas: boolean
  marcoBomDesempenho: Evidencia | null
  verificacaoIndependente: boolean
}

export type SituacaoHabilidade =
  | 'sem-evidencia'
  | 'dificuldade'
  | 'em-pratica'
  | 'boa'
  | 'revisar'

export interface ParametrosRecomendacao {
  revisaoHoras: number
}

export type MotivoRecomendacao =
  | 'dificuldade'
  | 'revisao'
  | 'nova-habilidade'
  | 'continuar'

export interface RecomendacaoTema {
  disciplina: string
  tema: string
  motivo: MotivoRecomendacao
  habilidade: string | null
  revisarEm: number | null
}

export interface DiagnosticoRecomendacao {
  recomendacao: RecomendacaoTema | null
  candidatos: RecomendacaoTema[]
}

export interface ParametrosPreparacao {
  minTemas: number
  temasConfirmados: number
  habilitarConclusaoFavoravel?: boolean
}

export type EstadoPreparacao = 'sem-dados' | 'em-progresso' | 'boa-preparacao'

export interface PreparacaoTema {
  disciplina: string
  tema: string
  estado: DiagnosticoDominio['estado']
}

export interface DiagnosticoPreparacao {
  estado: EstadoPreparacao
  temasAvaliados: number
  confirmados: number
  bomDesempenho: number
  detalhes: PreparacaoTema[]
}
