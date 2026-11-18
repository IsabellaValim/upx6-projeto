/* Entrar com e-mail e senha (POST /api/conta/entrar). */
import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BackBtn } from '../components/Nav'
import { CampoSenha } from '../components/CampoSenha'
import { Icon } from '../components/Icon'
import { Screen } from '../components/Screen'
import { api, ErroApi, mensagemDe } from '../core/api'
import { entrarNaConta } from '../core/conta'
import { useApp } from '../core/store'
import { toast } from '../core/toast'
import { urls } from '../core/urls'

export default function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [invalid, setInvalid] = useState<'email' | 'senha' | null>(null)
  const [enviando, setEnviando] = useState(false)
  // Senha certa, e-mail ainda não confirmado: oferece reenviar.
  const [naoConfirmado, setNaoConfirmado] = useState(false)
  const [reenviado, setReenviado] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)
  const senhaRef = useRef<HTMLInputElement>(null)
  const cadastroAberto = useApp((s) => s.cadastroAberto)
  const navigate = useNavigate()

  const falhar = (msg: string, campo: 'email' | 'senha' | null) => {
    setErr(msg)
    setInvalid(campo)
    if (campo) (campo === 'email' ? emailRef : senhaRef).current?.focus()
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (enviando) return
    setErr(null)
    setInvalid(null)
    setNaoConfirmado(false)
    if (!email.trim()) return falhar('Digite seu e-mail para entrar.', 'email')
    if (!senha) return falhar('Digite sua senha.', 'senha')
    setEnviando(true)
    try {
      const u = await api.conta.entrar(email.trim(), senha)
      entrarNaConta(u)
      toast(`Que bom te ver, ${u.nome.split(' ')[0]}!`)
      navigate(urls.home)
    } catch (ex) {
      if (ex instanceof ErroApi && ex.codigo === 'email-nao-confirmado') {
        setNaoConfirmado(true)
        setReenviado(false)
        falhar(ex.message, null)
      } else
        falhar(
          mensagemDe(ex),
          ex instanceof ErroApi && ex.status === 401 ? 'senha' : null,
        )
    } finally {
      setEnviando(false)
    }
  }

  const reenviar = async () => {
    try {
      await api.conta.reenviar(email.trim())
      setReenviado(true)
    } catch (ex) {
      setErr(mensagemDe(ex))
    }
  }

  return (
    <Screen cls="screen--lilac">
      <div className="topbar">
        <BackBtn to={urls.boasVindas} />
      </div>
      <div style={{ marginTop: '1rem' }}>
        <img
          className="brand-logo"
          src="/branding/logo-primary.svg"
          alt="Estudaê"
        />
        <h1 className="display" style={{ marginTop: '1.5rem' }}>
          Entrar
        </h1>
        <p className="lede">Acesse sua conta para continuar estudando.</p>
      </div>
      <form
        id="login-form"
        noValidate
        style={{ marginTop: '1rem' }}
        onSubmit={submit}
      >
        <label className="field">
          <span>E-mail</span>
          <div className="input-wrap">
            <Icon name="mail" />
            <input
              className="input"
              id="login-email"
              ref={emailRef}
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              placeholder="seuemail@exemplo.com"
              aria-invalid={invalid === 'email' || undefined}
            />
          </div>
        </label>
        <CampoSenha
          id="login-senha"
          rotulo="Senha"
          valor={senha}
          aoMudar={setSenha}
          autoComplete="current-password"
          invalido={invalid === 'senha'}
          ref={senhaRef}
        />
        <p className="error" id="login-error" role="alert" hidden={!err}>
          {err ?? ''}
        </p>
        {naoConfirmado && (
          <div className="tip">
            {reenviado ? (
              <p role="status">
                Enviamos de novo. Confira sua caixa de entrada e o spam.
              </p>
            ) : (
              <button
                type="button"
                className="btn btn--soft btn--sm"
                onClick={reenviar}
              >
                <Icon name="mail" />
                Enviar o e-mail de novo
              </button>
            )}
          </div>
        )}
        {cadastroAberto !== false && (
          <div className="row-end">
            <Link className="link" id="forgot" to={urls.esqueciSenha}>
              Esqueci minha senha
            </Link>
          </div>
        )}
        <button
          className="btn btn--primary"
          style={{ marginTop: '1.5rem' }}
          disabled={enviando}
        >
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      {cadastroAberto !== false && (
        <>
          <div className="divider">ou</div>
          <p className="small center">
            Ainda não tem conta?{' '}
            <Link className="link" to={urls.cadastro}>
              Criar conta
            </Link>
          </p>
        </>
      )}
    </Screen>
  )
}
