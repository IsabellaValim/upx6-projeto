/* Área: progresso da matéria e os temas, um aberto por vez */
import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { BackBtn } from '../components/Nav'
import { Bar, ContinueBtn } from '../components/Progress'
import { Screen } from '../components/Screen'
import {
  ESTADO_TEXTO,
  MOTIVO_TEXTO,
  avaliarArea,
} from '../core/capturaAprendizagem'
import type { AvaliacaoEstudo } from '../core/capturaAprendizagem'
import { PARAMETROS_DOMINIO } from '../core/aprendizagem/config'
import { useApp } from '../core/store'
import { nextActivity, subjectProgress, topicProgress } from '../core/stats'
import { urls } from '../core/urls'

// Uma frase basta na lista (o texto completo fica na tela da aula).
const primeiraFrase = (texto: string | null) =>
  ((texto ?? '').match(/^.*?[.!?](\s|$)/)?.[0] ?? texto ?? '').trim()

export default function Area() {
  const { id = '' } = useParams()
  const subjects = useApp((s) => s.subjects)
  const watched = useApp((s) => s.watched)
  const results = useApp((s) => s.results)
  const s = subjects[id]
  const next = s ? nextActivity(id) : null
  const [openIdx, setOpenIdx] = useState(next?.ti ?? -1)
  // Reavalia quando o estudo muda: voltar da lição já mostra o estágio novo.
  // O id guardado evita mostrar a avaliação de outra matéria numa troca de rota.
  const [aval, setAval] = useState<{
    id: string
    a: AvaliacaoEstudo
  } | null>(null)
  useEffect(() => {
    let ativo = true
    void avaliarArea(id).then((a) => {
      if (ativo && a) setAval({ id, a })
    })
    return () => {
      ativo = false
    }
  }, [id, results, watched])
  const avaliacao = aval?.id === id ? aval.a : null

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
          ? 'Você explorou as atividades disponíveis. Pode praticar novamente quando quiser.'
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
      {avaliacao?.recomendacao &&
        (() => {
          const r = avaliacao.recomendacao!
          const ti = s.topics.findIndex((t) => t.slug === r.tema)
          if (ti < 0) return null
          const aulaPendente = s.topics[ti]!.lessons.findIndex(
            (_, j) => !watched[`${id}/${ti}/${j}`],
          )
          const aula = r.motivo === 'nova-habilidade' && aulaPendente >= 0
          return (
            <ContinueBtn
              to={aula ? urls.video(id, ti, aulaPendente) : urls.quiz(id, ti)}
              kind={aula ? 'aula' : 'pratica'}
              titulo="Sugestão"
              sub={`${s.topics[ti]!.title} — ${MOTIVO_TEXTO[r.motivo]}`}
            />
          )
        })()}
      <section
        className="card progress-card"
        aria-labelledby="progresso-materia"
      >
        <h2 id="progresso-materia">Seu progresso</h2>
        <p>
          <strong>{geral.done}</strong> de {geral.total} atividades
        </p>
        <Bar
          done={geral.done}
          total={geral.total}
          rotulo={`Progresso em ${s.name}`}
        />
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
              Atividades realizadas
            </>
          ) : (
            `${p.done} de ${p.total} atividades concluídas`
          )
          // Estágio adaptativo do tema (só aparece onde a curadoria validou).
          const dom = avaliacao?.dominios[t.slug]
          const estagio = dom
            ? dom.estado === 'em-pratica'
              ? `${ESTADO_TEXTO[dom.estado]} · ${dom.janela.length} de ${PARAMETROS_DOMINIO.boaMin} boas práticas`
              : ESTADO_TEXTO[dom.estado]
            : null
          // Conclusão por ação: todas as aulas vistas / todas as questões
          // acertadas ao menos uma vez. O botão vira verde com check e muda o
          // verbo ("Rever aula", "Praticar de novo") — ainda dá para refazer.
          const aulasFeitas = t.videos > 0 && p.aulas >= t.videos
          const praticaFeita =
            t.totalQuestoes > 0 && p.questoes >= t.totalQuestoes
          // "Ver aula" leva à primeira ainda não vista; todas vistas -> 0.
          const proximaAula = Math.max(
            0,
            t.lessons.findIndex((_, j) => !watched[`${id}/${i}/${j}`]),
          )
          const acoes =
            t.totalQuestoes || t.videos ? (
              <>
                {t.totalQuestoes > 0 && (
                  <Link
                    className={`btn ${praticaFeita ? 'btn--outline btn--done' : 'btn--primary'}`}
                    to={urls.quiz(id, i)}
                  >
                    <Icon name={praticaFeita ? 'check' : 'checkSquare'} />
                    {praticaFeita ? 'Praticar de novo' : 'Praticar'}
                  </Link>
                )}
                {t.videos > 0 && (
                  <Link
                    className={`btn btn--outline${aulasFeitas ? ' btn--done' : ''}`}
                    to={urls.video(id, i, proximaAula)}
                  >
                    <Icon name={aulasFeitas ? 'check' : 'playCircle'} />
                    {aulasFeitas ? 'Rever aula' : 'Ver aula'}
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
                  {estagio && <small className="estagio">{estagio}</small>}
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
