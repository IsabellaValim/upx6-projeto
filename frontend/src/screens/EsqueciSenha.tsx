/* Esqueci a senha: manda o link de redefinição por e-mail. */
import { BackBtn } from '../components/Nav'
import { FormEmail } from '../components/FormEmail'
import { Screen } from '../components/Screen'
import { api } from '../core/api'
import { urls } from '../core/urls'

export default function EsqueciSenha() {
  return (
    <Screen>
      <div className="topbar">
        <BackBtn to={urls.login} />
      </div>
      <h1 className="title">Esqueci minha senha</h1>
      <p className="lede">
        Digite o e-mail da sua conta. Vamos mandar um link para você criar uma
        senha nova.
      </p>
      <FormEmail
        id="esqueci"
        botao="Mandar o link"
        enviar={api.conta.esqueciSenha}
      />
    </Screen>
  )
}
