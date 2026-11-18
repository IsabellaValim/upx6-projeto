/* ==========================================================
   Conta do aluno no front: a sessão de verdade é o cookie
   HttpOnly da API; o `user` do store é só o espelho para as telas
   (nome e e-mail), guardado em estudae:user como antes.
   ========================================================== */
import { api, ErroApi } from './api'
import { sincronizarProgresso } from './progresso'
import { useApp } from './store'
import type { UsuarioApi } from '../types'

export const SENHA_MINIMA = 8 // PoliticaConta do backend (8 a 128, sem regra de composição)

/* Também a cada abertura do app (verificarSessao): junta o progresso do
   aparelho com o da conta, sem segurar a tela. */
export function entrarNaConta(u: UsuarioApi): void {
  useApp.getState().setUser({ name: u.nome, email: u.email })
  void sincronizarProgresso()
}

/* Desloga no servidor e no aparelho. O progresso (results, watched) fica
   no aparelho, como antes (decisão da fase B). Falha de rede não impede
   sair daqui. */
export async function sairDaConta(): Promise<void> {
  useApp.getState().setUser(null)
  try {
    await api.conta.sair()
  } catch {
    /* o cookie vence sozinho; aqui já saiu */
  }
}

/* No boot: confere se o cookie ainda vale. Não bloqueia a tela — ela abre
   com o usuário salvo e se corrige quando a resposta chega. Visitante não
   tem conta, então não pergunta. Sem resposta (Render acordando, sem
   internet) não desloga ninguém. */
export async function verificarSessao(): Promise<void> {
  const salvo = useApp.getState().user
  if (salvo?.guest) return
  // Se a pessoa entrou, saiu ou confirmou o e-mail enquanto a resposta vinha,
  // a resposta já está velha: não mexe.
  const mudou = () => useApp.getState().user !== salvo
  try {
    const u = await api.conta.eu()
    if (!mudou()) entrarNaConta(u)
  } catch (e) {
    // 401 = cookie vencido ou nunca existiu.
    if (e instanceof ErroApi && e.status === 401) {
      if (salvo && !mudou()) useApp.getState().setUser(null)
    } else {
      console.warn('[conta] verificarSessao falhou:', e)
    }
  }
}

let opcoesEmVoo: Promise<void> | null = null

/* "Criar conta" e "Esqueci minha senha" somem se o cadastro estiver fechado. */
export function carregarOpcoes(): Promise<void> {
  if (useApp.getState().cadastroAberto !== null) return Promise.resolve()
  opcoesEmVoo ??= api.conta
    .opcoes()
    .then((o) => useApp.getState().setCadastroAberto(o.cadastroAberto))
    .catch((e) => {
      // Sem resposta: continua null e as telas mostram os links.
      console.warn('[conta] opções de cadastro não carregaram:', e)
    })
    .finally(() => {
      opcoesEmVoo = null
    })
  return opcoesEmVoo
}
