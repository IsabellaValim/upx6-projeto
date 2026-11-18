/* ---------- Pedaços de interface: navegação (port do nav.js) ---------- */
import { Link } from 'react-router-dom'
import { urls } from '../core/urls'
import { Icon } from './Icon'

export function BackBtn({
  to,
  label = 'Voltar',
}: {
  to: string
  label?: string
}) {
  return (
    <Link className="icon-btn" to={to} aria-label={label}>
      <Icon name="back" />
    </Link>
  )
}

// Três visões: estudar, ver a própria evolução e os ajustes. As telas
// "Progresso" e "Aprendizado" viraram uma só (Meu aprendizado).
const ITEMS = [
  ['inicio', urls.home, 'home', 'Início'],
  ['aprendizado', urls.aprendizado, 'trend', 'Aprendizado'],
  ['perfil', urls.perfil, 'user', 'Perfil'],
] as const

export function BottomNav({ active }: { active: (typeof ITEMS)[number][0] }) {
  return (
    <nav className="bottom-nav" aria-label="Navegação principal">
      {ITEMS.map(([id, to, ic, label]) => (
        <Link
          key={id}
          to={to}
          aria-current={id === active ? 'page' : undefined}
        >
          <Icon name={ic} />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  )
}
