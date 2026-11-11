/* Resultado da lição ou do simulado */
import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { Screen } from '../components/Screen'
import { Tex } from '../components/Tex'
import {
  ESTADO_TEXTO,
  avaliarArea,
  linkDaAcao,
  proximaAcaoNivel,
} from '../core/capturaAprendizagem'
import type { AcaoJornada } from '../core/aprendizagem/jornada'
import { PARAMETROS_DOMINIO } from '../core/aprendizagem/config'
import { topicProgress } from '../core/stats'
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

  const watched = useApp((s) => s.watched)
  const r = results[+idx]
  const s = r && subjects[r.subject]
  const tema =
    r && s && r.topic !== undefined && r.kind !== 'simulado'
      ? s.topics[r.topic]
      : null
  const [estagio, setEstagio] = useState<string | null>(null)
  const nivel = useApp((s) => s.nivel)
  const [acao, setAcao] = useState<AcaoJornada | null>(null)

  // Estágio adaptativo do tema da lição + a próxima ação do orquestrador
  // (ele decide o que vem depois, não o resultado em si).
  useEffect(() => {
    if (!r) return
    let ativo = true
    void proximaAcaoNivel(nivel).then((a) => {
      if (ativo) setAcao(a)
    })
    if (!tema) return
    void avaliarArea(r.subject).then((a) => {
      const d = a?.dominios[tema.slug]
      if (!ativo || !d) return
      setEstagio(
        d.estado === 'em-pratica'
          ? `${ESTADO_TEXTO[d.estado]} · ${d.janela.length} de ${PARAMETROS_DOMINIO.boaMin} boas práticas`
          : ESTADO_TEXTO[d.estado],
      )
    })
    return () => {
      ativo = false
    }
  }, [r, tema, nivel])
  const proxima = linkDaAcao(acao)

  // Anima o donut (o stroke-dashoffset sai do círculo cheio para o valor).
  useEffect(() => {
    const v = valueRef.current
    if (v)
      requestAnimationFrame(() =>
        v.style.setProperty('stroke-dashoffset', v.dataset.offset!),
      )
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

  // Situação das videoaulas do tema recomendado: destaque quando concluídas.
  const aulasTotal = recomendado?.videos ?? 0
  const aulasVistas = recomendado
    ? recomendado.lessons.filter(
        (_, j) => watched[`${r.subject}/${recTi}/${j}`],
      ).length
    : 0
  const aulaVista = aulasTotal > 0 && aulasVistas === aulasTotal
  const perfeito = r.correct === r.total
  // Progresso do tema da lição (aulas vistas + questões acertadas ao menos 1x).
  const progTema = t ? topicProgress(r.subject, r.topic!) : null

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
      {progTema && (
        <p className="small center result-progresso">
          Deste tema, você já concluiu{' '}
          <strong>
            {progTema.done} de {progTema.total}
          </strong>{' '}
          atividades
        </p>
      )}
      {estagio && (
        <p className="small center result-estagio">
          Neste tema você está: <strong>{estagio}</strong>
        </p>
      )}
      {sim && (
        <p className="small center" style={{ marginTop: '.75rem' }}>
          <Icon name="clock" /> Tempo usado: {minutos(r.usedMs!)} de{' '}
          {minutos(r.limitMs!)} minutos
          {r.treino ? ' · simulado de treino com questões autorais' : ''}
        </p>
      )}
      <div className={`tip${perfeito && aulaVista ? ' tip--ok' : ''}`}>
        {aulasTotal > 0 && (
          <p className={`tip-aula${aulaVista ? ' tip-aula--ok' : ''}`}>
            <Icon name={aulaVista ? 'check' : 'video'} />
            {aulaVista
              ? aulasTotal > 1
                ? `Todas as ${aulasTotal} aulas assistidas`
                : 'Aula já assistida'
              : aulasVistas > 0
                ? `${aulasVistas} de ${aulasTotal} aulas assistidas`
                : 'Você ainda não assistiu à aula'}
          </p>
        )}
        {/* Uma frase só por situação — sem empanturrar o cartão. */}
        {perfeito ? (
          <p>
            Você acertou todas as questões
            {aulaVista ? ' e já assistiu à aula — tema concluído' : ''}.
            Excelente trabalho!
          </p>
        ) : sim && fraco ? (
          <p>
            O tema com mais erros foi “{fraco.title}” —{' '}
            {aulaVista ? 'rever' : 'assistir a'} a aula dele pode ajudar no
            próximo simulado.
          </p>
        ) : (
          <p>
            {r.correct === 0 ? 'Não desanime — ' : ''}
            {aulaVista
              ? 'vale revê-la ou conferir a correção abaixo.'
              : 'assista à aula deste tema antes de praticar de novo.'}
          </p>
        )}
        {watch && !perfeito && (
          <Link
            className={`btn btn--sm ${aulaVista ? 'btn--outline' : 'btn--primary'}`}
            to={watch}
          >
            <Icon name={aulaVista ? 'undo' : 'video'} />
            {sim
              ? `Assistir a aula de ${recomendado!.title}`
              : aulaVista
                ? 'Assistir à aula de novo'
                : 'Assistir à aula deste tema'}
          </Link>
        )}
      </div>
      {/* Correção sempre recolhida (no simulado são até 30 itens: aberta
          viraria uma parede). O título já conta quantas questões erraram. */}
      <details className="review">
        <summary>
          {perfeito
            ? 'Ver a correção das questões'
            : `Correção das questões — ${r.total - r.correct} errada${r.total - r.correct > 1 ? 's' : ''}`}
        </summary>
        {r.items.map((x, k) => (
          // A correção (resposta certa e explicação) veio da API e foi guardada no resultado.
          <div className={`review-item ${x.ok ? 'ok' : 'bad'}`} key={k}>
            <p>
              <span className="mark">{x.ok ? 'Acertou' : 'Errou'}</span> —{' '}
              {k + 1}. <Tex>{x.ask}</Tex>
            </p>
            <p>
              Resposta certa: {LETTERS[x.answer]}){' '}
              <Tex>{x.options[x.answer]}</Tex>
              {!x.ok && x.chosen !== undefined
                ? ` · Você marcou ${LETTERS[x.chosen]}`
                : ''}
            </p>
            <p>
              <Tex>{x.why}</Tex>
            </p>
          </div>
        ))}
      </details>
      {/* Um único CTA primário: a próxima ação da jornada decidida pelo
          orquestrador a partir do estado que esta sessão deixou. Sem motor
          (ou sem caminho), o par de sempre continua disponível. */}
      {proxima ? (
        <>
          <Link
            className="btn btn--primary"
            style={{ marginTop: '1rem' }}
            to={proxima.href}
          >
            {proxima.titulo} — {proxima.sub}
          </Link>
          <Link
            className="btn btn--outline"
            style={{ marginTop: '.75rem' }}
            to={urls.area(r.subject)}
          >
            Estudar os temas
          </Link>
        </>
      ) : sim ? (
        perfeito ? (
          <>
            <Link
              className="btn btn--primary"
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
            <Link
              className="btn btn--primary"
              style={{ marginTop: '1rem' }}
              to={urls.area(r.subject)}
            >
              Estudar os temas
            </Link>
            <Link
              className="btn btn--outline"
              style={{ marginTop: '.75rem' }}
              to={urls.simulado(r.subject)}
            >
              Fazer outro simulado
            </Link>
          </>
        )
      ) : perfeito ? (
        <>
          <Link
            className="btn btn--primary"
            style={{ marginTop: '1rem' }}
            to={urls.area(r.subject)}
          >
            Escolher outro tema
          </Link>
          {t && (
            <Link
              className="btn btn--outline"
              style={{ marginTop: '.75rem' }}
              to={urls.quiz(r.subject, r.topic!)}
            >
              Praticar de novo
            </Link>
          )}
        </>
      ) : (
        <>
          {t && (
            <Link
              className="btn btn--primary"
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
