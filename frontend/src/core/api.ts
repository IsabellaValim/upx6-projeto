/* ==========================================================
   API do Estudaê — chamadas HTTP (contrato em docs/api.md).
   Sempre mesma origem: em dev, o proxy do Vite repassa /api e
   /conteudo para a API em :5151 (ver vite.config.ts).
   ========================================================== */
import type {
  DisciplinaApi,
  DisciplinaPedagogiaApi,
  QuestaoApi,
  RespostaApi,
  TemaApi,
} from '../types'

async function pedir<T>(caminho: string, opcoes?: RequestInit): Promise<T> {
  const r = await fetch('/api' + caminho, opcoes)
  if (!r.ok) {
    const erro = new Error(
      'Falha ao falar com a API (' + r.status + ')',
    ) as Error & {
      status?: number
    }
    erro.status = r.status
    throw erro
  }
  return r.json() as Promise<T>
}

const seg = encodeURIComponent

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
  pedagogia: (disciplina: string) =>
    pedir<DisciplinaPedagogiaApi>(`/disciplinas/${seg(disciplina)}/pedagogia`),
  // Envia o TEXTO exato da alternativa, nunca a letra nem a posição.
  resposta: (id: number, alternativa: string) =>
    pedir<RespostaApi>(`/questoes/${seg(String(id))}/resposta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alternativa }),
    }),
}
