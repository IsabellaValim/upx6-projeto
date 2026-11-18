/* Conta do aluno: telas de login/cadastro/confirmação e a sessão no boot,
   com o fetch trocado por respostas prontas (nada sai para a rede). */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { api, ErroApi } from '../core/api'
import { verificarSessao } from '../core/conta'
import { useApp } from '../core/store'
import type { A11y, CatalogSubject } from '../types'
import { A11Y_PADRAO, MATERIA, type AppState } from './helpers'

function reset(patch: Partial<AppState> = {}) {
  localStorage.clear()
  useApp.setState({
    user: null,
    nivel: null,
    a11y: { ...A11Y_PADRAO } as A11y,
    results: [],
    watched: {},
    quiz: null,
    simulado: null,
    subjects: { matematica: MATERIA } as Record<string, CatalogSubject>,
    catalogoStatus: 'ready',
    cadastroAberto: true, // não depende da resposta de /opcoes
    ...patch,
  })
}

type Resposta = { status: number; corpo?: unknown }
type Rotas = Record<string, Resposta | (() => Resposta)>

/* fetch falso: "POST /conta/entrar" → resposta. Rota sem resposta = 401
   (é o que /eu devolve para quem não está logado). */
function fetchFalso(rotas: Rotas) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    const chave = `${init?.method ?? 'GET'} ${String(url).replace(/^\/api/, '')}`
    const r = rotas[chave]
    const { status, corpo } =
      typeof r === 'function' ? r() : (r ?? { status: 401 })
    return new Response(corpo === undefined ? null : JSON.stringify(corpo), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  })
}

const chamadas = (f: ReturnType<typeof fetchFalso>, chave: string) =>
  f.mock.calls.filter(
    ([url, init]) => `${init?.method ?? 'GET'} ${String(url)}` === chave,
  )

const corpoDe = (f: ReturnType<typeof fetchFalso>, chave: string) =>
  JSON.parse(String(chamadas(f, chave)[0][1]?.body))

const abrir = (rota: string) => {
  window.history.pushState({}, '', rota)
  return render(<App />)
}

const digitar = (rotulo: string | RegExp, valor: string) =>
  fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } })

const MARIA = { nome: 'Maria da Silva', email: 'maria@gmail.com' }

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
beforeEach(() => reset())

describe('api: erros', () => {
  it('lê erro e código do corpo', async () => {
    fetchFalso({
      'POST /conta/entrar': {
        status: 403,
        corpo: {
          erro: 'Falta confirmar seu e-mail.',
          codigo: 'email-nao-confirmado',
        },
      },
    })
    const e = await api.conta.entrar('a@b.com', 'x').catch((x) => x)
    expect(e).toBeInstanceOf(ErroApi)
    expect(e).toMatchObject({
      status: 403,
      message: 'Falta confirmar seu e-mail.',
      codigo: 'email-nao-confirmado',
    })
  })

  it('sem corpo ou sem rede vira mensagem genérica', async () => {
    fetchFalso({ 'GET /conta/opcoes': { status: 404 } })
    const e404 = await api.conta.opcoes().catch((x) => x)
    expect(e404).toMatchObject({
      status: 404,
      message: expect.stringContaining('internet'),
    })

    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new TypeError('Failed to fetch'),
    )
    const eRede = await api.conta.opcoes().catch((x) => x)
    expect(eRede).toMatchObject({
      status: 0,
      message: expect.stringContaining('internet'),
    })
  })

  it('204 sem corpo não quebra', async () => {
    fetchFalso({ 'POST /conta/sair': { status: 204 } })
    await expect(api.conta.sair()).resolves.toBeUndefined()
  })
})

describe('sessão no boot', () => {
  it('cookie vencido (401) desloga a conta salva', async () => {
    reset({ user: { name: 'Maria', email: 'maria@gmail.com' } })
    fetchFalso({})
    await verificarSessao()
    expect(useApp.getState().user).toBeNull()
  })

  it('cookie válido atualiza nome e e-mail', async () => {
    fetchFalso({ 'GET /conta/eu': { status: 200, corpo: MARIA } })
    await verificarSessao()
    expect(useApp.getState().user).toEqual({
      name: 'Maria da Silva',
      email: 'maria@gmail.com',
    })
  })

  it('visitante não pergunta à API', async () => {
    reset({ user: { name: 'Visitante', guest: true } })
    const f = fetchFalso({})
    await verificarSessao()
    expect(chamadas(f, 'GET /api/conta/eu')).toHaveLength(0)
    expect(useApp.getState().user?.guest).toBe(true)
  })

  it('sem resposta (Render dormindo) não desloga', async () => {
    reset({ user: { name: 'Maria', email: 'maria@gmail.com' } })
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new TypeError('Failed to fetch'),
    )
    await verificarSessao()
    expect(useApp.getState().user?.name).toBe('Maria')
  })
})

