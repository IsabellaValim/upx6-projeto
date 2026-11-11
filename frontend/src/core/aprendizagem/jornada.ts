/* Orquestrador da jornada guiada: responde "o que a pessoa faz agora?" com
   UMA ação. Puro e determinístico — as telas só traduzem a resposta em
   link e texto. A ordem reflete o fluxo do Estudaê Inteligente: cuidar da
   dificuldade recorrente, fechar a verificação pendente (rodada posterior
   com questões inéditas), introduzir habilidade nova, revisar, continuar —
   e, quando nada disso falta, reconhecer o escopo avaliado como preparado
   ou sugerir o simulado. Nunca inventa caminho: sem matrizes avaliáveis,
   devolve null e o chamador segue no fluxo tradicional. */
import { avaliarDominio } from './dominio'
import { extrairEvidencias } from './evidencias'
import { recomendar } from './recomendacao'
import type {
  DiagnosticoDominio,
  EstadoAprendizagem,
  MatrizTema,
  MotivoRecomendacao,
  ParametrosDominio,
  ParametrosRecomendacao,
} from './tipos'
import { PARAMETROS_DOMINIO, PARAMETROS_RECOMENDACAO } from './config'

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

  // Nenhuma pendência recomendável: tudo que dá para provar já foi provado.
  // O próximo passo é treino amplo — o estado preparado já vai no escopo.
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

/* Dois estados para a tela: 'preparado' só sai de 'dominio-confirmado'
   (janela, taxa, essenciais, recorrências e verificação independente —
   nunca de tempo nem de conclusão por quantidade). */
export function estadoPreparo(
  dominio: DiagnosticoDominio,
): 'preparado' | 'continue' {
  return dominio.estado === 'dominio-confirmado' ? 'preparado' : 'continue'
}
