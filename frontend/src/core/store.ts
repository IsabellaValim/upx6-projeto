/* ==========================================================
   Estado global (zustand) + persistência.

   Mesmas chaves do front antigo: estudae:user, estudae:nivel,
   estudae:a11y, estudae:results, estudae:watched. Quem já usou o
   site não perde nada. Cada ação espelha um save.* do state.js:
   grava no localStorage na hora, sem middleware.
   ========================================================== */
import { create } from 'zustand'
import type {
  A11y,
  CatalogSubject,
  Nivel,
  QuizSession,
  Resultado,
  SimuladoSession,
  User,
} from '../types'

const PREFIX = 'estudae:'

export const local = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(PREFIX + key)
      return raw === null ? fallback : (JSON.parse(raw) as T)
    } catch {
      return fallback
    }
  },
  set(key: string, value: unknown): void {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value))
    } catch {
      /* sem armazenamento */
    }
  },
  remove(key: string): void {
    try {
      localStorage.removeItem(PREFIX + key)
    } catch {
      /* sem armazenamento */
    }
  },
}

const a11yInicial = (): A11y => ({
  font: 'grande', // padrão para quem ainda não escolheu (público idoso)
  contrast: false,
  speak: false,
  motion: false,
  subs: false,
  slow: false,
  ...local.get<Partial<A11y>>('a11y', {}),
})

export type CatalogoStatus = 'loading' | 'ready' | 'error'

interface AppState {
  user: User | null
  nivel: Nivel | null
  a11y: A11y
  results: Resultado[]
  watched: Record<string, number>
  quiz: QuizSession | null
  simulado: SimuladoSession | null
  subjects: Record<string, CatalogSubject>
  catalogoStatus: CatalogoStatus

  setUser: (user: User | null) => void
  setNivel: (nivel: Nivel) => void
  setA11y: (patch: Partial<A11y>) => void
  pushResult: (r: Resultado) => void
  setWatched: (key: string) => void
  clearWatched: (key: string) => void
  setQuiz: (q: QuizSession | null) => void
  setSimulado: (s: SimuladoSession | null) => void
  limparProgresso: () => void
  setSubjects: (subjects: Record<string, CatalogSubject>) => void
  setCatalogoStatus: (s: CatalogoStatus) => void
}

export const useApp = create<AppState>()((set, get) => ({
  user: local.get<User | null>('user', null),
  nivel: local.get<Nivel | null>('nivel', null),
  a11y: a11yInicial(),
  // Entradas sem v >= 2 apontavam para o conteúdo de exemplo (que saiu):
  // não dá para exibi-las (ver state.js do front antigo).
  results: local.get<Resultado[]>('results', []).filter((r) => r.v >= 2),
  watched: local.get<Record<string, number>>('watched', {}),
  quiz: null,
  simulado: null,
  subjects: {},
  catalogoStatus: 'loading',

  setUser: (user) => {
    set({ user })
    if (user) local.set('user', user)
    else local.remove('user')
  },
  setNivel: (nivel) => {
    set({ nivel })
    local.set('nivel', nivel)
  },
  setA11y: (patch) => {
    const a11y = { ...get().a11y, ...patch }
    set({ a11y })
    local.set('a11y', a11y)
  },
  pushResult: (r) => {
    const results = [...get().results, r]
    set({ results })
    local.set('results', results)
  },
  setWatched: (key) => {
    const watched = { ...get().watched, [key]: Date.now() }
    set({ watched })
    local.set('watched', watched)
  },
  clearWatched: (key) => {
    const watched = { ...get().watched }
    delete watched[key]
    set({ watched })
    local.set('watched', watched)
  },
  setQuiz: (quiz) => set({ quiz }),
  setSimulado: (simulado) => set({ simulado }),
  limparProgresso: () => {
    set({ results: [], watched: {}, quiz: null, simulado: null })
    local.remove('results')
    local.remove('watched')
  },
  setSubjects: (subjects) => set({ subjects }),
  setCatalogoStatus: (catalogoStatus) => set({ catalogoStatus }),
}))

/* applyA11y do state.js antigo: reflete as preferências no <html>.
   Chamado pelo App no mount e a cada mudança da slice a11y. */
export function applyA11y(a11y: A11y): void {
  const el = document.documentElement
  el.dataset.font = a11y.font
  el.dataset.contrast = a11y.contrast ? 'alto' : ''
  el.dataset.motion = a11y.motion ? 'reduce' : ''
  el.dataset.subs = a11y.subs ? 'grande' : ''
}
