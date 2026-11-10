/* ==========================================================
   Simulado: questões de todos os temas de uma matéria, com tempo,
   sem correção até o fim (como no dia da prova).
   ========================================================== */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Alternativas } from '../components/Alternativas'
import { Enunciado } from '../components/Enunciado'
import { Icon } from '../components/Icon'
import { BackBtn } from '../components/Nav'
import { SubjectRow } from '../components/Progress'
import { Screen } from '../components/Screen'
import { api } from '../core/api'
import { carregarQuestoes, materiasDoNivel } from '../core/catalogo'
import { speak, stopSpeaking } from '../core/speech'
import { useApp } from '../core/store'
import { toast } from '../core/toast'
import type { RespostaApi, SimuladoSession } from '../types'
import { LETTERS, shuffle } from '../core/utils'
import { urls } from '../core/urls'

// Configuração única. Ajustar ao edital do Encceja quando houver questões oficiais.
const SIMULADO = {
  maxQuestoes: 30, // no máximo; usa menos se o catálogo tiver menos
  minutosPorQuestao: 3,
  avisoMinutos: 5, // aviso quando faltar este tempo
}

const mmss = (ms: number) => {
  const s = Math.floor(Math.abs(ms) / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

const novaSessao = (subject: string): SimuladoSession => ({
  subject,
  questions: null, // chegam da API
  treino: false, // true = sem questões oficiais suficientes, usa as autorais
  i: 0,
  chosen: [],
  startedAt: null,
  limitMs: 0,
  warned: false,
  finished: false,
})

export default function Simulado() {
  const { id } = useParams()
  const subjects = useApp((s) => s.subjects)
  return id && subjects[id] ? <Prova id={id} /> : <Instrucoes />
}

/* ---------- Instruções e escolha da matéria ---------- */
function Instrucoes() {
  const nivel = useApp((s) => s.nivel)
  const subjects = useApp((s) => s.subjects)
  const materias = materiasDoNivel(subjects, nivel).filter(
    (s) => s.totalQuestoes > 0,
  )
  return (
    <Screen cls="screen--nav" nav="inicio">
      <div className="topbar">
        <BackBtn to={urls.home} />
      </div>
      <h1 className="title">Simulado</h1>
      <p className="lede">Teste o que aprendeu como no dia da prova.</p>
      <ul className="sim-rules">
        <li>
          <Icon name="checkSquare" />
          <span>
            Questões de todos os temas da matéria, em ordem aleatória.
          </span>
        </li>
        <li>
          <Icon name="clock" />
          <span>
            {SIMULADO.minutosPorQuestao} minutos por questão. O relógio fica
            sempre à vista, e você pode terminar mesmo depois do tempo.
          </span>
        </li>
        <li>
          <Icon name="eye" />
          <span>
            A correção aparece só no fim. Dá para voltar e mudar respostas antes
            de entregar.
          </span>
        </li>
      </ul>
      <h2 className="section-label">Escolha a matéria</h2>
      {materias.length ? (
        <div className="subject-list">
          {materias.map((s) => {
            const n = Math.min(SIMULADO.maxQuestoes, s.totalQuestoes)
            return (
              <SubjectRow key={s.id} to={urls.simulado(s.id)} icon={s.icon}>
                <strong>{s.name}</strong>
                <small>
                  {n} questões · {n * SIMULADO.minutosPorQuestao} minutos
                </small>
              </SubjectRow>
            )
          })}
        </div>
      ) : (
        <div className="empty">
          <p>Ainda não há questões para montar um simulado.</p>
        </div>
      )}
    </Screen>
  )
}

/* ---------- A prova ---------- */
function Prova({ id }: { id: string }) {
  const sim = useApp((s) => s.simulado)
  const setSimulado = useApp((s) => s.setSimulado)
  const ativa = !!sim && sim.subject === id && !sim.finished && !!sim.questions

  // Sessão do simulado: recria se mudou de matéria ou terminou.
  useEffect(() => {
    const s = useApp.getState().simulado
    if (!s || s.subject !== id || s.finished) setSimulado(novaSessao(id))
  }, [id, setSimulado])

  // Durante a prova, sem a barra de baixo: menos distração e nada de sair sem querer.
  return (
    <Screen focus={false}>
      {!ativa ? <SimLoader id={id} /> : <ProvaQuestao sim={sim} />}
    </Screen>
  )
}

function SimLoader({ id }: { id: string }) {
  const subjects = useApp((s) => s.subjects)
  const setSimulado = useApp((s) => s.setSimulado)
  const [fase, setFase] = useState<'carregando' | 'vazio' | 'erro'>(
    'carregando',
  )
  const emVoo = useRef(false)

  const load = useCallback(async () => {
    if (emVoo.current) return
    emVoo.current = true
    const s = subjects[id]
    try {
      const porTema = await Promise.all(
        s.topics.map((t, ti) =>
          t.totalQuestoes
            ? carregarQuestoes(subjects, id, ti)
            : Promise.resolve([]),
        ),
      )
      const q = useApp.getState().simulado
      if (!q || q.subject !== id || q.finished) return // a pessoa já saiu
      const todas = porTema.flat()
      // Prefere as questões do Encceja; sem quantidade suficiente, treina com as autorais.
      const oficiais = todas.filter((x) => x.prova?.ano)
      const base =
        oficiais.length >= Math.min(SIMULADO.maxQuestoes, todas.length)
          ? oficiais
          : todas
      const questions = shuffle(base).slice(0, SIMULADO.maxQuestoes)
      if (!questions.length) {
        setFase('vazio')
        return
      }
      setSimulado({
        ...q,
        questions,
        treino: base !== oficiais || !oficiais.length,
        startedAt: Date.now(),
        limitMs: questions.length * SIMULADO.minutosPorQuestao * 60_000,
      })
    } catch {
      setFase('erro')
    } finally {
      emVoo.current = false
    }
  }, [subjects, id, setSimulado])

  useEffect(() => {
    // Busca de dados: os setState dentro de load() só acontecem depois do await.
    // eslint-disable-next-line react/set-state-in-effect
    load()
  }, [load])

  if (fase === 'vazio')
    return (
      <>
        <h1 className="quiz-count">Ainda não há questões nesta matéria.</h1>
        <Link
          className="btn btn--outline"
          style={{ marginTop: '1rem' }}
          to={urls.simulado()}
        >
          Voltar
        </Link>
      </>
    )
  if (fase === 'erro')
    return (
      <>
        <h1 className="quiz-count">Não foi possível montar o simulado.</h1>
        <p className="lede">Confira sua conexão e tente de novo.</p>
        <button
          className="btn btn--primary"
          style={{ marginTop: '1rem' }}
          id="retry"
          onClick={() => {
            setFase('carregando')
            load()
          }}
        >
          Tentar de novo
        </button>
      </>
    )
  return <h1 className="quiz-count">Montando o simulado…</h1>
}

/* ---------- A questão em si ---------- */
function ProvaQuestao({ sim }: { sim: SimuladoSession }) {
  const subjects = useApp((s) => s.subjects)
  const setSimulado = useApp((s) => s.setSimulado)
  const pushResult = useApp((s) => s.pushResult)
  const navigate = useNavigate()

  const [panel, setPanel] = useState(false)
  const [exitOpen, setExitOpen] = useState(false)
  const [finishOpen, setFinishOpen] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const h1Ref = useRef<HTMLHeadingElement>(null)
  const exitNoRef = useRef<HTMLButtonElement>(null)
  const finishNoRef = useRef<HTMLButtonElement>(null)
  const montou = useRef(false)

  const s = subjects[sim.subject]
  const item = sim.questions![sim.i]
  const total = sim.questions!.length
  const answered = sim.chosen.filter((x) => x !== undefined).length
  const chosen = sim.chosen[sim.i]
  const faltam = total - answered

  // Relógio: mostra o tempo que falta; depois do limite, quanto passou (sem encerrar).
  // `left` fica em state atualizado pelo próprio interval (Date.now fora do render).
  const [left, setLeft] = useState(sim.limitMs)
  useEffect(() => {
    if (!sim.startedAt) return
    const t = setInterval(() => {
      const cur = useApp.getState().simulado
      if (!cur || cur.finished || !cur.startedAt) return
      const left = cur.limitMs - (Date.now() - cur.startedAt)
      if (left > 0) {
        if (!cur.warned && left <= SIMULADO.avisoMinutos * 60_000) {
          useApp.getState().setSimulado({ ...cur, warned: true })
          toast(`Faltam ${SIMULADO.avisoMinutos} minutos.`)
        }
      } else if (!cur.overWarned) {
        useApp.getState().setSimulado({ ...cur, overWarned: true })
        toast('O tempo da prova acabou. Você pode terminar com calma.')
      }
      setLeft(left)
    }, 1000)
    return () => clearInterval(t)
  }, [sim.startedAt])
  const over = left <= 0
  const timerCls = `sim-timer${over ? ' is-over' : left <= SIMULADO.avisoMinutos * 60_000 ? ' is-warning' : ''}`

  // Mudou de questão: foco no h1 e rola para o topo (focusTitle antigo).
  useEffect(() => {
    if (!montou.current) {
      montou.current = true
      return
    }
    const h = h1Ref.current
    if (h) {
      h.tabIndex = -1
      h.focus({ preventScroll: true })
    }
    window.scrollTo(0, 0)
    document.getElementById('app')!.scrollTop = 0
  }, [sim.i])

  // Confirmações abrem com o foco no "não" (como no front antigo).
  useEffect(() => {
    if (exitOpen) exitNoRef.current?.focus()
  }, [exitOpen])
  useEffect(() => {
    if (finishOpen) finishNoRef.current?.focus()
  }, [finishOpen])

  const goTo = (k: number, comPainel = false) => {
    stopSpeaking()
    setSimulado({ ...useApp.getState().simulado!, i: k })
    if (comPainel) setPanel(true)
  }

  const escolher = (k: number) => {
    const cur = useApp.getState().simulado!
    const chosen = cur.chosen.slice()
    chosen[cur.i] = k
    setSimulado({ ...cur, chosen })
  }

  const readAloud = useCallback(
    () =>
      speak(
        `Questão ${sim.i + 1}. ${item.text ? item.text + '. ' : ''}${
          item.imagem?.descricao
            ? 'Imagem: ' + item.imagem.descricao + '. '
            : ''
        }${item.ask} ${item.options.map((o, k) => `Alternativa ${LETTERS[k]}: ${o}.`).join(' ')}`,
      ),
    [sim.i, item],
  )

  // Entregar: avisa se ficou questão sem resposta; senão corrige direto.
  const pedirEntrega = () => {
    if (faltam === 0) return entregar()
    setFinishOpen(true)
  }

  // Corrige tudo pela API (POST com o texto da alternativa) e abre o resultado.
  const entregar = async () => {
    if (finishing) return
    setFinishing(true)
    toast('Corrigindo o simulado…')
    const q = useApp.getState().simulado!
    let corr: RespostaApi[]
    try {
      // Questão sem resposta também é consultada (com qualquer alternativa) só para
      // trazer o gabarito e a resolução; ela conta como erro mesmo assim.
      corr = await Promise.all(
        q.questions!.map((item, k) =>
          api.resposta(item.id, item.options[q.chosen[k] ?? 0]),
        ),
      )
    } catch {
      toast(
        'Não foi possível corrigir agora. Suas respostas foram mantidas. Tente de novo.',
      )
      setFinishing(false)
      return
    }
    if (
      !useApp.getState().simulado ||
      useApp.getState().simulado!.subject !== q.subject
    )
      return
    const items = q.questions!.map((item, k) => {
      const c = corr[k]
      const respondida = q.chosen[k] !== undefined
      return {
        id: item.id,
        ask: item.ask,
        options: item.options,
        chosen: q.chosen[k],
        answer: item.options.indexOf(c.respostaCorreta),
        why:
          (respondida ? '' : 'Você não respondeu esta questão. ') + c.resolucao,
        topic: item.topic,
        ok: respondida && c.acertou,
      }
    })
    const correct = items.filter((x) => x.ok).length
    const erros: Record<number, number> = {}
    items.forEach((x) => {
      if (!x.ok && x.topic !== undefined)
        erros[x.topic] = (erros[x.topic] ?? 0) + 1
    })
    const pior = Object.keys(erros).sort((a, b) => erros[+b] - erros[+a])[0]
    pushResult({
      v: 3,
      kind: 'simulado',
      subject: q.subject,
      date: Date.now(),
      correct,
      total: items.length,
      items,
      treino: q.treino,
      usedMs: Date.now() - q.startedAt!,
      limitMs: q.limitMs,
      weakTopic: pior === undefined ? null : +pior,
    })
    useApp.getState().setSimulado({ ...q, finished: true })
    stopSpeaking()
    navigate(urls.resultado(useApp.getState().results.length - 1))
  }

  return (
    <>
      <div className="quiz-top">
        <button
          className="icon-btn"
          id="exit"
          aria-label="Sair do simulado"
          onClick={() => setExitOpen(true)}
        >
          <Icon name="xBox" />
        </button>
        <div
          className={timerCls}
          id="timer"
          role="timer"
          aria-label="Tempo restante"
        >
          <Icon name="clock" />
          <span>
            {over
              ? `Tempo esgotado · +${mmss(left)}`
              : `${mmss(left)} restantes`}
          </span>
        </div>
      </div>
      {sim.treino && (
        <p className="sim-badge">Simulado de treino · questões autorais</p>
      )}
      {/* Sair e entregar: confirmação na própria tela (sem caixas do navegador). */}
      <div id="exit-confirm" className="tip" hidden={!exitOpen}>
        <p>
          <strong>Sair do simulado?</strong>
        </p>
        <p>As respostas desta tentativa serão perdidas.</p>
        <div className="quiz-nav">
          <button
            className="btn btn--outline"
            id="exit-no"
            ref={exitNoRef}
            onClick={() => setExitOpen(false)}
          >
            Continuar o simulado
          </button>
          <Link
            className="btn btn--primary"
            to={urls.home}
            id="exit-yes"
            onClick={() => setSimulado(null)}
          >
            Sair
          </Link>
        </div>
      </div>
      <h1 className="quiz-count" ref={h1Ref}>
        Questão {sim.i + 1} de {total}
      </h1>
      <p className="q-contexto">
        {s.name} · {s.topics[item.topic].title} ·{' '}
        <span className="sim-respondidas">
          {answered} de {total} respondidas
        </span>
      </p>
      <section className="statement" aria-labelledby="ask">
        <Enunciado item={item} onOuvir={readAloud} />
      </section>
      <Alternativas item={item} chosen={chosen} onChoose={escolher} />
      <div className="quiz-nav quiz-nav--fixa">
        <button
          className="btn btn--outline btn--sm"
          id="prev"
          disabled={sim.i === 0}
          onClick={() => goTo(sim.i - 1)}
        >
          <Icon name="undo" />
          Anterior
        </button>
        {sim.i === total - 1 ? (
          <button
            className="btn btn--primary btn--sm"
            id="finish"
            disabled={finishing}
            onClick={pedirEntrega}
          >
            Entregar simulado
          </button>
        ) : (
          <button
            className="btn btn--primary btn--sm"
            id="next"
            onClick={() => goTo(sim.i + 1)}
          >
            Próxima
            <Icon name="chevronRight" />
          </button>
        )}
      </div>
      <details
        className="sim-panel"
        open={panel}
        onToggle={(e) => setPanel(e.currentTarget.open)}
      >
        <summary>
          <Icon name="checkSquare" />
          Ver todas as questões
        </summary>
        <div className="sim-grid">
          {sim.questions!.map((_, k) => (
            <button
              key={k}
              className={`sim-cell ${sim.chosen[k] !== undefined ? 'is-answered' : ''} ${k === sim.i ? 'is-current' : ''}`}
              aria-label={`Questão ${k + 1}${sim.chosen[k] !== undefined ? ', respondida' : ', sem resposta'}`}
              aria-current={k === sim.i ? 'true' : undefined}
              onClick={() => goTo(k, true)}
            >
              {k + 1}
            </button>
          ))}
        </div>
        <p className="small">Roxo: respondida. Contorno: sem resposta.</p>
        <button
          className="btn btn--primary"
          id="finish-panel"
          style={{ marginTop: '.75rem' }}
          disabled={finishing}
          onClick={pedirEntrega}
        >
          Entregar simulado
        </button>
      </details>
      <div id="finish-confirm" className="tip" hidden={!finishOpen}>
        <p>
          <strong id="finish-msg">
            {faltam === 1 ? 'Ficou 1 questão' : `Ficaram ${faltam} questões`}{' '}
            sem resposta. Questão sem resposta conta como erro.
          </strong>
        </p>
        <div className="quiz-nav">
          <button
            className="btn btn--outline"
            id="finish-no"
            ref={finishNoRef}
            onClick={() => {
              setFinishOpen(false)
              const first = sim.chosen.findIndex((x) => x === undefined)
              goTo(first < 0 ? 0 : first, true)
            }}
          >
            Voltar às questões
          </button>
          <button
            className="btn btn--primary"
            id="finish-yes"
            disabled={finishing}
            onClick={entregar}
          >
            Entregar mesmo assim
          </button>
        </div>
      </div>
    </>
  )
}
