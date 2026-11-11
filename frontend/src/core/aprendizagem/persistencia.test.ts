import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { criarPersistencia, ErroAprendizagem } from './persistencia'
import { criarServicoAprendizagem } from './servico'
import { extrairEvidencias } from './evidencias'
import type { PersistenciaAprendizagem } from './persistencia'
import type {
  ConfiguracaoAprendizagem,
  EventoAprendizagem,
  MatrizTema,
  QuestaoAprendizagem,
} from './tipos'

const config: ConfiguracaoAprendizagem = {
  habilitado: true,
  registrarEventos: true,
  dominio: false,
  recomendacoes: false,
  disciplinas: ['matematica'],
}
const questao: QuestaoAprendizagem = {
  codigo: 'q1',
  disciplina: 'matematica',
  tema: 'numeros',
  revisaoApi: 'v1',
  pedagogia: {
    habilidade: 'contar',
    secundarias: [],
    familia: 'f1',
    revisao: 'aprovada',
    elegivel: true,
    versao: 1,
  },
}
const bancos: { nome: string; persistencias: PersistenciaAprendizagem[] }[] = []
function banco(
  armazenamento: () => Pick<Storage, 'removeItem'> = () => localStorage,
) {
  const nome = `estudae-aprendizagem-teste-${crypto.randomUUID()}`
  const fabrica = {
    open: (_nome: string, versao: number) => indexedDB.open(nome, versao),
  } as IDBFactory
  const p = criarPersistencia(() => fabrica, armazenamento)
  const registro = { nome, persistencias: [p] }
  bancos.push(registro)
  return {
    nome,
    p,
    outra: () => {
      const outra = criarPersistencia(() => fabrica, armazenamento)
      registro.persistencias.push(outra)
      return outra
    },
  }
}
async function acesso<T>(
  nome: string,
  modo: IDBTransactionMode,
  acao: (tx: IDBTransaction) => IDBRequest<T> | void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const r = indexedDB.open(nome)
    r.onerror = () => reject(r.error)
    r.onsuccess = () => {
      const db = r.result
      const tx = db.transaction(['controle', 'eventos', 'conclusoes'], modo)
      const pedido = acao(tx)
      tx.oncomplete = () => {
        db.close()
        resolve(pedido?.result as T)
      }
      tx.onabort = () => {
        db.close()
        reject(tx.error)
      }
    }
  })
}
function evento(id: string): EventoAprendizagem {
  return {
    id,
    geracao: 0,
    sessaoId: 's',
    modalidade: 'licao',
    tipo: 'apresentacao',
    instante: 1000,
    dataLocal: '1970-01-01',
    codigo: id,
    disciplina: 'matematica',
    tema: 'numeros',
    confiavel: true,
  }
}
afterEach(async () => {
  vi.restoreAllMocks()
  for (const b of bancos.splice(0)) {
    b.persistencias.forEach((p) => p.fechar())
    await new Promise<void>((resolve, reject) => {
      const r = indexedDB.deleteDatabase(b.nome)
      r.onsuccess = () => resolve()
      r.onerror = () => reject(r.error)
      r.onblocked = () => reject(new Error('Banco de teste bloqueado'))
    })
  }
})

it('falha explicitamente quando IndexedDB não existe', async () => {
  const p = criarPersistencia(() => undefined)
  await expect(p.ler()).rejects.toMatchObject({ codigo: 'indisponivel' })
})

