/* Orquestrador da jornada guiada: responde "o que a pessoa faz agora?" com
   UMA ação. Puro e determinístico — as telas só traduzem a resposta em
   link e texto. A ordem reflete o fluxo do Estudaê Inteligente: cuidar da
   dificuldade recorrente, fechar a verificação pendente (rodada posterior
   com questões inéditas), introduzir habilidade nova, revisar, continuar —
   e, quando nada disso falta, reconhecer o escopo avaliado como preparado
   ou sugerir o simulado. Nunca inventa caminho: sem matrizes avaliáveis,
   devolve null e o chamador segue no fluxo tradicional. */
import { aprendizadoPct, avaliarDominio } from './dominio'
import { extrairEvidencias } from './evidencias'
import { recomendar } from './recomendacao'
import type {
  DiagnosticoDominio,
  EstadoAprendizagem,
  MatrizTema,
  MotivoRecomendacao,
  ParametrosDominio,
  ParametrosJornada,
  ParametrosRecomendacao,
} from './tipos'
import {
  PARAMETROS_DOMINIO,
  PARAMETROS_JORNADA,
  PARAMETROS_RECOMENDACAO,
} from './config'

export type TipoAcao =
  | 'diagnostico' // primeira sessão: rodada curta cobrindo habilidades variadas
  | 'aula' // videoaula indicada para a habilidade difícil ou nova
  | 'pratica' // rodada curta de questões no tema
  | 'verificacao' // rodada independente para confirmar o bom desempenho
  | 'revisar' // rodada de revisão de uma habilidade já trabalhada
  | 'simulado' // treino amplo quando nada pontual está pendente

export type MotivoAcao = MotivoRecomendacao | 'inicio' | 'consolidado'

export interface AcaoJornada {
  tipo: TipoAcao
  disciplina: string
  tema: string | null // slug do tema; null = rodada multi-tema da disciplina
  habilidade: string | null // habilidade-alvo da ação (se houver)
  aula: number | null // índice da videoaula no tema (quando tipo === 'aula')
  motivo: MotivoAcao
  escopoPreparado: string[] // temas 'dominio-confirmado' neste momento
  tamanho?: number // simulado gradual: questões do treino (ausente = completo)
}

export interface AulaTema {
  habilidades: string[] // vínculo curado videoaula_habilidade (pode ser vazio)
  assistida: boolean
}

export interface EntradaJornada {
  estado: EstadoAprendizagem
  matrizes: readonly MatrizTema[] // todas as matrizes do nível escolhido
  aulas?: ReadonlyMap<string, readonly AulaTema[]> // 'disciplina/tema' → aulas
  agora?: number
}

/* Aula para uma habilidade: primeiro o vínculo curado (mesmo já assistida —
   rever a aula certa vale mais que ver outra); depois, a primeira não
   assistida. Sem aula útil, devolve null e quem chama decide praticar. */
function aulaPara(
  aulas: ReadonlyMap<string, readonly AulaTema[]> | undefined,
  disciplina: string,
  tema: string,
  habilidade: string | null,
): number | null {
  const lista = aulas?.get(`${disciplina}/${tema}`) ?? []
  if (!lista.length) return null
  if (habilidade) {
    const ligada = lista.findIndex((a) => a.habilidades.includes(habilidade))
    if (ligada >= 0) return ligada
  }
  const pendente = lista.findIndex((a) => !a.assistida)
  return pendente >= 0 ? pendente : null
}

