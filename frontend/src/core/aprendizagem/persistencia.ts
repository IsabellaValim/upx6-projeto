import type {
  ControleAprendizagem,
  EstadoAprendizagem,
  EventoAprendizagem,
} from './tipos'

export const NOME_BANCO = 'estudae-aprendizagem'
export const VERSAO_BANCO = 1
const stores = ['controle', 'eventos', 'conclusoes']

export class ErroAprendizagem extends Error {
  readonly codigo:
    | 'indisponivel'
    | 'bloqueado'
    | 'versao'
    | 'geracao'
    | 'reset'
    | 'conflito'
    | 'corrompido'
  constructor(codigo: ErroAprendizagem['codigo'], mensagem: string) {
    super(mensagem)
    this.codigo = codigo
    this.name = 'ErroAprendizagem'
  }
}

export interface PersistenciaAprendizagem {
  ler(): Promise<EstadoAprendizagem>
  alterar<T>(
    geracao: number | undefined,
    operacao: (estado: EstadoAprendizagem) => T,
  ): Promise<T>
  reiniciar(): Promise<void>
  recuperarReset(): Promise<void>
  fechar(): void
}

const objeto = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)
const texto = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0
const inteiro = (v: unknown): v is number =>
  Number.isSafeInteger(v) && (v as number) >= 0
const finito = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0
function falhar(): never {
  throw new ErroAprendizagem(
    'corrompido',
    'Registro de aprendizagem desconhecido ou inválido; dados preservados.',
  )
}
const igual = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b)

function controleValido(c: unknown): c is ControleAprendizagem {
  return (
    objeto(c) &&
    c.id === 'principal' &&
    c.esquema === 1 &&
    texto(c.localLearnerId) &&
    inteiro(c.geracao) &&
    inteiro(c.revisao) &&
    inteiro(c.ultimaSequencia) &&
    typeof c.resetPendente === 'boolean'
  )
}

function validarEstado(valor: unknown): asserts valor is EstadoAprendizagem {
  if (
    !objeto(valor) ||
    !objeto(valor.controle) ||
    !Array.isArray(valor.eventos) ||
    !Array.isArray(valor.conclusoes)
  )
    falhar()
  const c = valor.controle
  if (!controleValido(c)) falhar()
  const ids = new Set<string>()
  const sequencias = new Set<number>()
  for (const e of valor.eventos) {
    if (
      !objeto(e) ||
      !texto(e.id) ||
      ids.has(e.id) ||
      !texto(e.sessaoId) ||
      !texto(e.codigo) ||
      !texto(e.disciplina) ||
      !texto(e.tema) ||
      e.geracao !== c.geracao ||
      e.localLearnerId !== c.localLearnerId ||
      !inteiro(e.sequencia) ||
      e.sequencia === 0 ||
      e.sequencia > c.ultimaSequencia ||
      sequencias.has(e.sequencia) ||
      !finito(e.instante) ||
      typeof e.dataLocal !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(e.dataLocal) ||
      !['licao', 'simulado', 'rodada'].includes(e.modalidade as string) ||
      !['apresentacao', 'submissao', 'correcao', 'exposicao', 'ajuda'].includes(
        e.tipo as string,
      ) ||
      typeof e.confiavel !== 'boolean'
    )
      falhar()
    for (const chave of ['acertou', 'respondeu', 'incerta'])
      if (e[chave] !== undefined && typeof e[chave] !== 'boolean') falhar()
    for (const chave of ['tentativaId', 'revisaoApi'])
      if (e[chave] !== undefined && !texto(e[chave])) falhar()
    if (e.respostaTexto !== undefined && typeof e.respostaTexto !== 'string')
      falhar()
    if (e.metadados !== undefined && e.metadados !== null) {
      const m = e.metadados
      if (
        !objeto(m) ||
        !texto(m.habilidade) ||
        !texto(m.familia) ||
        !Array.isArray(m.secundarias) ||
        !m.secundarias.every(texto) ||
        !['pendente', 'aprovada', 'rejeitada'].includes(m.revisao as string) ||
        typeof m.elegivel !== 'boolean' ||
        !inteiro(m.versao) ||
        m.versao === 0
      )
        falhar()
    }
    ids.add(e.id)
    sequencias.add(e.sequencia)
  }
  if (sequencias.size !== c.ultimaSequencia) falhar()
  const finais = new Set<string>()
  for (const f of valor.conclusoes) {
    if (
      !objeto(f) ||
      !texto(f.id) ||
      finais.has(f.id) ||
      !texto(f.sessaoId) ||
      f.geracao !== c.geracao ||
      !finito(f.instante) ||
      !Array.isArray(f.eventoIds) ||
      !f.eventoIds.every(texto) ||
      new Set(f.eventoIds).size !== f.eventoIds.length
    )
      falhar()
    const eventos = valor.eventos.filter(
      (e: EventoAprendizagem) => e.sessaoId === f.sessaoId,
    )
    const instanteFinal = f.instante
    if (
      !eventos.length ||
      eventos.some((e: EventoAprendizagem) => e.instante > instanteFinal) ||
      !igual(
        [...f.eventoIds].sort(),
        eventos.map((e: EventoAprendizagem) => e.id).sort(),
      )
    )
      falhar()
    finais.add(f.id)
  }
}

