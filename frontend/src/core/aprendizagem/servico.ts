import { aprendizagemAtiva, CONFIG_APRENDIZAGEM } from './config'
import { criarPersistencia, ErroAprendizagem } from './persistencia'
import { recomendar } from './recomendacao'
import type { PersistenciaAprendizagem } from './persistencia'
import type {
  ConfiguracaoAprendizagem,
  ConclusaoAprendizagem,
  EstadoAprendizagem,
  EventoAprendizagem,
  MatrizTema,
  QuestaoAprendizagem,
  SessaoAprendizagem,
} from './tipos'

export type GravacaoAprendizagem =
  | { status: 'salvo' }
  | { status: 'desativado' }
export interface ContextoTentativa {
  sessao: SessaoAprendizagem
  questao: QuestaoAprendizagem
  tentativaId: string
}
export interface DependenciasAprendizagem {
  persistencia?: PersistenciaAprendizagem
  agora?: () => number
  novoId?: () => string
}

export function criarServicoAprendizagem(
  configuracao: ConfiguracaoAprendizagem = CONFIG_APRENDIZAGEM,
  dependencias: DependenciasAprendizagem = {},
) {
  const config = configuracao
  const persistencia = dependencias.persistencia ?? criarPersistencia()
  const agora = dependencias.agora ?? Date.now
  const novoId = dependencias.novoId ?? (() => crypto.randomUUID())
  let fila: Promise<unknown> = Promise.resolve()
  const serializar = <T>(operacao: () => Promise<T>): Promise<T> => {
    const proxima = fila.then(operacao, operacao)
    fila = proxima.catch(() => undefined)
    return proxima
  }
  const ativa = (q?: QuestaoAprendizagem) =>
    aprendizagemAtiva(config, q?.disciplina, q?.tema)
  const chave = (c: ContextoTentativa, tipo: string) =>
    JSON.stringify([c.sessao.id, c.tentativaId, tipo])
  function evento(
    c: ContextoTentativa,
    tipo: EventoAprendizagem['tipo'],
  ): EventoAprendizagem {
    const instante = agora()
    const d = new Date(instante)
    return {
      id: chave(c, tipo),
      sessaoId: c.sessao.id,
      geracao: c.sessao.geracao,
      modalidade: c.sessao.modalidade,
      confiavel: c.sessao.confiavel,
      tipo,
      instante,
      dataLocal: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      codigo: c.questao.codigo,
      disciplina: c.questao.disciplina,
      tema: c.questao.tema,
      tentativaId: c.tentativaId,
      metadados: c.questao.pedagogia
        ? {
            ...c.questao.pedagogia,
            secundarias: [...c.questao.pedagogia.secundarias],
          }
        : null,
    }
  }
  function inserir(e: EstadoAprendizagem, novo: EventoAprendizagem) {
    const anterior = e.eventos.find((x) => x.id === novo.id)
    if (!anterior) {
      if (e.conclusoes.some((f) => f.sessaoId === novo.sessaoId))
        throw new ErroAprendizagem('conflito', 'Sessão já finalizada.')
      if (
        !Number.isFinite(novo.instante) ||
        e.eventos.some(
          (x) => x.sessaoId === novo.sessaoId && x.instante > novo.instante,
        )
      )
        throw new ErroAprendizagem('conflito', 'Relógio inconsistente.')
      e.eventos.push(novo)
      return
    }
    const {
      instante: _a,
      dataLocal: _b,
      sequencia: _s1,
      localLearnerId: _l1,
      ...antes
    } = anterior
    const {
      instante: _c,
      dataLocal: _d,
      sequencia: _s2,
      localLearnerId: _l2,
      ...depois
    } = novo
    if (JSON.stringify(antes) !== JSON.stringify(depois))
      throw new ErroAprendizagem(
        'conflito',
        'Evento já gravado com outros dados.',
      )
  }
  function gravar(
    c: ContextoTentativa,
    operacao: (e: EstadoAprendizagem) => void,
  ): Promise<GravacaoAprendizagem> {
    if (!ativa(c.questao)) return Promise.resolve({ status: 'desativado' })
    return serializar(async () => {
      try {
        if (!c.sessao.confiavel)
          throw new ErroAprendizagem(
            'indisponivel',
            'Sessão sem registro confiável.',
          )
        await persistencia.alterar(c.sessao.geracao, (e) => {
          if (
            c.sessao.localLearnerId &&
            c.sessao.localLearnerId !== e.controle.localLearnerId
          )
            throw new ErroAprendizagem('geracao', 'Identidade local alterada.')
          operacao(e)
        })
        return { status: 'salvo' as const }
      } catch (erro) {
        c.sessao.confiavel = false
        throw erro
      }
    })
  }
  function obterSubmissao(e: EstadoAprendizagem, c: ContextoTentativa) {
    const s = e.eventos.find((x) => x.id === chave(c, 'submissao'))
    if (!s || s.codigo !== c.questao.codigo)
      throw new ErroAprendizagem('conflito', 'Submissão não registrada.')
    return s
  }
  return {
    async iniciarSessao(
      modalidade: SessaoAprendizagem['modalidade'],
    ): Promise<SessaoAprendizagem> {
      if (!ativa())
        return {
          id: novoId(),
          geracao: -1,
          confiavel: false,
          modalidade,
          inicio: agora(),
        }
      return serializar(async () => {
        const estado = await persistencia.ler()
        return {
          id: novoId(),
          geracao: estado.controle.geracao,
          localLearnerId: estado.controle.localLearnerId,
          confiavel: true,
          modalidade,
          inicio: agora(),
        }
      })
    },
    apresentar(c: ContextoTentativa) {
      const novo = evento(c, 'apresentacao')
      return gravar(c, (e) => inserir(e, novo))
    },
    ajudar(c: ContextoTentativa) {
      const novo = evento(c, 'ajuda')
      return gravar(c, (e) => inserir(e, novo))
    },
    submeter(
      c: ContextoTentativa,
      respondeu: boolean,
      incerta = false,
      respostaTexto?: string,
      revisaoApi = c.questao.revisaoApi,
    ) {
      const novo = {
        ...evento(c, 'submissao'),
        respondeu,
        incerta:
          incerta || (respondeu && !respostaTexto?.trim()) || !revisaoApi,
        ...(respostaTexto !== undefined ? { respostaTexto } : {}),
        ...(revisaoApi ? { revisaoApi } : {}),
      }
      return gravar(c, (e) => {
        const apresentacao = e.eventos.find(
          (x) => x.id === chave(c, 'apresentacao'),
        )
        if (
          respondeu &&
          (!apresentacao ||
            apresentacao.codigo !== novo.codigo ||
            apresentacao.instante > novo.instante)
        ) {
          throw new ErroAprendizagem('conflito', 'Apresentação não registrada.')
        }
        inserir(e, novo)
      })
    },
    corrigir(
      c: ContextoTentativa,
      acertou: boolean,
      incerta = false,
      revisaoApi?: string,
    ) {
      const correcao = {
        ...evento(c, 'correcao'),
        acertou,
        incerta: incerta || !revisaoApi,
        ...(revisaoApi ? { revisaoApi } : {}),
      }
      const exposicao = {
        ...evento(c, 'exposicao'),
        instante: correcao.instante,
        dataLocal: correcao.dataLocal,
      }
      return gravar(c, (e) => {
        const s = obterSubmissao(e, c)
        if (correcao.instante < s.instante)
          throw new ErroAprendizagem('conflito', 'Relógio inconsistente.')
        inserir(e, correcao)
        inserir(e, exposicao)
      })
    },
    expor(c: ContextoTentativa) {
      const novo = evento(c, 'exposicao')
      return gravar(c, (e) => inserir(e, novo))
    },
    concluir(sessao: SessaoAprendizagem): Promise<GravacaoAprendizagem> {
      if (!ativa()) return Promise.resolve({ status: 'desativado' })
      return serializar(async () => {
        try {
          if (!sessao.confiavel && sessao.geracao === -1)
            return { status: 'desativado' as const }
          if (!sessao.confiavel)
            throw new ErroAprendizagem(
              'indisponivel',
              'Sessão sem registro confiável.',
            )
          const resultado = await persistencia.alterar(sessao.geracao, (e) => {
            if (
              sessao.localLearnerId &&
              sessao.localLearnerId !== e.controle.localLearnerId
            )
              throw new ErroAprendizagem(
                'geracao',
                'Identidade local alterada.',
              )
            if (e.conclusoes.some((f) => f.sessaoId === sessao.id)) return
            const eventos = e.eventos.filter((x) => x.sessaoId === sessao.id)
            const submissoes = eventos.filter((x) => x.tipo === 'submissao')
            if (!submissoes.length) return 'desativado' as const
            if (
              submissoes.some(
                (s) =>
                  !eventos.some(
                    (c) =>
                      c.tipo === 'correcao' && c.tentativaId === s.tentativaId,
                  ),
              )
            ) {
              throw new ErroAprendizagem(
                'conflito',
                'Sessão com correções pendentes.',
              )
            }
            const instante = agora()
            if (eventos.some((x) => x.instante > instante))
              throw new ErroAprendizagem('conflito', 'Relógio inconsistente.')
            const conclusao: ConclusaoAprendizagem = {
              id: sessao.id,
              sessaoId: sessao.id,
              geracao: sessao.geracao,
              instante,
              eventoIds: eventos.map((x) => x.id).sort(),
            }
            e.conclusoes.push(conclusao)
            return 'salvo' as const
          })
          return resultado === 'desativado'
            ? { status: 'desativado' as const }
            : { status: 'salvo' as const }
        } catch (erro) {
          sessao.confiavel = false
          throw erro
        }
      })
    },
    ler(): Promise<EstadoAprendizagem | null> {
      return ativa()
        ? serializar(() => persistencia.ler())
        : Promise.resolve(null)
    },
    recomendar(matrizes: readonly MatrizTema[], instante = agora()) {
      if (!ativa()) return Promise.resolve(null)
      return serializar(async () => {
        const estado = await persistencia.ler()
        return recomendar(estado, matrizes, instante)
      })
    },
    pendente(c: ContextoTentativa): Promise<EventoAprendizagem | null> {
      if (!ativa(c.questao)) return Promise.resolve(null)
      return serializar(async () => {
        const e = await persistencia.ler()
        if (
          e.controle.geracao !== c.sessao.geracao ||
          (c.sessao.localLearnerId &&
            c.sessao.localLearnerId !== e.controle.localLearnerId)
        )
          throw new ErroAprendizagem('geracao', 'Sessão anterior ao reinício.')
        const s = e.eventos.find((x) => x.id === chave(c, 'submissao'))
        return s &&
          !e.eventos.some(
            (x) =>
              x.sessaoId === s.sessaoId &&
              x.tentativaId === s.tentativaId &&
              x.tipo === 'correcao',
          )
          ? s
          : null
      })
    },
    reiniciar(): Promise<void> {
      return serializar(() => persistencia.reiniciar())
    },
    fechar() {
      persistencia.fechar()
    },
  }
}

export type ServicoAprendizagem = ReturnType<typeof criarServicoAprendizagem>
