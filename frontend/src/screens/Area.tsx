/* Área: progresso da matéria e os temas, um aberto por vez */
import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { BackBtn } from '../components/Nav'
import { Bar, ContinueBtn } from '../components/Progress'
import { Screen } from '../components/Screen'
import { useApp } from '../core/store'
import { nextActivity, subjectProgress, topicProgress } from '../core/stats'
import { urls } from '../core/urls'

// Uma frase basta na lista (o texto completo fica na tela da aula).
const primeiraFrase = (texto: string | null) =>
  ((texto ?? '').match(/^.*?[.!?](\s|$)/)?.[0] ?? texto ?? '').trim()

export default function Area() {
  const { id = '' } = useParams()
  const subjects = useApp((s) => s.subjects)
  const s = subjects[id]
  const next = s ? nextActivity(id) : null
  const [openIdx, setOpenIdx] = useState(next?.ti ?? -1)

  if (!s) return <Navigate to={urls.home} replace />
  const geral = subjectProgress(id)
  const comecou = geral.done > 0

  return (
    <Screen cls="screen--nav" nav="inicio">
      <div className="topbar">
        <BackBtn to={urls.home} />
      </div>
      <h1 className="title">{s.name}</h1>
      <p className="lede">
        {!next
          ? 'Você concluiu todas as atividades. Pratique de novo quando quiser.'
          : comecou
            ? 'Continue de onde você parou.'
            : 'Comece pelo primeiro tema.'}
      </p>
      {next && (
        <ContinueBtn
          to={next.href}
          kind={next.kind}
          titulo={comecou ? 'Continuar estudando' : 'Começar a estudar'}
          sub={`${next.titulo} · ${next.kind === 'aula' ? 'ver a aula' : 'praticar'}`}
        />
      )}
      <section className="card progress-card" aria-labelledby="progresso-materia">
        <h2 id="progresso-materia">Seu progresso</h2>
        <p>
          <strong>{geral.done}</strong> de {geral.total} atividades
        </p>
        <Bar done={geral.done} total={geral.total} rotulo={`Progresso em ${s.name}`} />
      </section>
      <h2 className="section-label">Temas</h2>
      <div className="topic-list">
        {s.topics.length === 0 && (
          <div className="empty">
            <p>Ainda não há temas nesta matéria.</p>
          </div>
        )}
        {s.topics.map((t, i) => {
          const p = topicProgress(id, i)
          const status = p.completo ? (
            <>
              <Icon name="check" />
              Tema concluído
            </>
          ) : (
            `${p.done} de ${p.total} atividades concluídas`
          )
          const acoes =
            t.totalQuestoes || t.videos ? (
              <>
                {t.totalQuestoes > 0 && (
                  <Link className="btn btn--primary" to={urls.quiz(id, i)}>
                    <Icon name="checkSquare" />
                    Praticar
                  </Link>
                )}
                {t.videos > 0 && (
                  <Link className="btn btn--outline" to={urls.video(id, i, 0)}>
                    <Icon name="playCircle" />
                    Ver aula
                  </Link>
                )}
              </>
            ) : (
              <p>Conteúdo em preparação.</p>
            )
          return (
            <details
              key={t.slug}
              className={`topic-item ${p.completo ? 'is-done' : ''}`}
              name="temas"
              open={openIdx === i}
              // Um tema aberto por vez (o atributo name já faz isso nos
              // navegadores novos; o estado cobre os antigos).
              onToggle={(e) => {
                const d = e.currentTarget
                if (d.open) setOpenIdx(i)
                else if (openIdx === i) setOpenIdx(-1)
              }}
            >
              <summary>
                <span className="topic-item__num" aria-hidden="true">
                  {p.completo ? <Icon name="check" /> : i + 1}
                </span>
                <span className="topic-item__text">
                  <strong>{t.title}</strong>
                  <small>{status}</small>
                </span>
                <Icon name="chevronDown" cls="chev" />
              </summary>
              <div className="topic-item__body">
                <p>{primeiraFrase(t.about)}</p>
                <div className="topic-item__actions">{acoes}</div>
              </div>
            </details>
          )
        })}
      </div>
    </Screen>
  )
}
