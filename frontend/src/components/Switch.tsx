/* Interruptores de ajuste (role="switch") e links de ajuste do Perfil. */
import { Link } from 'react-router-dom'
import { Icon } from './Icon'

export function SwitchRow({
  ic,
  rotuloId,
  titulo,
  desc,
  checked,
  onToggle,
  comEstado,
}: {
  ic: string
  rotuloId: string
  titulo: string
  desc: string
  checked: boolean
  onToggle: () => void
  comEstado?: boolean // "Ligado/Desligado" escrito (versão da tela de vídeo)
}) {
  return (
    <div className="toggle-row">
      <Icon name={ic} />
      <div>
        <strong id={rotuloId}>{titulo}</strong>
        <small>{desc}</small>
      </div>
      {comEstado && (
        <span className="switch-state" aria-hidden="true">
          {checked ? 'Ligado' : 'Desligado'}
        </span>
      )}
      <button
        type="button"
        className="switch"
        role="switch"
        aria-checked={checked}
        aria-labelledby={rotuloId}
        onClick={onToggle}
      />
    </div>
  )
}

// Linha de ajuste do Perfil (link com chevron).
export function AjusteRow({
  to,
  ic,
  titulo,
  desc,
}: {
  to: string
  ic: string
  titulo: string
  desc: string
}) {
  return (
    <Link className="toggle-row" to={to}>
      <Icon name={ic} />
      <div>
        <strong>{titulo}</strong>
        <small>{desc}</small>
      </div>
      <Icon name="chevronRight" cls="chev" />
    </Link>
  )
}
