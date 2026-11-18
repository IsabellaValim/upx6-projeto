/* Criar conta: nome, e-mail e senha (POST /api/conta/cadastro).
   Depois a pessoa confirma pelo link do e-mail (tela VerifiqueEmail). */
import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BackBtn } from '../components/Nav'
import { CampoSenha } from '../components/CampoSenha'
import { Icon } from '../components/Icon'
import { Screen } from '../components/Screen'
import { api, mensagemDe } from '../core/api'
import { SENHA_MINIMA } from '../core/conta'
import { useApp } from '../core/store'
import { urls } from '../core/urls'

type Campo = 'nome' | 'email' | 'senha'

export default function Cadastro() {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [invalid, setInvalid] = useState<Campo | null>(null)
  const [enviando, setEnviando] = useState(false)
  const nomeRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const senhaRef = useRef<HTMLInputElement>(null)
  const cadastroAberto = useApp((s) => s.cadastroAberto)
  const setUser = useApp((s) => s.setUser)
  const navigate = useNavigate()

  const falhar = (msg: string, campo: Campo | null) => {
    setErr(msg)
    setInvalid(campo)
    const refs = { nome: nomeRef, email: emailRef, senha: senhaRef }
    if (campo) refs[campo].current?.focus()
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (enviando) return
    setErr(null)
    setInvalid(null)
    if (!nome.trim()) return falhar('Diga como quer ser chamado(a).', 'nome')
    if (!email.trim()) return falhar('Digite seu e-mail.', 'email')
    if (senha.length < SENHA_MINIMA)
      return falhar(
        `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`,
        'senha',
      )
    setEnviando(true)
    try {
      await api.conta.cadastro(nome.trim(), email.trim(), senha)
      navigate(urls.verifiqueEmail, { state: { email: email.trim() } })
    } catch (ex) {
      falhar(mensagemDe(ex), null)
    } finally {
      setEnviando(false)
    }
  }

  if (cadastroAberto === false)
    return (
      <Screen>
        <div className="topbar">
          <BackBtn to={urls.boasVindas} />
        </div>
        <h1 className="title">Criar conta</h1>
        <p className="lede">
          O cadastro de contas ainda não está disponível. Você pode estudar sem
          conta: o progresso fica salvo neste aparelho.
        </p>
        <button
          className="btn btn--primary"
          style={{ marginTop: '1.5rem' }}
          onClick={() => {
            setUser({ name: 'Visitante', guest: true })
            navigate(urls.home)
          }}
        >
          Continuar sem conta
        </button>
      </Screen>
    )

  return (
    <Screen>
      <div className="topbar">
        <BackBtn to={urls.boasVindas} />
      </div>
      <h1 className="title">Criar conta</h1>
      <p className="lede">Depois vamos mandar um e-mail para você confirmar.</p>
      <form id="signup" noValidate onSubmit={submit}>
        <label className="field">
          <span>Como você quer ser chamado(a)?</span>
          <div className="input-wrap">
            <Icon name="user" />
            <input
              className="input"
              id="cadastro-nome"
              ref={nomeRef}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              autoComplete="name"
              maxLength={150}
              placeholder="Seu nome"
              aria-invalid={invalid === 'nome' || undefined}
            />
          </div>
        </label>
        <label className="field">
          <span>E-mail</span>
          <div className="input-wrap">
            <Icon name="mail" />
            <input
              className="input"
              id="cadastro-email"
              ref={emailRef}
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="seuemail@exemplo.com"
              aria-invalid={invalid === 'email' || undefined}
            />
          </div>
        </label>
        <CampoSenha
          id="cadastro-senha"
          rotulo="Crie uma senha"
          valor={senha}
          aoMudar={setSenha}
          autoComplete="new-password"
          invalido={invalid === 'senha'}
          dica={`Pelo menos ${SENHA_MINIMA} caracteres. Pode ser uma frase, como "netos da vovó".`}
          ref={senhaRef}
        />
        <p className="error" id="signup-error" role="alert" hidden={!err}>
          {err ?? ''}
        </p>
        <button
          className="btn btn--primary"
          style={{ marginTop: '1.5rem' }}
          disabled={enviando}
        >
          {enviando ? 'Criando sua conta…' : 'Criar conta'}
        </button>
      </form>
      <p className="small center" style={{ marginTop: '1.25rem' }}>
        Já tem conta?{' '}
        <Link className="link" to={urls.login}>
          Entrar
        </Link>
      </p>
    </Screen>
  )
}
