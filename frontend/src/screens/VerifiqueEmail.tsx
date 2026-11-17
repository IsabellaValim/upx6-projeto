/* Depois do cadastro: "abra o e-mail e toque no botão". */
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BackBtn } from '../components/Nav'
import { FormEmail } from '../components/FormEmail'
import { Icon } from '../components/Icon'
import { Screen } from '../components/Screen'
import { api, mensagemDe } from '../core/api'
import { urls } from '../core/urls'

const ESPERA = 60 // segundos entre um reenvio e outro

export default function VerifiqueEmail() {
  // O e-mail vem do Cadastro (state da navegação). Com F5 ele some: aí a
  // tela pede o endereço para reenviar.
  const email = (useLocation().state as { email?: string } | null)?.email
  const [espera, setEspera] = useState(ESPERA)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    if (espera <= 0) return
    const t = setTimeout(() => setEspera((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [espera])

  const reenviar = async () => {
    if (!email) return
    setAviso(null)
    try {
      await api.conta.reenviar(email)
      setAviso(
        'Enviamos de novo. Confira a caixa de entrada e a pasta de spam.',
      )
      setEspera(ESPERA)
    } catch (ex) {
      setAviso(mensagemDe(ex))
    }
  }

  return (
    <Screen>
      <div className="topbar">
        <BackBtn to={urls.boasVindas} />
      </div>
      <h1 className="title">Falta pouco!</h1>
      {email ? (
        <>
          <p className="lede">
            Mandamos um e-mail para <strong>{email}</strong>. Abra o e-mail e
            toque no botão "Confirmar meu e-mail".
          </p>
          <div className="tip">
            <p>Não achou? Olhe também na pasta de spam ou lixo eletrônico.</p>
          </div>
          <p
            role="status"
            className="small"
            style={{ marginTop: '1rem' }}
            hidden={!aviso}
          >
            {aviso ?? ''}
          </p>
          <button
            className="btn btn--soft"
            style={{ marginTop: '1.25rem' }}
            onClick={reenviar}
            disabled={espera > 0}
          >
            <Icon name="mail" />
            {espera > 0 ? `Enviar de novo (em ${espera} s)` : 'Enviar de novo'}
          </button>
        </>
      ) : (
        <>
          <p className="lede">
            Abra o e-mail que mandamos e toque no botão "Confirmar meu e-mail".
            Se não chegou, digite seu e-mail para mandarmos de novo.
          </p>
          <FormEmail
            id="reenviar"
            botao="Enviar de novo"
            enviar={api.conta.reenviar}
          />
        </>
      )}
      <Link
        className="btn btn--light"
        style={{ marginTop: '1rem' }}
        to={urls.login}
      >
        Já confirmei, quero entrar
      </Link>
    </Screen>
  )
}
