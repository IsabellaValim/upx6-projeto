/* Link do e-mail de confirmação: /confirmar-email?u=<id>&t=<token>.
   Confirma, já entra na conta e segue para o app. */
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { FormEmail } from '../components/FormEmail'
import { Screen } from '../components/Screen'
import { api, mensagemDe } from '../core/api'
import { entrarNaConta } from '../core/conta'
import { toast } from '../core/toast'
import { urls } from '../core/urls'

export default function ConfirmarEmail() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const u = params.get('u')
  const t = params.get('t')
  const [erroApi, setErroApi] = useState<string | null>(null)
  const erro =
    u && t ? erroApi : 'Este link está incompleto. Peça um novo e-mail.'
  const pediu = useRef(false) // o StrictMode roda o efeito duas vezes em dev

  useEffect(() => {
    if (pediu.current || !u || !t) return
    pediu.current = true
    api.conta
      .confirmarEmail(u, t)
      .then((usuario) => {
        entrarNaConta(usuario)
        toast(`E-mail confirmado. Bons estudos, ${usuario.nome.split(' ')[0]}!`)
        navigate(urls.home, { replace: true })
      })
      .catch((ex) => setErroApi(mensagemDe(ex)))
  }, [u, t, navigate])

  if (!erro)
    return (
      <Screen cls="screen--center">
        <div className="spinner" aria-hidden="true" />
        <h1 className="title">Confirmando seu e-mail…</h1>
      </Screen>
    )

  return (
    <Screen>
      <h1 className="title">Não deu para confirmar</h1>
      <p className="error" role="alert">
        {erro}
      </p>
      <p className="lede" style={{ marginTop: '1rem' }}>
        Digite seu e-mail para mandarmos um link novo.
      </p>
      <FormEmail
        id="reenviar"
        botao="Mandar um link novo"
        enviar={api.conta.reenviar}
      />
      <Link
        className="btn btn--light"
        style={{ marginTop: '1rem' }}
        to={urls.login}
      >
        Ir para o login
      </Link>
    </Screen>
  )
}
