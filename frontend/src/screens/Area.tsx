/* Área: evolução da matéria e os temas, um aberto por vez */
import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { BackBtn } from '../components/Nav'
import { Bar, ContinueBtn } from '../components/Progress'
import { ComparacaoTema } from '../components/Evolucao'
import { Screen } from '../components/Screen'
import {
  ESTADO_TEXTO,
  MOTIVO_TEXTO,
  avaliarArea,
} from '../core/capturaAprendizagem'
import type { AvaliacaoEstudo } from '../core/capturaAprendizagem'
import { destaqueEvolucao, tituloEvolucao } from '../core/aprendizagem/evolucao'
import { useApp } from '../core/store'
import { nextActivity, subjectProgress, topicProgress } from '../core/stats'
import { urls } from '../core/urls'

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
  const destaque = destaqueEvolucao(avaliacao?.evolucoes ?? [])

  return (
    <Screen cls="screen--nav" nav="inicio">
      <div className="topbar">
        <BackBtn to={urls.home} />
      </div>
      <h1 className="title">{s.name}</h1>
      {/* Primeiro a % de aprendizado (evidência do motor, não contagem);
          depois a sugestão em destaque; o "continuar" fica mais abaixo. */}
      {avaliacao?.aprendizado != null && (
        <section
          className="card progress-card"
          aria-label={`Seu aprendizado em ${s.name}`}
        >
          <h2 className="card-title">Seu aprendizado</h2>
          <p>
            <strong>{avaliacao.aprendizado}%</strong> em {s.name}
          </p>
          <Bar
            done={avaliacao.aprendizado}
            total={100}
            rotulo={`Aprendizado em ${s.name}: ${avaliacao.aprendizado}%`}
          />
        </section>
      )}
      {/* Uma ação principal por vez: com sugestão do motor ela é o próximo
          passo; sem sugestão, o "continuar" do catálogo assume. Dois botões
          com temas diferentes confundem — aqui nunca aparecem juntos. */}
      {avaliacao?.recomendacao ? (
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
        })()
      ) : next ? (
        <ContinueBtn
          to={next.href}
          kind={next.kind}
          titulo={comecou ? 'Continuar estudando' : 'Começar a estudar'}
          sub={`${next.titulo} · ${next.kind === 'aula' ? 'ver a aula' : 'praticar'}`}
        />
      ) : null}
      {/* "Seu progresso" virou "Sua evolução": em vez de contar atividades
          fechadas, mostra o antes/depois do tema com mais evidência —
          o mesmo recorte da tela Meu aprendizado, só desta matéria. */}
      {destaque && (destaque.referencia ?? destaque.ultima) && (
        <section className="card" aria-label={`Sua evolução em ${s.name}`}>
          <h2 className="card-title">{tituloEvolucao(subjects, destaque)}</h2>
          <ComparacaoTema e={destaque} />
        </section>
      )}
      <h2 className="section-label">Temas</h2>
      <div className="topic-list">
        {s.topics.length === 0 && (
          <div className="empty">
            <p>Ainda não há temas nesta matéria.</p>
          </div>
        )}
        {s.topics.map((t, i) => {
          const p = topicProgress(id, i)
          const ev = avaliacao?.evolucoes.find((e) => e.tema === t.slug)
          // Estágio adaptativo do tema (só aparece onde a curadoria validou).
          // 'dominio-confirmado' = aprendido de verdade: verificação boa em
          // questões novas depois de já estar indo bem — vira "Concluído".
          const dominio = avaliacao?.dominios[t.slug]
          const aprendido = dominio?.estado === 'dominio-confirmado'
          const estagio = dominio ? ESTADO_TEXTO[dominio.estado] : null
          const status = aprendido ? (
            <>
              <Icon name="check" />
              Concluído
            </>
          ) : p.completo ? (
            <>
              <Icon name="check" />
              Atividades feitas
            </>
          ) : ev?.ultima ? (
            `Última: ${ev.ultima.acertos} de ${ev.ultima.total} certas`
          ) : (
            'Ainda não estudada'
          )
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
              className={`topic-item ${p.completo || aprendido ? 'is-done' : ''}`}
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
                  {p.completo || aprendido ? <Icon name="check" /> : i + 1}
                </span>
                <span className="topic-item__text">
                  <strong>{t.title}</strong>
                  <small>{status}</small>
                  {estagio && <small className="estagio">{estagio}</small>}
                </span>
                <Icon name="chevronDown" cls="chev" />
              </summary>
              <div className="topic-item__body">
                <div className="topic-item__actions">{acoes}</div>
              </div>
            </details>
          )
        })}
      </div>
    </Screen>
  )
}