export function proximaAcao(
  entrada: EntradaJornada,
  pd: Readonly<ParametrosDominio> = PARAMETROS_DOMINIO,
  pr: Readonly<ParametrosRecomendacao> = PARAMETROS_RECOMENDACAO,
): AcaoJornada | null {
  const { estado, matrizes, aulas } = entrada
  const agora = entrada.agora ?? Date.now()
  const avaliaveis = matrizes.filter(
    (m) => m.validada && m.habilidades.some((h) => h.essencial),
  )
  if (!avaliaveis.length) return null

  const dominios = new Map<MatrizTema, DiagnosticoDominio>(
    avaliaveis.map((m) => [m, avaliarDominio(estado, m, pd)]),
  )
  const escopoPreparado = avaliaveis
    .filter((m) => dominios.get(m)!.estado === 'dominio-confirmado')
    .map((m) => m.tema)
  const base = (m: MatrizTema) => ({
    disciplina: m.disciplina,
    tema: m.tema,
    escopoPreparado,
  })
  const pendenteVerificacao = avaliaveis.find((m) => {
    const d = dominios.get(m)!
    return (
      d.marcoBomDesempenho &&
      !d.verificacaoIndependente &&
      d.essenciaisAtendidas &&
      d.recorrenciasResolvidas
    )
  })

  // Primeiro acesso: nenhuma evidência em nenhum tema — rodada de
  // diagnóstico cobrindo habilidades variadas da primeira disciplina
  // avaliável (as matrizes chegam na ordem do catálogo).
  const semEvidencia = avaliaveis.every(
    (m) => !extrairEvidencias(estado, m).length,
  )
  if (semEvidencia) {
    return {
      tipo: 'diagnostico',
      disciplina: avaliaveis[0]!.disciplina,
      tema: null,
      habilidade: null,
      aula: null,
      motivo: 'inicio',
      escopoPreparado,
    }
  }

  const { recomendacao } = recomendar(estado, avaliaveis, agora, pr, pd)

  if (recomendacao?.motivo === 'dificuldade') {
    const m = avaliaveis.find(
      (x) =>
        x.disciplina === recomendacao.disciplina &&
        x.tema === recomendacao.tema,
    )!
    const aula = aulaPara(aulas, m.disciplina, m.tema, recomendacao.habilidade)
    if (aula !== null)
      return {
        tipo: 'aula',
        ...base(m),
        habilidade: recomendacao.habilidade,
        aula,
        motivo: 'dificuldade',
      }
    return {
      tipo: 'pratica',
      ...base(m),
      habilidade: recomendacao.habilidade,
      aula: null,
      motivo: 'dificuldade',
    }
  }

  // Fechar a verificação pendente vale mais que abrir frente nova.
  if (pendenteVerificacao)
    return {
      tipo: 'verificacao',
      ...base(pendenteVerificacao),
      habilidade: null,
      aula: null,
      motivo: 'continuar',
    }

  if (recomendacao) {
    const m = avaliaveis.find(
      (x) =>
        x.disciplina === recomendacao.disciplina &&
        x.tema === recomendacao.tema,
    )!
    if (recomendacao.motivo === 'nova-habilidade') {
      const aula = aulaPara(
        aulas,
        m.disciplina,
        m.tema,
        recomendacao.habilidade,
      )
      if (aula !== null)
        return {
          tipo: 'aula',
          ...base(m),
          habilidade: recomendacao.habilidade,
          aula,
          motivo: 'nova-habilidade',
        }
    }
    return {
      tipo: recomendacao.motivo === 'revisao' ? 'revisar' : 'pratica',
      ...base(m),
      habilidade: recomendacao.habilidade,
      aula: null,
      motivo: recomendacao.motivo,
    }
  }

  // Nenhuma pendência recomendável, mas há tema em andamento (evidência sem
  // confirmação): continua praticando nele — o simulado é para quando nada
  // mais está em aberto.
  const emAndamento = avaliaveis.find((m) => {
    const d = dominios.get(m)!
    return d.janela.length > 0 && d.estado !== 'dominio-confirmado'
  })
  if (emAndamento)
    return {
      tipo: 'pratica',
      ...base(emAndamento),
      habilidade: null,
      aula: null,
      motivo: 'continuar',
    }
  return {
    tipo: 'simulado',
    disciplina: avaliaveis[0]!.disciplina,
    tema: null,
    habilidade: null,
    aula: null,
    motivo: 'consolidado',
    escopoPreparado,
  }
}

export interface EntradaEquilibrio {
  disciplina: string
  matrizes: readonly MatrizTema[]
}

/* A ação do nível INTEIRO, alternando as matérias: cada disciplina avalia
   sua melhor ação; reparos (dificuldade recorrente e verificação pendente)
   passam na frente; entre o resto, escolhe-se a matéria menos adiantada —
   as duas evoluem juntas em vez de uma disparar na frente da outra.
   E quando a escolhida não tem mais nada pendente, o treino amplo cresce
   com o aprendizado: rodada curta, rodada média e só então o simulado
   completo. */
export function proximaAcaoEquilibrada(
  estado: EstadoAprendizagem,
  disciplinas: readonly EntradaEquilibrio[],
  aulas?: ReadonlyMap<string, readonly AulaTema[]>,
  agora = Date.now(),
  pd: Readonly<ParametrosDominio> = PARAMETROS_DOMINIO,
  pr: Readonly<ParametrosRecomendacao> = PARAMETROS_RECOMENDACAO,
  pj: Readonly<ParametrosJornada> = PARAMETROS_JORNADA,
): AcaoJornada | null {
  const candidatas = disciplinas.flatMap((d) => {
    const acao = proximaAcao(
      { estado, matrizes: d.matrizes, aulas, agora },
      pd,
      pr,
    )
    return acao
      ? [{ acao, pct: aprendizadoPct(estado, d.matrizes, pd) ?? 0 }]
      : []
  })
  if (!candidatas.length) return null
  const reparos = candidatas.filter(
    (c) => c.acao.motivo === 'dificuldade' || c.acao.tipo === 'verificacao',
  )
  const escolhida = (reparos.length ? reparos : candidatas).reduce((a, b) =>
    b.pct < a.pct ? b : a,
  )
  const acao = escolhida.acao
  /* Simulado gradual: "continue praticando" (nada urgente) numa matéria já
     adiantada vale mais como treino amplo que como mais do mesmo — e o
     treino cresce com o nível até o simulado completo. Reparos e
     verificações pendentes nunca viram simulado. */
  if (acao.tipo === 'simulado' || acao.motivo === 'continuar') {
    const treino = (tamanho?: number): AcaoJornada => ({
      ...acao,
      tipo: 'simulado',
      tema: null,
      habilidade: null,
      aula: null,
      motivo: 'consolidado',
      tamanho,
    })
    if (escolhida.pct >= pj.simuladoPct * 100) return treino()
    if (escolhida.pct >= pj.treinoPct * 100) return treino(pj.treinoMedio)
    if (acao.tipo === 'simulado') return treino(pj.treinoCurto)
  }
  return acao
}

/* Dois estados para a tela: 'preparado' só sai de 'dominio-confirmado'
   (janela, taxa, essenciais, recorrências e verificação independente —
   nunca de tempo nem de conclusão por quantidade). */
export function estadoPreparo(
  dominio: DiagnosticoDominio,
): 'preparado' | 'continue' {
  return dominio.estado === 'dominio-confirmado' ? 'preparado' : 'continue'
}
