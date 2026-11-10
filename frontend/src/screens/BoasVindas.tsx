/* Boas-vindas (Main-activity) */
import { Link, useNavigate } from 'react-router-dom'
import { Screen } from '../components/Screen'
import { useApp } from '../core/store'
import { urls } from '../core/urls'

export default function BoasVindas() {
  const setUser = useApp((s) => s.setUser)
  const navigate = useNavigate()
  return (
    <Screen>
      <div className="welcome-hero">
        <h1 className="brand-logo brand-logo--hero">
          <img src="/branding/logo-primary.svg" alt="Estudaê" />
        </h1>
        <p className="display">Estudar para o Encceja, no seu ritmo.</p>
        <p>Questões e vídeo-aulas com telas simples e textos grandes, pensadas para você.</p>
      </div>
      <div className="stack">
        <Link className="btn btn--primary" to={urls.cadastro}>
          Criar conta
        </Link>
        <Link className="btn btn--soft" to={urls.login}>
          Já tenho conta
        </Link>
        <button
          className="btn btn--light"
          id="guest"
          style={{ width: '100%' }}
          onClick={() => {
            setUser({ name: 'Visitante', guest: true })
            navigate(urls.home)
          }}
        >
          Continuar sem conta
        </button>
      </div>
    </Screen>
  )
}