describe('Login', () => {
  it('senha errada mostra a mensagem da API', async () => {
    fetchFalso({
      'POST /conta/entrar': {
        status: 401,
        corpo: { erro: 'E-mail ou senha incorretos.' },
      },
    })
    abrir('/login')
    digitar('E-mail', 'maria@gmail.com')
    digitar('Senha', 'senha errada')
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(
      await screen.findByText('E-mail ou senha incorretos.'),
    ).toBeInTheDocument()
    expect(useApp.getState().user).toBeNull()
  })

  it('e-mail não confirmado oferece reenviar', async () => {
    const f = fetchFalso({
      'POST /conta/entrar': {
        status: 403,
        corpo: {
          erro: 'Falta confirmar seu e-mail.',
          codigo: 'email-nao-confirmado',
        },
      },
      'POST /conta/reenviar-confirmacao': {
        status: 202,
        corpo: { mensagem: 'ok' },
      },
    })
    abrir('/login')
    digitar('E-mail', 'maria@gmail.com')
    digitar('Senha', 'netos da vovó')
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    fireEvent.click(
      await screen.findByRole('button', { name: /Enviar o e-mail de novo/ }),
    )
    expect(await screen.findByText(/Enviamos de novo/)).toBeInTheDocument()
    expect(corpoDe(f, 'POST /api/conta/reenviar-confirmacao')).toEqual({
      email: 'maria@gmail.com',
    })
  })

  it('login certo grava o usuário e sai da tela', async () => {
    fetchFalso({ 'POST /conta/entrar': { status: 200, corpo: MARIA } })
    abrir('/login')
    digitar('E-mail', 'maria@gmail.com')
    digitar('Senha', 'netos da vovó')
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    // sem prova escolhida, a guarda leva para a escolha
    expect(await screen.findByText(/Qual prova do Encceja/)).toBeInTheDocument()
    expect(useApp.getState().user).toEqual({
      name: 'Maria da Silva',
      email: 'maria@gmail.com',
    })
  })

  it('cadastro fechado esconde "Criar conta" e "Esqueci"', async () => {
    reset({ cadastroAberto: false })
    fetchFalso({})
    abrir('/login')
    await screen.findByRole('heading', { name: 'Entrar' })
    expect(screen.queryByText('Criar conta')).not.toBeInTheDocument()
    expect(screen.queryByText('Esqueci minha senha')).not.toBeInTheDocument()
  })
})

describe('Cadastro', () => {
  it('senha curta não chama a API', async () => {
    const f = fetchFalso({})
    abrir('/cadastro')
    digitar(/Como você quer ser chamado/, 'Maria')
    digitar('E-mail', 'maria@gmail.com')
    digitar('Crie uma senha', 'curta')
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    expect(
      await screen.findByText(/pelo menos 8 caracteres/),
    ).toBeInTheDocument()
    expect(chamadas(f, 'POST /api/conta/cadastro')).toHaveLength(0)
  })

  it('202 leva para "verifique seu e-mail" com o endereço', async () => {
    const f = fetchFalso({
      'POST /conta/cadastro': { status: 202, corpo: { mensagem: 'ok' } },
    })
    abrir('/cadastro')
    digitar(/Como você quer ser chamado/, 'Maria')
    digitar('E-mail', 'maria@gmail.com')
    digitar('Crie uma senha', 'netos da vovó')
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    expect(
      await screen.findByRole('heading', { name: 'Falta pouco!' }),
    ).toBeInTheDocument()
    expect(screen.getByText('maria@gmail.com')).toBeInTheDocument()
    expect(corpoDe(f, 'POST /api/conta/cadastro')).toEqual({
      nome: 'Maria',
      email: 'maria@gmail.com',
      senha: 'netos da vovó',
    })
  })
})

describe('Confirmar e-mail', () => {
  it('link válido confirma uma vez, entra e segue para o app', async () => {
    const f = fetchFalso({
      'POST /conta/confirmar-email': { status: 200, corpo: MARIA },
    })
    abrir('/confirmar-email?u=abc&t=tok')
    expect(await screen.findByText(/Qual prova do Encceja/)).toBeInTheDocument()
    expect(useApp.getState().user?.email).toBe('maria@gmail.com')
    expect(chamadas(f, 'POST /api/conta/confirmar-email')).toHaveLength(1)
    expect(corpoDe(f, 'POST /api/conta/confirmar-email')).toEqual({
      usuarioId: 'abc',
      token: 'tok',
    })
  })

  it('link vencido mostra o erro e o campo para pedir outro', async () => {
    fetchFalso({
      'POST /conta/confirmar-email': {
        status: 400,
        corpo: { erro: 'Este link não vale mais. Peça um novo e-mail.' },
      },
    })
    abrir('/confirmar-email?u=abc&t=velho')
    expect(
      await screen.findByText('Este link não vale mais. Peça um novo e-mail.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Mandar um link novo' }),
    ).toBeInTheDocument()
    expect(useApp.getState().user).toBeNull()
  })
})

describe('Redefinir senha', () => {
  it('senha nova entra na conta', async () => {
    const f = fetchFalso({
      'POST /conta/redefinir-senha': { status: 200, corpo: MARIA },
    })
    abrir('/redefinir-senha?u=abc&t=tok')
    digitar('Senha nova', 'outra frase longa')
    fireEvent.click(screen.getByRole('button', { name: 'Salvar senha nova' }))
    await waitFor(() =>
      expect(useApp.getState().user?.email).toBe('maria@gmail.com'),
    )
    expect(corpoDe(f, 'POST /api/conta/redefinir-senha')).toEqual({
      usuarioId: 'abc',
      token: 'tok',
      senha: 'outra frase longa',
    })
  })
})
