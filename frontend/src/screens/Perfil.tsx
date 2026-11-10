/* Perfil: quem você é, os ajustes do app e a conta.
   Progresso e histórico ficam só na aba Progresso — não se repetem aqui. */
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { Screen } from '../components/Screen'
import { AjusteRow } from '../components/Switch'
import { NIVEIS } from '../core/catalogo'
import { useApp } from '../core/store'
import { streakDays } from '../core/stats'
import { initials } from '../core/utils'
import { urls } from '../core/urls'

export default function Perfil() {
  const user = useApp((s) => s.user)!
  const nivel = useApp((s) => s.nivel)
  const setUser = useApp((s) => s.setUser)
  const navigate = useNavigate()
  // Assina results para a ofensiva atualizar na hora.
  useApp((s) => s.results)

  const streak = streakDays()
  const sair = () => {
    setUser(null)
    navigate(urls.boasVindas)
  }

  return (
    <Screen cls="screen--nav" nav="perfil">
      <div className="topbar topbar--split">
        <Link className="icon-btn icon-btn--solid" to={urls.home} aria-label="Voltar ao início">
          <Icon name="arrowLeft" />
        </Link>
        <h1>Meu perfil</h1>
        <span style={{ width: '2.25rem' }} />
      </div>
      <div className="card profile-head">
        <span className="avatar" aria-hidden="true">
          {initials(user.name)}
        </span>
        <div>
          <strong>{user.name}</strong>
          <small className="profile-note">
            {user.guest
              ? 'Estudando sem conta — o progresso fica salvo neste aparelho.'
              : (user.login ?? '')}
          </small>
          <span className="streak">
            <Icon name="flame" />
            {streak
              ? `${streak} ${streak === 1 ? 'dia' : 'dias'} de ofensiva`
              : 'Estude hoje para começar uma ofensiva'}
          </span>
        </div>
      </div>
      {user.guest && (
        <button className="btn btn--primary" id="sair" style={{ marginTop: '1rem' }} onClick={sair}>
          <Icon name="user" />
          Entrar ou criar conta
        </button>
      )}
      <h2 className="section-label">Ajustes</h2>
      <div className="card card--flush">
        <AjusteRow
          to={urls.nivel}
          ic="book"
          titulo="Prova do Encceja"
          desc={(nivel && NIVEIS[nivel]?.nome) ?? 'Ainda não escolhida'}
        />
        <AjusteRow
          to={urls.acessibilidade}
          ic="access"
          titulo="Acessibilidade"
          desc="Tamanho do texto, contraste e leitura em voz alta"
        />
      </div>
      {!user.guest && (
        <button className="btn btn--outline" id="sair" style={{ marginTop: '1.5rem' }} onClick={sair}>
          <Icon name="logout" />
          Sair da conta
        </button>
      )}
    </Screen>
  )
}
