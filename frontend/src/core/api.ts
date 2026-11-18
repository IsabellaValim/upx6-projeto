/* ==========================================================
   API do Estudaê — chamadas HTTP (contrato em docs/api.md).
   Sempre mesma origem: em dev, o proxy do Vite repassa /api e
   /conteudo para a API em :5151 (ver vite.config.ts); em produção,
   o vercel.json repassa para o Render. O cookie da conta vai sozinho.
   ========================================================== */
import type {
  DisciplinaApi,
  ImportacaoApi,
  OpcoesContaApi,
  ProgressoApi,
  QuestaoApi,
  RespostaApi,
  SessaoDetalheApi,
  SessaoEnvioApi,
  SessaoResumoApi,
  TemaApi,
  UsuarioApi,
} from '../types'

const SEM_CONEXAO =
  'Não foi possível falar com o Estudaê. Confira sua internet e tente de novo.'

/* Erro da API com a mensagem já pronta para mostrar ao usuário.
   status 0 = sem resposta (rede fora, servidor fora do ar). */
export class ErroApi extends Error {
  readonly status: number
  readonly codigo?: string

  constructor(status: number, mensagem: string, codigo?: string) {
    super(mensagem)
    this.name = 'ErroApi'
    this.status = status
    this.codigo = codigo
  }
}

// Erros da API vêm como { "erro": "...", "codigo"?: "..." }. 404 de rota
// inexistente e falhas do proxy não têm corpo: mensagem genérica.
async function lerErro(r: Response): Promise<ErroApi> {
  try {
    const corpo = (await r.json()) as { erro?: unknown; codigo?: unknown }
    if (typeof corpo.erro === 'string')
      return new ErroApi(
        r.status,
        corpo.erro,
        typeof corpo.codigo === 'string' ? corpo.codigo : undefined,
      )
  } catch {
    /* sem corpo JSON */
  }
  return new ErroApi(r.status, SEM_CONEXAO)
}

async function pedir<T>(caminho: string, opcoes?: RequestInit): Promise<T> {
  let r: Response
  try {
    r = await fetch('/api' + caminho, opcoes)
  } catch {
    throw new ErroApi(0, SEM_CONEXAO)
  }
  if (!r.ok) throw await lerErro(r)
  if (r.status === 204) return undefined as T
  return r.json() as Promise<T>
}

const postar = <T>(caminho: string, corpo?: unknown) =>
  pedir<T>(caminho, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  })

const seg = encodeURIComponent

interface MensagemApi {
  mensagem: string
}

export const api = {
  disciplinas: () => pedir<DisciplinaApi[]>('/disciplinas'),
  temas: (disciplina: string) =>
    pedir<TemaApi[]>(`/disciplinas/${seg(disciplina)}/temas`),
  // imagem.url vem relativa à raiz da API ("conteudo/imagens/..."):
  // "/" + url resolve na mesma origem, em dev e em produção.
  questoes: (disciplina: string, tema: string) =>
    pedir<QuestaoApi[]>(
      `/disciplinas/${seg(disciplina)}/temas/${seg(tema)}/questoes`,
    ),
  // Envia o TEXTO exato da alternativa, nunca a letra nem a posição.
  resposta: (id: number, alternativa: string) =>
    postar<RespostaApi>(`/questoes/${seg(String(id))}/resposta`, {
      alternativa,
    }),

  // Conta do aluno (docs/api.md, "Conta do aluno").
  conta: {
    opcoes: () => pedir<OpcoesContaApi>('/conta/opcoes'),
    eu: () => pedir<UsuarioApi>('/conta/eu'),
    cadastro: (nome: string, email: string, senha: string) =>
      postar<MensagemApi>('/conta/cadastro', { nome, email, senha }),
    confirmarEmail: (usuarioId: string, token: string) =>
      postar<UsuarioApi>('/conta/confirmar-email', { usuarioId, token }),
    reenviar: (email: string) =>
      postar<MensagemApi>('/conta/reenviar-confirmacao', { email }),
    entrar: (email: string, senha: string) =>
      postar<UsuarioApi>('/conta/entrar', { email, senha }),
    sair: () => postar<void>('/conta/sair'),
    esqueciSenha: (email: string) =>
      postar<MensagemApi>('/conta/esqueci-senha', { email }),
    redefinirSenha: (usuarioId: string, token: string, senha: string) =>
      postar<UsuarioApi>('/conta/redefinir-senha', { usuarioId, token, senha }),
  },

  // Progresso de quem tem conta (docs/api.md, "Progresso do aluno").
  progresso: {
    listar: () => pedir<ProgressoApi>('/progresso'),
    // 201 nova, 200 chave já gravada: os dois devolvem o resumo.
    gravar: (sessao: SessaoEnvioApi) =>
      postar<SessaoResumoApi>('/progresso/sessoes', sessao),
    detalhe: (id: number) =>
      pedir<SessaoDetalheApi>(`/progresso/sessoes/${seg(String(id))}`),
    marcarAula: (videoaulaId: number) =>
      pedir<void>(`/progresso/aulas/${seg(String(videoaulaId))}`, {
        method: 'PUT',
      }),
    importar: (
      sessoes: SessaoEnvioApi[],
      aulas: { videoaulaId: number; assistidaEm: string }[],
    ) => postar<ImportacaoApi>('/progresso/importar', { sessoes, aulas }),
  },
}

/* Mensagem para mostrar de qualquer erro (ErroApi ou inesperado). */
export const mensagemDe = (e: unknown): string =>
  e instanceof ErroApi ? e.message : SEM_CONEXAO
