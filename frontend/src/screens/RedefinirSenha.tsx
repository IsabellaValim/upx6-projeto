/* Link do e-mail "esqueci a senha": /redefinir-senha?u=<id>&t=<token>.
   Senha nova → já entra na conta. */
import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CampoSenha } from '../components/CampoSenha'
import { Screen } from '../components/Screen'
import { api, ErroApi, mensagemDe } from '../core/api'
import { entrarNaConta, SENHA_MINIMA } from '../core/conta'
import { toast } from '../core/toast'
import { urls } from '../core/urls'

export default function RedefinirSenha() {
  const [params] = useSearchParams()
  const u = params.get('u')
  const t = params.get('t')
  const [senha, setSenha] = useState('')
  const [err, setErr] = useState<string | null>(
    u && t ? null : 'Este link está incompleto. Peça um novo e-mail.',
  )
  const [linkRuim, setLinkRuim] = useState(!(u && t))
  const [enviando, setEnviando] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (enviando || !u || !t) return
    setErr(null)
    if (senha.length < SENHA_MINIMA) {
      setErr(`A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`)
      ref.current?.focus()
      return
    }
    setEnviando(true)
    try {
      const usuario = await api.conta.redefinirSenha(u, t, senha)
      entrarNaConta(usuario)
      toast('Senha nova salva. Bons estudos!')
      navigate(urls.home, { replace: true })
    } catch (ex) {
      setErr(mensagemDe(ex))
      // 400 com senha válida = link vencido ou já usado.
      if (
        ex instanceof ErroApi &&
        ex.status === 400 &&
        /link/i.test(ex.message)
      )
        setLinkRuim(true)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Screen>
      <h1 className="title">Criar uma senha nova</h1>
      <form id="redefinir" noValidate onSubmit={submit}>
        <CampoSenha
          id="nova-senha"
          rotulo="Senha nova"
          valor={senha}
          aoMudar={setSenha}
          autoComplete="new-password"
          invalido={!!err && !linkRuim}
          dica={`Pelo menos ${SENHA_MINIMA} caracteres. Pode ser uma frase.`}
          ref={ref}
        />
        <p className="error" role="alert" hidden={!err}>
          {err ?? ''}
        </p>
        {linkRuim ? (
          <Link
            className="btn btn--primary"
            style={{ marginTop: '1.5rem' }}
            to={urls.esqueciSenha}
          >
            Pedir um link novo
          </Link>
        ) : (
          <button
            className="btn btn--primary"
            style={{ marginTop: '1.5rem' }}
            disabled={enviando}
          >
            {enviando ? 'Salvando…' : 'Salvar senha nova'}
          </button>
        )}
      </form>
    </Screen>
  )
}