describe('contratos IndexedDB com implementação simulada fake-indexeddb', () => {
  it('commit, abort e serialização entre conexões preservam sequência e revisões', async () => {
    const { p, outra } = banco()
    const p2 = outra()
    const inicial = await p.ler()
    expect(inicial.controle).toMatchObject({
      esquema: 1,
      geracao: 0,
      revisao: 0,
      ultimaSequencia: 0,
    })
    expect(inicial.controle.localLearnerId).toBeTruthy()
    await expect(
      p.alterar(0, (e) => {
        e.eventos.push(evento('abortada'))
        throw new Error('abortar')
      }),
    ).rejects.toThrow('abortar')
    expect((await p.ler()).eventos).toEqual([])
    await Promise.all([
      p.alterar(0, (e) => e.eventos.push(evento('z'))),
      p2.alterar(0, (e) => e.eventos.push(evento('a'))),
    ])
    const estado = await p.ler()
    expect(estado.eventos.map((e) => [e.id, e.sequencia])).toEqual([
      ['z', 1],
      ['a', 2],
    ])
    expect(estado.controle.revisao).toBe(2)
    await p.reiniciar()
    await expect(p.alterar(0, () => undefined)).rejects.toMatchObject({
      codigo: 'geracao',
    })
  })
  it('ler é readonly e não modifica revisão, identidade ou ledger', async () => {
    const { p, nome } = banco()
    await p.alterar(0, (e) => e.eventos.push(evento('a')))
    const antes = await p.ler()
    const spy = vi.spyOn(IDBDatabase.prototype, 'transaction')
    expect(await p.ler()).toEqual(antes)
    expect(spy.mock.calls.every((c) => c[1] === 'readonly')).toBe(true)
    const bruto = await acesso(nome, 'readonly', (tx) =>
      tx.objectStore('eventos').getAll(),
    )
    expect(bruto).toEqual(antes.eventos)
  })
  it.each([
    'controle-ausente',
    'esquema-futuro',
    'evento-invalido',
    'geracao-invalida',
  ])('preserva estado corrompido: %s', async (caso) => {
    const { p, nome } = banco()
    const estado = await p.ler()
    await acesso(nome, 'readwrite', (tx) => {
      if (caso === 'controle-ausente') tx.objectStore('controle').clear()
      if (caso === 'esquema-futuro')
        tx.objectStore('controle').put({ ...estado.controle, esquema: 999 })
      if (caso === 'geracao-invalida')
        tx.objectStore('controle').put({ ...estado.controle, geracao: -1 })
      if (caso === 'evento-invalido')
        tx.objectStore('eventos').add({ id: 'invalido', segredo: 'preservar' })
    })
    const antes = await acesso(nome, 'readonly', (tx) =>
      tx
        .objectStore(caso === 'evento-invalido' ? 'eventos' : 'controle')
        .getAll(),
    )
    await expect(p.ler()).rejects.toMatchObject({ codigo: 'corrompido' })
    await expect(
      p.alterar(undefined, (e) => {
        e.eventos = []
      }),
    ).rejects.toMatchObject({ codigo: 'corrompido' })
    expect(
      await acesso(nome, 'readonly', (tx) =>
        tx
          .objectStore(caso === 'evento-invalido' ? 'eventos' : 'controle')
          .getAll(),
      ),
    ).toEqual(antes)
  })
  it('reset explícito recupera ledger corrompido e invalida conexões/sessões antigas', async () => {
    const { p, nome, outra } = banco()
    const p2 = outra()
    await p.alterar(0, (e) => e.eventos.push(evento('a')))
    const antigo = await p.ler()
    await acesso(nome, 'readwrite', (tx) =>
      tx.objectStore('eventos').add({ id: 'invalido', segredo: 'preservar' }),
    )
    await expect(p.ler()).rejects.toMatchObject({ codigo: 'corrompido' })
    expect(
      (
        await acesso(nome, 'readonly', (tx) =>
          tx.objectStore('eventos').getAll(),
        )
      )
        .map((e) => e.id)
        .sort(),
    ).toEqual(['a', 'invalido'])
    await p.reiniciar()
    const novo = await p.ler()
    expect(novo.eventos).toEqual([])
    expect(novo.conclusoes).toEqual([])
    expect(novo.controle).toMatchObject({
      geracao: 1,
      revisao: antigo.controle.revisao + 1,
      resetPendente: false,
      ultimaSequencia: 0,
    })
    expect(novo.controle.localLearnerId).not.toBe(
      antigo.controle.localLearnerId,
    )
    await expect(
      p2.alterar(0, (e) => e.eventos.push(evento('antiga'))),
    ).rejects.toMatchObject({ codigo: 'geracao' })
    expect(
      await acesso(nome, 'readonly', (tx) =>
        tx.objectStore('eventos').getAll(),
      ),
    ).toEqual([])
  })
  it('reset explícito substitui controle ausente sem confiar em geração ou identidade antigas', async () => {
    const { p, nome } = banco()
    await p.ler()
    await acesso(nome, 'readwrite', (tx) => {
      tx.objectStore('controle').clear()
      tx.objectStore('eventos').add({ id: 'qualquer' })
      tx.objectStore('controle').add({
        id: 'principal',
        geracao: 900,
        localLearnerId: 'antiga',
      })
    })
    await expect(p.ler()).rejects.toMatchObject({ codigo: 'corrompido' })
    await p.reiniciar()
    const e = await p.ler()
    expect(e.controle).toMatchObject({
      geracao: 1,
      revisao: 1,
      resetPendente: false,
      ultimaSequencia: 0,
    })
    expect(e.controle.localLearnerId).not.toBe('antiga')
    expect(e.eventos).toEqual([])
  })
  it('rejeita mutações de ledger e controle e rollback parcial mantém exposição atômica', async () => {
    const { p } = banco()
    await p.alterar(0, (e) => e.eventos.push(evento('a')))
    const antes = await p.ler()
    await expect(
      p.alterar(0, (e) => {
        e.eventos[0]!.codigo = 'mudou'
      }),
    ).rejects.toMatchObject({ codigo: 'conflito' })
    await expect(
      p.alterar(0, (e) => {
        e.controle.localLearnerId = 'outro'
      }),
    ).rejects.toMatchObject({ codigo: 'conflito' })
    await expect(
      p.alterar(0, (e) => {
        e.eventos.push(evento('b'), { ...evento('c'), instante: NaN })
      }),
    ).rejects.toMatchObject({ codigo: 'corrompido' })
    expect(await p.ler()).toEqual(antes)
  })
  it('reset incompleto recupera com nova identidade, preservando preferências', async () => {
    localStorage.setItem('estudae:a11y', 'preferencias')
    localStorage.setItem('estudae:user', 'usuario')
    localStorage.setItem('estudae:nivel', 'medio')
    localStorage.setItem('estudae:results', 'resultados')
    localStorage.setItem('estudae:watched', 'aulas')
    let falhar = true
    const { p } = banco(() => ({
      removeItem(chave) {
        if (falhar && chave === 'estudae:watched') throw new Error('sem acesso')
        localStorage.removeItem(chave)
      },
    }))
    const identidade = (await p.ler()).controle.localLearnerId
    await expect(p.reiniciar()).rejects.toThrow('sem acesso')
    falhar = false
    const e = await p.ler()
    expect(e.controle).toMatchObject({
      esquema: 1,
      geracao: 1,
      resetPendente: false,
      ultimaSequencia: 0,
    })
    expect(e.controle.localLearnerId).not.toBe(identidade)
    expect(localStorage.getItem('estudae:results')).toBeNull()
    expect(localStorage.getItem('estudae:watched')).toBeNull()
    expect(localStorage.getItem('estudae:a11y')).toBe('preferencias')
    expect(localStorage.getItem('estudae:user')).toBe('usuario')
    expect(localStorage.getItem('estudae:nivel')).toBe('medio')
  })
  it('serviço congela texto submetido, escreve idempotente e finaliza canonicamente', async () => {
    const { p } = banco()
    const servico = criarServicoAprendizagem(config, { persistencia: p })
    const sessao = await servico.iniciarSessao('simulado')
    const c = { sessao, questao, tentativaId: 't1' }
    await servico.apresentar(c)
    await servico.submeter(c, true, false, 'texto escolhido')
    expect(await servico.pendente(c)).toMatchObject({
      respostaTexto: 'texto escolhido',
      revisaoApi: 'v1',
    })
    await servico.submeter(c, true, false, 'texto escolhido')
    await servico.corrigir(c, true, false, 'v1')
    await servico.corrigir(c, true, false, 'v1')
    expect(await servico.pendente(c)).toBeNull()
    await servico.concluir(sessao)
    await servico.concluir(sessao)
    const e = (await servico.ler())!
    expect(e.eventos).toHaveLength(4)
    expect(e.eventos.map((x) => x.sequencia)).toEqual([1, 2, 3, 4])
    expect(e.conclusoes).toHaveLength(1)
    expect(e.conclusoes[0]!.eventoIds).toEqual(
      e.eventos.map((x) => x.id).sort(),
    )
    await servico.reiniciar()
    await expect(
      servico.apresentar({ ...c, tentativaId: 't2' }),
    ).rejects.toMatchObject({ codigo: 'geracao' })
    expect(sessao.confiavel).toBe(false)
  })
  it('omissão entregue sem apresentação é gravada e não vira evidência', async () => {
    const { p } = banco()
    const servico = criarServicoAprendizagem(config, { persistencia: p })
    const sessao = await servico.iniciarSessao('simulado')
    const c = { sessao, questao, tentativaId: 't1' }
    await servico.submeter(c, false, false)
    await servico.corrigir(c, false, false, 'v1')
    await servico.concluir(sessao)
    const e = (await servico.ler())!
    expect(e.eventos.map((x) => x.tipo)).toEqual([
      'submissao',
      'correcao',
      'exposicao',
    ])
    const matriz: MatrizTema = {
      disciplina: questao.disciplina,
      tema: questao.tema,
      validada: true,
      habilidades: [{ slug: 'contar', essencial: true }],
      questoes: [questao],
    }
    expect(extrairEvidencias(e, matriz)).toEqual([])
    const rigorosa = await servico.iniciarSessao('licao')
    await expect(
      servico.submeter(
        { sessao: rigorosa, questao, tentativaId: 't2' },
        true,
        false,
        'resposta',
      ),
    ).rejects.toMatchObject({ codigo: 'conflito' })
  })
  it('conclusão de sessão sem eventos no escopo retorna desativado sem conclusão', async () => {
    const { p } = banco()
    const servico = criarServicoAprendizagem(
      { ...config, temas: ['matematica/geometria'] },
      { persistencia: p },
    )
    const sessao = await servico.iniciarSessao('simulado')
    expect(sessao.confiavel).toBe(true)
    expect(
      await servico.apresentar({ sessao, questao, tentativaId: 'fora' }),
    ).toEqual({ status: 'desativado' })
    expect(await servico.concluir(sessao)).toEqual({ status: 'desativado' })
    expect(sessao.confiavel).toBe(true)
    expect((await p.ler()).conclusoes).toEqual([])
    expect((await p.ler()).eventos).toEqual([])
  })
  it('não permite trocar resposta durante retry pendente', async () => {
    const { p } = banco()
    const servico = criarServicoAprendizagem(config, { persistencia: p })
    const c = {
      sessao: await servico.iniciarSessao('licao'),
      questao,
      tentativaId: 't1',
    }
    await servico.apresentar(c)
    await servico.submeter(c, true, false, 'primeiro')
    await expect(
      servico.submeter(c, true, false, 'outro'),
    ).rejects.toMatchObject({ codigo: 'conflito' })
    expect(
      (await p.ler()).eventos.find((e) => e.tipo === 'submissao')
        ?.respostaTexto,
    ).toBe('primeiro')
  })
  it('reset explícito funciona com configuração desabilitada', async () => {
    const { p } = banco()
    await p.alterar(0, (e) => e.eventos.push(evento('a')))
    const s = criarServicoAprendizagem(undefined, { persistencia: p })
    await s.reiniciar()
    expect((await p.ler()).eventos).toEqual([])
    expect((await p.ler()).controle.geracao).toBe(1)
  })
  it('request success seguido de abort não retorna salvo e reverte os dados', async () => {
    const { p } = banco()
    const servico = criarServicoAprendizagem(config, { persistencia: p })
    const sessao = await servico.iniciarSessao('licao')
    const original = IDBObjectStore.prototype.add
    vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(function (
      this: IDBObjectStore,
      valor,
      chave,
    ) {
      const pedido = original.call(this, valor, chave)
      if (this.name === 'eventos')
        pedido.addEventListener('success', () => this.transaction.abort())
      return pedido
    })
    await expect(
      servico.apresentar({ sessao, questao, tentativaId: 't1' }),
    ).rejects.toThrow()
    expect(sessao.confiavel).toBe(false)
    expect((await p.ler()).eventos).toEqual([])
  })
  it('escrita incremental não regrava nem limpa eventos anteriores', async () => {
    const { p } = banco()
    await p.alterar(0, (e) => e.eventos.push(evento('a')))
    const add = vi.spyOn(IDBObjectStore.prototype, 'add')
    const limpar = vi.spyOn(IDBObjectStore.prototype, 'clear')
    const put = vi.spyOn(IDBObjectStore.prototype, 'put')
    await p.alterar(0, (e) => e.eventos.push(evento('b')))
    expect(add).toHaveBeenCalledTimes(1)
    expect(limpar).not.toHaveBeenCalled()
    expect(put).toHaveBeenCalledTimes(1)
    expect((await p.ler()).eventos.map((e) => e.id)).toEqual(['a', 'b'])
  })
  it('abertura bloqueada rejeita sem migrar o banco após desbloqueio', async () => {
    const { p, nome } = banco()
    await p.ler()
    const bloqueadora = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open(nome)
      r.onsuccess = () => resolve(r.result)
      r.onerror = () => reject(r.error)
    })
    const fabrica = {
      open: () => indexedDB.open(nome, 2),
    } as unknown as IDBFactory
    const outra = criarPersistencia(() => fabrica)
    bancos[bancos.length - 1]!.persistencias.push(outra)
    await expect(outra.ler()).rejects.toMatchObject({ codigo: 'bloqueado' })
    bloqueadora.close()
    await new Promise<void>((resolve, reject) => {
      const r = indexedDB.open(nome)
      r.onsuccess = () => {
        expect(r.result.version).toBe(1)
        r.result.close()
        resolve()
      }
      r.onerror = () => reject(r.error)
    })
  })
  it('versionchange fecha conexão e exige recarga', async () => {
    const { p, nome } = banco()
    await p.ler()
    await new Promise<void>((resolve, reject) => {
      const r = indexedDB.open(nome, 2)
      r.onsuccess = () => {
        r.result.close()
        resolve()
      }
      r.onerror = () => reject(r.error)
      r.onblocked = () =>
        reject(new Error('versionchange não fechou a conexão'))
    })
    await expect(p.ler()).rejects.toBeInstanceOf(ErroAprendizagem)
  })
})
