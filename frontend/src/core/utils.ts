/* Utilidades puras (sem acesso a estado ou DOM) */
export const LETTERS = ['A', 'B', 'C', 'D', 'E'] // a API manda de 2 a 5 alternativas

// esc() do front antigo não existe aqui: o JSX já escapa o texto.
// go() foi substituído pelo roteador (react-router-dom).

export const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)

export function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase() || 'E'
  )
}

export function formatDay(ts: number): string {
  const d = new Date(ts)
  const today = new Date()
  const diff = Math.round(
    (new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000,
  )
  if (diff === 0) return 'Hoje'
  if (diff === 1) return 'Ontem'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
