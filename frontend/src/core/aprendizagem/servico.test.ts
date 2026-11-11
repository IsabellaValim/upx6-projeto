import { describe, expect, it, vi } from 'vitest'
import { CONFIG_APRENDIZAGEM } from './config'
import { criarServicoAprendizagem } from './servico'
import type {
  ConfiguracaoAprendizagem,
  EstadoAprendizagem,
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
  pedagogia: null,
}
function fronteira() {
  return {
    ler: vi.fn<() => Promise<EstadoAprendizagem>>(),
    alterar: vi.fn(),
    reiniciar: vi.fn(),
    recuperarReset: vi.fn(),
    fechar: vi.fn(),
  }
}

describe('serviço de aprendizagem', () => {
  it('todos os flags começam desligados e a allowlist vazia', () => {
    expect(CONFIG_APRENDIZAGEM).toEqual({
      habilitado: false,
      registrarEventos: false,
      dominio: false,
      recomendacoes: false,
      disciplinas: [],
      temas: [],
    })
  })
  it('desativado nunca acessa persistência e não retorna salvo', async () => {
    const p = fronteira()
    const s = criarServicoAprendizagem(undefined, {
      persistencia: p,
      novoId: () => 's',
    })
    const sessao = await s.iniciarSessao('licao')
    const c = { sessao, questao, tentativaId: 't' }
    expect(sessao.confiavel).toBe(false)
    expect(await s.apresentar(c)).toEqual({ status: 'desativado' })
    expect(await s.submeter(c, true)).toEqual({ status: 'desativado' })
    expect(await s.corrigir(c, true)).toEqual({ status: 'desativado' })
    expect(await s.concluir(sessao)).toEqual({ status: 'desativado' })
    expect(await s.ler()).toBeNull()
    expect(p.ler).not.toHaveBeenCalled()
    expect(p.alterar).not.toHaveBeenCalled()
    expect(p.reiniciar).not.toHaveBeenCalled()
  })
  it('disciplina fora da allowlist não escreve', async () => {
    const p = fronteira()
    const s = criarServicoAprendizagem(config, { persistencia: p })
    const sessao = {
      id: 's',
      geracao: 0,
      confiavel: true,
      modalidade: 'licao' as const,
      inicio: 0,
    }
    expect(
      await s.apresentar({
        sessao,
        questao: { ...questao, disciplina: 'linguagens' },
        tentativaId: 't',
      }),
    ).toEqual({ status: 'desativado' })
    expect(p.alterar).not.toHaveBeenCalled()
  })
  it.each([
    { temas: undefined, permitido: true },
    { temas: ['matematica/numeros'], permitido: true },
    { temas: ['matematica/geometria'], permitido: false },
    { temas: [], permitido: false },
  ])(
    'escopo por tema ($temas) decide registro',
    async ({ temas, permitido }) => {
      const p = fronteira()
      const s = criarServicoAprendizagem(
        { ...config, temas },
        { persistencia: p },
      )
      const sessao = {
        id: 's',
        geracao: 0,
        confiavel: true,
        modalidade: 'licao' as const,
        inicio: 0,
      }
      expect(await s.apresentar({ sessao, questao, tentativaId: 't' })).toEqual(
        { status: permitido ? 'salvo' : 'desativado' },
      )
      expect(p.alterar).toHaveBeenCalledTimes(permitido ? 1 : 0)
    },
  )
  it('combinação inválida de flags/allowlists cai em modo seguro', async () => {
    const p = fronteira()
    for (const c of [
      { ...config, registrarEventos: false },
      { ...config, habilitado: false, dominio: true },
      { ...config, disciplinas: ['matematica', ''] },
      { ...config, temas: ['sem-barras'] },
    ]) {
      const s = criarServicoAprendizagem(c, { persistencia: p })
      expect(await s.iniciarSessao('licao')).toMatchObject({ confiavel: false })
    }
    expect(p.ler).not.toHaveBeenCalled()
  })
  it('só retorna salvo depois da promessa de commit, sem mascarar rejeição', async () => {
    const p = fronteira()
    let rejeitar!: (e: Error) => void
    p.alterar.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejeitar = reject
      }),
    )
    const s = criarServicoAprendizagem(config, { persistencia: p })
    const sessao = {
      id: 's',
      geracao: 0,
      confiavel: true,
      modalidade: 'licao' as const,
      inicio: 0,
    }
    let finalizou = false
    const gravacao = s.apresentar({ sessao, questao, tentativaId: 't' })
    void gravacao.then(
      () => {
        finalizou = true
      },
      () => undefined,
    )
    await Promise.resolve()
    expect(finalizou).toBe(false)
    rejeitar(new Error('QuotaExceededError'))
    await expect(gravacao).rejects.toThrow('QuotaExceededError')
    expect(sessao.confiavel).toBe(false)
    expect(finalizou).toBe(false)
    await expect(
      s.submeter({ sessao, questao, tentativaId: 't' }, true),
    ).rejects.toThrow('Sessão sem registro confiável')
  })
  it('falha ao iniciar não fabrica sessão confiável', async () => {
    const p = fronteira()
    p.ler.mockRejectedValue(new Error('bloqueado'))
    const s = criarServicoAprendizagem(config, { persistencia: p })
    await expect(s.iniciarSessao('licao')).rejects.toThrow('bloqueado')
  })
})
