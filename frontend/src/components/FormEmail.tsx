/* Formulário de um campo só (e-mail) que pede algo à API e mostra a
   resposta neutra dela: reenviar confirmação, esqueci a senha. */
import { useRef, useState, type FormEvent } from 'react'
import { Icon } from './Icon'
import { mensagemDe } from '../core/api'

interface Props {
  id: string
  botao: string
  // Devolve a mensagem da API (sempre neutra: não diz se o e-mail tem conta).
  enviar: (email: string) => Promise<{ mensagem: string }>
  emailInicial?: string
}

export function FormEmail({ id, botao, enviar, emailInicial = '' }: Props) {
  const [email, setEmail] = useState(emailInicial)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (enviando) return
    setErr(null)
    setOk(null)
    if (!email.trim()) {
      setErr('Digite seu e-mail.')
      ref.current?.focus()
      return
    }
    setEnviando(true)
    try {
      setOk((await enviar(email.trim())).mensagem)
    } catch (ex) {
      setErr(mensagemDe(ex))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form id={id} noValidate onSubmit={submit}>
      <label className="field">
        <span>E-mail</span>
        <div className="input-wrap">
          <Icon name="mail" />
          <input
            className="input"
            id={`${id}-email`}
            ref={ref}
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="seuemail@exemplo.com"
            aria-invalid={!!err || undefined}
          />
        </div>
      </label>
      <p className="error" role="alert" hidden={!err}>
        {err ?? ''}
      </p>
      {ok && (
        <div className="tip" role="status">
          <p>{ok}</p>
          <p>
            Não chegou? Confira a pasta de spam ou espere alguns minutos e peça
            de novo.
          </p>
        </div>
      )}
      <button
        className="btn btn--primary"
        style={{ marginTop: '1.5rem' }}
        disabled={enviando}
      >
        {enviando ? 'Enviando…' : botao}
      </button>
    </form>
  )
}
