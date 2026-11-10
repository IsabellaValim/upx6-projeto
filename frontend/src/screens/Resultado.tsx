/* Resultado da lição ou do simulado */
import { useEffect, useRef } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { Screen } from '../components/Screen'
import { Tex } from '../components/Tex'
import { useApp } from '../core/store'
import { LETTERS, pct } from '../core/utils'
import { urls } from '../core/urls'

const C = 2 * Math.PI * 42 // circunferência do donut (r=42)
const minutos = (ms: number) => Math.max(1, Math.round(ms / 60000))

export default function Resultado() {
  const { idx = '0' } = useParams()
  const results = useApp((s) => s.results)
  const subjects = useApp((s) => s.subjects)
  const valueRef = useRef<SVGCircleElement>(null)

  const r = results[+idx]
  const s = r && subjects[r.subject]

  // Anima o donut (o stroke-dashoffset sai do círculo cheio para o valor).
  useEffect(() => {
    const v = valueRef.current
    if (v) requestAnimationFrame(() => v.style.setProperty('stroke-dashoffset', v.dataset.offset!))
  }, [idx])

  if (!r || !s) return <Navigate to={urls.progresso} replace />

  const p = pct(r.correct, r.total)
  const sim = r.kind === 'simulado'
  // Lição por tema (v: 3) tem tema. Simulado: o tema com mais erros vira a recomendação.
  const t = r.topic !== undefined ? s.topics[r.topic] : null
  const fraco = sim && r.weakTopic !== null ? s.topics[r.weakTopic!] : null
  const recomendado = t ?? fraco
  const recTi = t ? r.topic! : r.weakTopic!
  const watch = recomendado?.videos ? urls.video(r.subject, recTi, 0) : null

  return (
    <Screen cls="screen--nav" nav="progresso">
      <div className="topbar topbar--split result-head">
        <div>
          <h1>{sim ? 'Resultado do simulado' : 'Resultado da lição'}</h1>
          <p className="kicker">
            {s.name}
            {t ? ' · ' + t.title : ''}
          </p>
        </div>
        <Link className="icon-btn" to={urls.home} aria-label="Fechar resultado">
          <Icon name="xBox" />
        </Link>
      </div>
      <div className="donut" role="img" aria-label={`${p}% de aproveitamento`}>
        <svg viewBox="0 0 100 100">
          <circle className="track" cx="50" cy="50" r="42" />
          <circle
            className="value"
            cx="50"
            cy="50"
            r="42"
            ref={valueRef}
            strokeDasharray={C}
            strokeDashoffset={C}
            data-offset={C * (1 - p / 100)}
          />
        </svg>
        <div className="donut-label">
          <strong>{p}%</strong>
          <span>de aproveitamento</span>
        </div>
      </div>
      <div className="stats">
        <div className="stat stat--ok">
          <strong>{r.correct}</strong>
          <span>Acertos</span>
        </div>
        <div className="stat stat--bad">
          <strong>{r.total - r.correct}</strong>
          <span>Erros</span>
        </div>
        <div className="stat">
          <strong>{r.total}</strong>
          <span>Questões</span>
        </div>
      </div>
      {sim && (
        <p className="small center" style={{ marginTop: '.75rem' }}>
          <Icon name="clock" /> Tempo usado: {minutos(r.usedMs!)} de {minutos(r.limitMs!)} minutos
          {r.treino ? ' · simulado de treino com questões autorais' : ''}
        </p>
      )}
      <div className="tip">
        {r.correct === r.total ? (
          <>
            <p>Você acertou todas as questões. Excelente trabalho!</p>
            <p>
              {sim
                ? 'Continue praticando para manter o ritmo até a prova.'
                : 'Escolha outro tema para continuar praticando.'}
            </p>
          </>
        ) : sim && fraco ? (
          <>
            <p>O tema com mais erros foi “{fraco.title}”.</p>
            <p>Rever a aula dele pode ajudar no próximo simulado.</p>
          </>
        ) : (
          <>
            <p>Que tal rever a aula deste tema antes de praticar de novo?</p>
            <p>Na próxima lição as questões vêm em outra ordem.</p>
          </>
        )}
        {watch && r.correct < r.total && (
          <Link className="btn btn--primary btn--sm" to={watch}>
            <Icon name="video" />
            {sim ? `Assistir a aula de ${recomendado!.title}` : 'Assistir a aula deste tema'}
          </Link>
        )}
      </div>
      <details className="review">
        <summary>Ver correção das questões</summary>
        {r.items.map((x, k) => (
          // A correção (resposta certa e explicação) veio da API e foi guardada no resultado.
          <div className={`review-item ${x.ok ? 'ok' : 'bad'}`} key={k}>
            <p>
              <span className="mark">{x.ok ? 'Acertou' : 'Errou'}</span> — {k + 1}.{' '}
              <Tex>{x.ask}</Tex>
            </p>
            <p>
              Resposta certa: {LETTERS[x.answer]}) <Tex>{x.options[x.answer]}</Tex>
              {!x.ok && x.chosen !== undefined ? ` · Você marcou ${LETTERS[x.chosen]}` : ''}
            </p>
            <p>
              <Tex>{x.why}</Tex>
            </p>
          </div>
        ))}
      </details>
      {sim ? (
        <>
          <Link
            className="btn btn--outline"
            style={{ marginTop: '1rem' }}
            to={urls.simulado(r.subject)}
          >
            Fazer outro simulado
          </Link>
          <Link
            className="btn btn--outline"
            style={{ marginTop: '.75rem' }}
            to={urls.area(r.subject)}
          >
            Estudar os temas
          </Link>
        </>
      ) : (
        <>
          {t && (
            <Link
              className="btn btn--outline"
              style={{ marginTop: '1rem' }}
              to={urls.quiz(r.subject, r.topic!)}
            >
              Praticar de novo
            </Link>
          )}
          <Link
            className="btn btn--outline"
            style={{ marginTop: '.75rem' }}
            to={urls.area(r.subject)}
          >
            Escolher outro tema
          </Link>
        </>
      )}
      <p className="small center" style={{ marginTop: '1rem' }}>
        Resumo do desempenho salvo no seu perfil.
      </p>
    </Screen>
  )
}
