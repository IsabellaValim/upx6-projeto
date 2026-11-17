/* Campo de senha com "Mostrar senha" (Login, Cadastro, Redefinir senha). */
import { useState, type Ref } from 'react'
import { Icon } from './Icon'

interface Props {
  id: string
  rotulo: string
  valor: string
  aoMudar: (v: string) => void
  autoComplete: 'current-password' | 'new-password'
  invalido?: boolean
  dica?: string
  ref?: Ref<HTMLInputElement>
}

export function CampoSenha({
  id,
  rotulo,
  valor,
  aoMudar,
  autoComplete,
  invalido,
  dica,
  ref,
}: Props) {
  const [mostrar, setMostrar] = useState(false)
  const idDica = dica ? `${id}-dica` : undefined
  // A dica fica fora do <label>: dentro, ela entraria no nome do campo
  // lido pelo leitor de tela. Ela chega pelo aria-describedby.
  return (
    <>
      <label className="field">
        <span>{rotulo}</span>
        <div className="input-wrap">
          <Icon name="lock" />
          <input
            className="input"
            id={id}
            ref={ref}
            type={mostrar ? 'text' : 'password'}
            value={valor}
            onChange={(e) => aoMudar(e.target.value)}
            autoComplete={autoComplete}
            maxLength={128}
            aria-invalid={invalido || undefined}
            aria-describedby={idDica}
          />
          <button
            type="button"
            className="icon-btn"
            aria-label={mostrar ? 'Esconder senha' : 'Mostrar senha'}
            aria-pressed={mostrar}
            onClick={() => setMostrar((v) => !v)}
          >
            <Icon name={mostrar ? 'eyeOff' : 'eye'} />
          </button>
        </div>
      </label>
      {dica && (
        <small
          className="small"
          id={idDica}
          style={{ display: 'block', marginTop: '0.375rem' }}
        >
          {dica}
        </small>
      )}
    </>
  )
}
