/* Login */
import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BackBtn } from '../components/Nav'
import { Icon } from '../components/Icon'
import { Screen } from '../components/Screen'
import { useApp } from '../core/store'
import { toast } from '../core/toast'
import { urls } from '../core/urls'

export default function Login() {
  const [id, setId] = useState('')
  const [pass, setPass] = useState('')
  const [show, setShow] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [invalid, setInvalid] = useState<'id' | 'pass' | null>(null)
  const idRef = useRef<HTMLInputElement>(null)
  const passRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    setInvalid(null)
    if (!id.trim() || pass.length < 4) {
      const campo = !id.trim() ? 'id' : 'pass'
      setErr(
        campo === 'id'
          ? 'Digite seu e-mail ou CPF para entrar.'
          : 'A senha precisa ter pelo menos 4 caracteres.',
      )
      setInvalid(campo)
      ;(campo === 'id' ? idRef : passRef).current?.focus()
      return
    }
    const raw = id.trim()
    const name = raw.includes('@')
      ? raw
          .split('@')[0]
          .replace(/[._-]+/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase())
      : 'Estudante'
    const { user, setUser } = useApp.getState()
    setUser({ name: (user && !user.guest && user.name) || name, login: raw })
    navigate(urls.home)
  }

  return (
    <Screen cls="screen--lilac">
      <div className="topbar">
        <BackBtn to={urls.boasVindas} />
      </div>
      <div style={{ marginTop: '1rem' }}>
        <img className="brand-logo" src="/branding/logo-primary.svg" alt="Estudaê" />
        <h1 className="display" style={{ marginTop: '1.5rem' }}>
          Entrar
        </h1>
        <p className="lede">Acesse sua conta para continuar estudando.</p>
      </div>
      <form id="login-form" noValidate style={{ marginTop: '1rem' }} onSubmit={submit}>
        <label className="field">
          <span>E-mail ou CPF</span>
          <div className="input-wrap">
            <Icon name="mail" />
            <input
              className="input"
              id="login-id"
              ref={idRef}
              value={id}
              onChange={(e) => setId(e.target.value)}
              autoComplete="username"
              placeholder="Digite seu e-mail ou CPF"
              required
              aria-invalid={invalid === 'id' || undefined}
            />
          </div>
        </label>
        <label className="field">
          <span>Senha</span>
          <div className="input-wrap">
            <Icon name="lock" />
            <input
              className="input"
              id="login-pass"
              ref={passRef}
              type={show ? 'text' : 'password'}
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              autoComplete="current-password"
              placeholder="Digite sua senha"
              required
              aria-invalid={invalid === 'pass' || undefined}
            />
            <button
              type="button"
              className="icon-btn"
              id="toggle-pass"
              aria-label={show ? 'Esconder senha' : 'Mostrar senha'}
              onClick={() => setShow((v) => !v)}
            >
              <Icon name={show ? 'eyeOff' : 'eye'} />
            </button>
          </div>
        </label>
        <p className="error" id="login-error" hidden={!err}>
          {err ?? ''}
        </p>
        <div className="row-end">
          <button
            type="button"
            className="link"
            id="forgot"
            onClick={() => toast('Enviamos um link de recuperação para o seu e-mail.')}
          >
            Esqueci minha senha
          </button>
        </div>
        <button className="btn btn--primary" style={{ marginTop: '1.5rem' }}>
          Entrar
        </button>
      </form>
      <div className="divider">ou</div>
      <p className="small center">
        Ainda não tem conta?{' '}
        <Link className="link" to={urls.cadastro}>
          Criar conta
        </Link>
      </p>
    </Screen>
  )
}
