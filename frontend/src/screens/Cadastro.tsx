/* Criar conta / entrar com código */
import { useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { BackBtn } from '../components/Nav'
import { Screen } from '../components/Screen'
import { useApp } from '../core/store'
import { toast } from '../core/toast'
import { urls } from '../core/urls'

type Campo = 'contact' | 'code' | 'name'

export default function Cadastro() {
  const [mode, setMode] = useState<'tel' | 'mail'>('tel')
  const [contact, setContact] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [hasGuardian, setHasGuardian] = useState(false)
  const [guardian, setGuardian] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [invalid, setInvalid] = useState<Campo | null>(null)
  const contactRef = useRef<HTMLInputElement>(null)
  const codeRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const guardianRef = useRef<HTMLInputElement>(null)
  const setUser = useApp((s) => s.setUser)
  const navigate = useNavigate()

  const refs: Record<Campo, typeof contactRef> = { contact: contactRef, code: codeRef, name: nameRef }

  const trocarModo = (m: 'tel' | 'mail') => {
    setMode(m)
    setContact('')
    contactRef.current?.focus()
  }

  // Máscara de telefone do front antigo: (00) 00000-0000, máx 11 dígitos.
  const onContactInput = (v: string) => {
    if (mode !== 'tel') return setContact(v)
    const d = v.replace(/\D/g, '').slice(0, 11)
    setContact(
      d.length > 6
        ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
        : d.length > 2
          ? `(${d.slice(0, 2)}) ${d.slice(2)}`
          : d,
    )
  }

  const sendCode = () => {
    if (!contact.trim()) {
      setInvalid('contact')
      contactRef.current?.focus()
      toast(mode === 'tel' ? 'Digite seu telefone primeiro.' : 'Digite seu e-mail primeiro.')
      return
    }
    setInvalid((i) => (i === 'contact' ? null : i))
    toast('Código enviado! Para testar, use 123456.')
    codeRef.current?.focus()
  }

  const fail = (msg: string, campo: Campo) => {
    setErr(msg)
    setInvalid(campo)
    refs[campo].current?.focus()
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    setInvalid(null)
    if (!contact.trim()) return fail('Informe seu telefone ou e-mail.', 'contact')
    if (!/^\d{6}$/.test(code.trim()))
      return fail('O código tem 6 números. Confira a mensagem que você recebeu.', 'code')
    if (!name.trim()) return fail('Diga como quer ser chamado(a).', 'name')
    const n = name.trim()
    setUser({ name: n, login: contact.trim(), guardian: guardian.trim() || null })
    toast(`Conta criada. Bons estudos, ${n.split(' ')[0]}!`)
    navigate(urls.home)
  }

  return (
    <Screen>
      <div className="topbar">
        <BackBtn to={urls.boasVindas} />
      </div>
      <h1 className="title">Entrar ou criar conta</h1>
      <p className="lede">Escolha como prefere continuar. Vamos enviar um código de verificação.</p>
      <div style={{ textAlign: 'center' }}>
        <div className="segmented" role="group" aria-label="Receber código por">
          <button
            type="button"
            aria-pressed={mode === 'tel'}
            onClick={() => trocarModo('tel')}
          >
            Telefone
          </button>
          <button
            type="button"
            aria-pressed={mode === 'mail'}
            onClick={() => trocarModo('mail')}
          >
            E-mail
          </button>
        </div>
      </div>
      <form id="signup" noValidate onSubmit={submit}>
        <label className="field">
          <span id="contact-label">{mode === 'tel' ? 'Número de telefone' : 'E-mail'}</span>
          <input
            className="input"
            id="contact"
            ref={contactRef}
            value={contact}
            onChange={(e) => onContactInput(e.target.value)}
            type={mode === 'tel' ? 'text' : 'email'}
            inputMode={mode === 'tel' ? 'tel' : 'email'}
            autoComplete={mode === 'tel' ? 'tel' : 'email'}
            placeholder={mode === 'tel' ? '(00) 00000-0000' : 'seuemail@exemplo.com'}
            aria-invalid={invalid === 'contact' || undefined}
          />
        </label>
        <button
          type="button"
          className="btn btn--soft btn--sm"
          id="send-code"
          style={{ marginTop: '.75rem' }}
          onClick={sendCode}
        >
          Enviar código de verificação
        </button>
        <label className="field">
          <span>Código recebido por SMS ou e-mail</span>
          <input
            className="input"
            id="code"
            ref={codeRef}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            aria-invalid={invalid === 'code' || undefined}
          />
        </label>
        <label className="field">
          <span>Como você quer ser chamado(a)?</span>
          <input
            className="input"
            id="name"
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="given-name"
            placeholder="Seu nome"
            aria-invalid={invalid === 'name' || undefined}
          />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            id="has-guardian"
            checked={hasGuardian}
            onChange={(e) => {
              setHasGuardian(e.target.checked)
              if (e.target.checked) guardianRef.current?.focus()
            }}
          />
          <span>
            <strong>Cadastrar uma pessoa responsável (opcional)</strong>
            <span className="small">
              A pessoa responsável receberá um código e informações sobre o acesso.
            </span>
          </span>
        </label>
        <label className="field" id="guardian-field" hidden={!hasGuardian}>
          <span>E-mail ou telefone da pessoa responsável</span>
          <input
            className="input"
            id="guardian"
            ref={guardianRef}
            value={guardian}
            onChange={(e) => setGuardian(e.target.value)}
            placeholder="E-mail ou telefone"
          />
        </label>
        <p className="error" id="signup-error" hidden={!err}>
          {err ?? ''}
        </p>
        <button className="btn btn--primary" style={{ marginTop: '1.5rem' }}>
          Continuar
        </button>
      </form>
    </Screen>
  )
}