function controleInicial(geracao = 0, revisao = 0): ControleAprendizagem {
  return {
    id: 'principal',
    esquema: 1,
    localLearnerId: crypto.randomUUID(),
    geracao,
    revisao,
    ultimaSequencia: 0,
    resetPendente: false,
  }
}

export function criarPersistencia(
  fabrica: () => IDBFactory | undefined = () => globalThis.indexedDB,
  armazenamento: () => Pick<Storage, 'removeItem'> = () =>
    globalThis.localStorage,
): PersistenciaAprendizagem {
  let conexao: Promise<IDBDatabase> | undefined
  let invalidada = false
  function abrir(): Promise<IDBDatabase> {
    if (invalidada)
      return Promise.reject(
        new ErroAprendizagem(
          'versao',
          'Armazenamento atualizado; recarregue a página.',
        ),
      )
    if (conexao) return conexao
    conexao = new Promise((resolve, reject) => {
      const idb = fabrica()
      if (!idb)
        throw new ErroAprendizagem('indisponivel', 'IndexedDB indisponível.')
      const pedido = idb.open(NOME_BANCO, VERSAO_BANCO)
      let encerrado = false
      pedido.onupgradeneeded = (e) => {
        if (encerrado || e.oldVersion !== 0) {
          pedido.transaction?.abort()
          return
        }
        const db = pedido.result
        const controle = db.createObjectStore('controle', { keyPath: 'id' })
        controle.add(controleInicial())
        const eventos = db.createObjectStore('eventos', { keyPath: 'id' })
        eventos.createIndex('porSessao', ['geracao', 'sessaoId'])
        eventos.createIndex('porEscopo', ['geracao', 'disciplina', 'tema'])
        eventos.createIndex('porSequencia', 'sequencia', { unique: true })
        db.createObjectStore('conclusoes', { keyPath: 'id' }).createIndex(
          'porSessao',
          ['geracao', 'sessaoId'],
          { unique: true },
        )
      }
      pedido.onblocked = () => {
        encerrado = true
        reject(
          new ErroAprendizagem(
            'bloqueado',
            'Feche as outras abas para atualizar o armazenamento.',
          ),
        )
      }
      pedido.onerror = () =>
        reject(
          pedido.error ??
            new ErroAprendizagem(
              'indisponivel',
              'Não foi possível abrir o armazenamento.',
            ),
        )
      pedido.onsuccess = () => {
        const db = pedido.result
        if (encerrado) {
          db.close()
          return
        }
        if (
          !igual(Array.from(db.objectStoreNames).sort(), [...stores].sort())
        ) {
          db.close()
          reject(
            new ErroAprendizagem(
              'corrompido',
              'Estrutura desconhecida; dados preservados.',
            ),
          )
          return
        }
        try {
          const estrutura = db.transaction(stores, 'readonly')
          const esperados: Record<
            string,
            Record<string, { chave: string | string[]; unica: boolean }>
          > = {
            controle: {},
            eventos: {
              porSessao: { chave: ['geracao', 'sessaoId'], unica: false },
              porEscopo: {
                chave: ['geracao', 'disciplina', 'tema'],
                unica: false,
              },
              porSequencia: { chave: 'sequencia', unica: true },
            },
            conclusoes: {
              porSessao: { chave: ['geracao', 'sessaoId'], unica: true },
            },
          }
          for (const nome of stores) {
            const store = estrutura.objectStore(nome)
            if (
              store.keyPath !== 'id' ||
              store.autoIncrement ||
              !igual(
                Array.from(store.indexNames).sort(),
                Object.keys(esperados[nome]!).sort(),
              )
            )
              falhar()
            for (const [indice, definicao] of Object.entries(
              esperados[nome]!,
            )) {
              const atual = store.index(indice)
              if (
                !igual(atual.keyPath, definicao.chave) ||
                atual.unique !== definicao.unica ||
                atual.multiEntry
              )
                falhar()
            }
          }
        } catch (erro) {
          db.close()
          reject(erro)
          return
        }
        db.onversionchange = () => {
          invalidada = true
          db.close()
        }
        db.onclose = () => {
          invalidada = true
        }
        resolve(db)
      }
    })
    return conexao
  }

  async function transacao<T>(
    modo: IDBTransactionMode,
    permitirReset: boolean,
    operacao: (estado: EstadoAprendizagem) => T,
    geracao?: number,
    reset = false,
  ): Promise<T> {
    const db = await abrir()
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(stores, modo)
      let resultado: T
      let falha: unknown
      tx.oncomplete = () => resolve(resultado)
      tx.onabort = () =>
        reject(
          falha ??
            tx.error ??
            new ErroAprendizagem('indisponivel', 'Transação cancelada.'),
        )
      tx.onerror = () => {
        falha ??= tx.error
      }
      const controles = tx.objectStore('controle').getAll()
      const eventos = tx.objectStore('eventos').getAll()
      const conclusoes = tx.objectStore('conclusoes').getAll()
      let prontos = 0
      const recebido = () => {
        if (++prontos !== 3) return
        try {
          if (controles.result.length !== 1) falhar()
          const estado: EstadoAprendizagem = {
            controle: controles.result[0],
            eventos: eventos.result,
            conclusoes: conclusoes.result,
          }
          validarEstado(estado)
          estado.eventos.sort((a, b) => a.sequencia! - b.sequencia!)
          const antes = structuredClone(estado)
          if (geracao !== undefined && geracao !== estado.controle.geracao)
            throw new ErroAprendizagem(
              'geracao',
              'Sessão anterior ao reinício.',
            )
          if (estado.controle.resetPendente && !permitirReset)
            throw new ErroAprendizagem(
              'reset',
              'Reinício pendente; tente novamente.',
            )
          resultado = operacao(estado)
          if (
            resultado &&
            typeof (resultado as { then?: unknown }).then === 'function'
          )
            throw new ErroAprendizagem(
              'conflito',
              'Operação transacional deve ser síncrona.',
            )
          if (modo === 'readonly') return
          if (
            !reset &&
            (estado.controle.geracao !== antes.controle.geracao ||
              estado.controle.localLearnerId !==
                antes.controle.localLearnerId ||
              estado.controle.esquema !== antes.controle.esquema ||
              estado.controle.ultimaSequencia !==
                antes.controle.ultimaSequencia ||
              estado.controle.revisao !== antes.controle.revisao ||
              (!permitirReset &&
                estado.controle.resetPendente !== antes.controle.resetPendente))
          )
            throw new ErroAprendizagem(
              'conflito',
              'Controle não pode ser alterado pela operação.',
            )
          const antigos = new Map(antes.eventos.map((e) => [e.id, e]))
          if (
            !reset &&
            antes.eventos.some(
              (e) => !estado.eventos.some((n) => n.id === e.id && igual(e, n)),
            )
          )
            throw new ErroAprendizagem('conflito', 'Eventos são imutáveis.')
          if (
            !reset &&
            antes.conclusoes.some(
              (e) =>
                !estado.conclusoes.some((n) => n.id === e.id && igual(e, n)),
            )
          )
            throw new ErroAprendizagem('conflito', 'Conclusões são imutáveis.')
          for (const e of estado.eventos) {
            if (!antigos.has(e.id)) {
              e.sequencia = ++estado.controle.ultimaSequencia
              e.localLearnerId = estado.controle.localLearnerId
            }
          }
          if (!igual(antes, estado))
            estado.controle.revisao = antes.controle.revisao + 1
          validarEstado(estado)
          if (reset) {
            tx.objectStore('eventos').clear()
            tx.objectStore('conclusoes').clear()
          }
          for (const e of estado.eventos)
            if (reset || !antigos.has(e.id)) tx.objectStore('eventos').add(e)
          const finais = new Set(antes.conclusoes.map((f) => f.id))
          for (const f of estado.conclusoes)
            if (reset || !finais.has(f.id)) tx.objectStore('conclusoes').add(f)
          if (!igual(antes.controle, estado.controle))
            tx.objectStore('controle').put(estado.controle)
        } catch (erro) {
          falha = erro
          tx.abort()
        }
      }
      controles.onsuccess = recebido
      eventos.onsuccess = recebido
      conclusoes.onsuccess = recebido
    })
  }

  async function recuperarReset(): Promise<void> {
    const pendente = await transacao(
      'readonly',
      true,
      (e) => e.controle.resetPendente,
    )
    if (!pendente) return
    await transacao('readwrite', true, (e) => {
      if (!e.controle.resetPendente) return
      armazenamento().removeItem('estudae:results')
      armazenamento().removeItem('estudae:watched')
      e.controle.resetPendente = false
    })
  }

  return {
    async ler() {
      await recuperarReset()
      return transacao('readonly', false, (e) => e)
    },
    async alterar(geracao, operacao) {
      await recuperarReset()
      return transacao('readwrite', false, operacao, geracao)
    },
    async reiniciar() {
      const db = await abrir()
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(stores, 'readwrite')
        let falha: unknown
        tx.oncomplete = () => resolve()
        tx.onabort = () =>
          reject(
            falha ??
              tx.error ??
              new ErroAprendizagem('indisponivel', 'Transação cancelada.'),
          )
        tx.onerror = () => {
          falha ??= tx.error
        }
        const pedido = tx.objectStore('controle').get('principal')
        pedido.onsuccess = () => {
          try {
            const anterior = pedido.result
            const confiavel = controleValido(anterior)
            const controle = {
              ...controleInicial(
                confiavel ? anterior.geracao + 1 : 1,
                confiavel ? anterior.revisao : 0,
              ),
              resetPendente: true,
            }
            tx.objectStore('controle').clear()
            tx.objectStore('eventos').clear()
            tx.objectStore('conclusoes').clear()
            tx.objectStore('controle').add(controle)
          } catch (erro) {
            falha = erro
            tx.abort()
          }
        }
      })
      await recuperarReset()
    },
    recuperarReset,
    fechar() {
      invalidada = true
      void conexao?.then(
        (db) => db.close(),
        () => undefined,
      )
    },
  }
}
