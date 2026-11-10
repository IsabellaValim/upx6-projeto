/* Vídeo-aula: o vídeo, o que ele ensina e uma ação principal (ir praticar) */
import { useEffect, useRef } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { Screen } from '../components/Screen'
import { SwitchRow } from '../components/Switch'
import { useApp } from '../core/store'
import { toast } from '../core/toast'
import { urls } from '../core/urls'

// Embed do YouTube (nunca hospedamos o vídeo). Legenda em português quando
// "Legendas" está ligado; enablejsapi permite mudar a velocidade.
const playerSrc = (youtubeId: string, subs: boolean) =>
  `https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeId)}?enablejsapi=1&cc_lang_pref=pt&hl=pt-BR` +
  `&cc_load_policy=${subs ? 1 : 0}&origin=${encodeURIComponent(location.origin)}`

// "Como calcular porcentagem (Gis com Giz)" → título + canal.
function separarCanal(titulo: string) {
  const m = titulo.match(/^(.*\S)\s+\(([^()]+)\)$/)
  return m ? { titulo: m[1], canal: m[2] } : { titulo, canal: null }
}

function YoutubePlayer({
  youtubeId,
  titulo,
  subs,
  slow,
}: {
  youtubeId: string
  titulo: string
  subs: boolean
  slow: boolean
}) {
  const ref = useRef<HTMLIFrameElement>(null)
  // Velocidade calma: comando da API de iframe do YouTube (enablejsapi=1).
  const speed = () =>
    ref.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func: 'setPlaybackRate', args: [slow ? 0.75 : 1] }),
      '*',
    )
  // Trocar o switch "Velocidade calma" aplica na hora; trocar "Legendas"
  // muda a `key` no pai e recarrega o player com/sem cc_load_policy.
  useEffect(speed, [slow])
  return (
    <div className="player">
      <iframe
        id="yt"
        ref={ref}
        src={playerSrc(youtubeId, subs)}
        title={`Vídeo-aula: ${titulo}`}
        allow="encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        onLoad={speed}
      />
    </div>
  )
}

const OPCOES = [
  ['subs', 'subtitles', 'Legendas', 'Em português, quando o vídeo tiver.'],
  ['slow', 'gauge', 'Velocidade calma', 'O vídeo toca mais devagar (0,75x).'],
] as const

export default function Video() {
  const { id = '', ti = '0', li = '0' } = useParams()
  const subjects = useApp((s) => s.subjects)
  const a11y = useApp((s) => s.a11y)
  const setA11y = useApp((s) => s.setA11y)
  const watched = useApp((s) => s.watched)
  const setWatched = useApp((s) => s.setWatched)
  const navigate = useNavigate()

  const s = subjects[id]
  const t = s?.topics[+ti]
  const l = t?.lessons[+li]
  if (!l) return <Navigate to={urls.home} replace />

  const key = `${id}/${ti}/${li}`
  const done = !!watched[key]
  const next = +li + 1 < t.lessons.length ? urls.video(id, +ti, +li + 1) : null
  const { titulo, canal } = separarCanal(l.kind)
  const meta = [canal, `Tema ${+ti + 1} de ${s.topics.length}`, l.min && `${l.min} min`].filter(Boolean)

  // Concluir a aula conta como atividade (stats.ts).
  const marcar = () => {
    if (!watched[key]) setWatched(key)
  }

  const alternar = (k: 'subs' | 'slow') => {
    setA11y({ [k]: !a11y[k] })
    toast(
      k === 'subs'
        ? !a11y.subs
          ? 'Legendas ligadas (quando o vídeo tiver)'
          : 'Legendas desligadas'
        : !a11y.slow
          ? 'Velocidade calma ligada'
          : 'Velocidade normal',
    )
  }

  return (
    <Screen cls="screen--nav" nav="inicio">
      <div className="topbar topbar--split">
        <Link className="icon-btn icon-btn--solid" to={urls.area(id)} aria-label="Voltar para os temas">
          <Icon name="arrowLeft" />
        </Link>
        <p className="topbar-title">{t.title}</p>
        <Link
          className="icon-btn icon-btn--solid"
          to={urls.acessibilidade}
          aria-label="Opções de acessibilidade"
        >
          <Icon name="access" />
        </Link>
      </div>
      {/* key recarrega o player ao trocar "Legendas" (cc_load_policy) */}
      <YoutubePlayer
        key={`${l.youtubeId}-${a11y.subs}`}
        youtubeId={l.youtubeId}
        titulo={titulo}
        subs={a11y.subs}
        slow={a11y.slow}
      />
      <h1 className="lesson-title">{titulo}</h1>
      <p className="lesson-meta">{meta.join(' · ')}</p>
      {done && (
        <p className="lesson-done">
          <Icon name="check" />
          Você já viu esta aula
        </p>
      )}
      <p className="lesson-about">{t.about}</p>

      <div className="lesson-actions">
        {t.totalQuestoes > 0 && (
          <button
            className="btn btn--primary"
            id="practice"
            onClick={() => {
              marcar()
              navigate(urls.quiz(id, +ti))
            }}
          >
            <Icon name="checkSquare" />
            {done ? 'Praticar este tema' : 'Terminei a aula, quero praticar'}
          </button>
        )}
        {next && (
          <Link className="btn btn--outline" to={next}>
            Próxima aula
          </Link>
        )}
        {done ? (
          <Link className="btn btn--outline" to={urls.area(id)}>
            Voltar para os temas
          </Link>
        ) : (
          <button
            className="btn btn--outline"
            id="seen"
            onClick={() => {
              marcar()
              toast('Aula marcada como vista')
              navigate(urls.area(id))
            }}
          >
            Marcar como vista e voltar
          </button>
        )}
      </div>

      <h2 className="section-label">Opções do vídeo</h2>
      <div className="card card--flush">
        {OPCOES.map(([k, ic, nome, desc]) => (
          <SwitchRow
            key={k}
            ic={ic}
            rotuloId={`lbl-${k}`}
            titulo={nome}
            desc={desc}
            checked={a11y[k]}
            onToggle={() => alternar(k)}
            comEstado
          />
        ))}
      </div>

      <p className="small video-fallback">
        O vídeo não abriu?{' '}
        <a
          className="link"
          href={`https://www.youtube.com/watch?v=${l.youtubeId}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Assistir no YouTube
          <Icon name="external" />
          <span className="sr-only"> (abre em outra aba)</span>
        </a>
      </p>
    </Screen>
  )
}
