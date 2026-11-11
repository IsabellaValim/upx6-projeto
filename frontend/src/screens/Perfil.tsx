/* Perfil: quem você é, os ajustes do app e a conta.
   Progresso e histórico ficam só na aba Progresso — não se repetem aqui. */
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { Screen } from '../components/Screen'
import { AjusteRow } from '../components/Switch'
import { NIVEIS } from '../core/catalogo'
import { resetAprendizagem } from '../core/capturaAprendizagem'
import { useApp } from '../core/store'
import { streakDays } from '../core/stats'
import { toast } from '../core/toast'
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

  const [apagarOpen, setApagarOpen] = useState(false)
  const [apagando, setApagando] = useState(false)
  const apagarNaoRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (apagarOpen) apagarNaoRef.current?.focus()
  }, [apagarOpen])
  const apagar = async () => {
    if (apagando) return
    setApagando(true)
    const ok = await resetAprendizagem()
    setApagando(false)
    setApagarOpen(false)
    toast(
      ok
        ? 'Progresso apagado. Seus ajustes e a prova escolhida continuam.'
        : 'Não foi possível concluir a limpeza. Tente novamente; uma limpeza pendente será retomada ao abrir o aplicativo.',
    )
  }

  return (
    <Screen cls="screen--nav" nav="perfil">
      <div className="topbar topbar--split">
        <Link
          className="icon-btn icon-btn--solid"
          to={urls.home}
          aria-label="Voltar ao início"
        >
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
        <button
          className="btn btn--primary"
          id="sair"
          style={{ marginTop: '1rem' }}
          onClick={sair}
        >
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
      <h2 className="section-label">Progresso</h2>
      <div className="tip" hidden={apagarOpen}>
        <p>
          <strong>Apagar meu progresso</strong>
        </p>
        <p>
          Remove as lições, os simulados, as aulas assistidas e o histórico
          detalhado de aprendizagem das duas provas (Fundamental e Médio) neste
          aparelho.
        </p>
        <button
          className="btn btn--outline btn--sm"
          id="apagar-progresso"
          onClick={() => setApagarOpen(true)}
        >
          Apagar progresso
        </button>
      </div>
      <div className="tip" hidden={!apagarOpen} id="apagar-confirm">
        <p>
          <strong>Apagar todo o progresso?</strong>
        </p>
        <p>
          Isso não tem volta. Seu nome, a prova escolhida e os ajustes de
          acessibilidade são mantidos.
        </p>
        <div className="quiz-nav">
          <button
            className="btn btn--outline"
            id="apagar-nao"
            ref={apagarNaoRef}
            onClick={() => setApagarOpen(false)}
          >
            Manter progresso
          </button>
          <button
            className="btn btn--primary"
            id="apagar-sim"
            disabled={apagando}
            onClick={apagar}
          >
            {apagando ? 'Apagando…' : 'Apagar tudo'}
          </button>
        </div>
      </div>
      {!user.guest && (
        <button
          className="btn btn--outline"
          id="sair"
          style={{ marginTop: '1.5rem' }}
          onClick={sair}
        >
          <Icon name="logout" />
          Sair da conta
        </button>
      )}
    </Screen>
  )
}
