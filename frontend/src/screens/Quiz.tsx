/* Lição: até 5 questões de UM tema, com a correção logo após cada resposta */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Alternativas } from '../components/Alternativas'
import { Enunciado } from '../components/Enunciado'
import { Icon } from '../components/Icon'
import { Screen } from '../components/Screen'
import { Tex } from '../components/Tex'
import { api } from '../core/api'
import {
  apresentar,
  concluirSessao,
  corrigir,
  novaSessaoCaptura,
  questaoAprendizagem,
  submeter,
  tentativaId,
} from '../core/capturaAprendizagem'
import { carregarQuestoes } from '../core/catalogo'
import { speak, stopSpeaking } from '../core/speech'
import { useApp } from '../core/store'
import type { QuestaoItem, QuizSession, RespostaApi } from '../types'
import { LETTERS, shuffle } from '../core/utils'
import { urls } from '../core/urls'

const TAMANHO_LICAO = 5

const novaSessao = (subject: string, topic: number): QuizSession => ({
  subject,
  topic,
  questions: null, // chegam da API
  i: 0,
  chosen: [], // posição marcada em cada questão
  results: [], // correção da API de cada questão já conferida
  finished: false,
})

export default function Quiz() {
  const { id = '', ti = '0' } = useParams()
  const topic = +ti
  const subjects = useApp((s) => s.subjects)
  const quiz = useApp((s) => s.quiz)
  const setQuiz = useApp((s) => s.setQuiz)

  const t = subjects[id]?.topics[topic]
  const ativa =
    !!quiz &&
    quiz.subject === id &&
    quiz.topic === topic &&
    !quiz.finished &&
    !!quiz.questions

  // Sessão da lição: recria se mudou de alvo ou terminou (como o quiz() antigo).
  useEffect(() => {
    if (!t) return
    const q = useApp.getState().quiz
    if (!q || q.subject !== id || q.topic !== topic || q.finished)
      setQuiz(novaSessao(id, topic))
  }, [id, topic, t, setQuiz])

  if (!t) return <Navigate to={urls.home} replace />
  return (
    <Screen>
      {!ativa ? (
        <QuizLoader subject={id} topic={topic} />
      ) : (
        <QuizQuestao quiz={quiz} />
      )}
    </Screen>
  )
}

/* ---------- Carregamento das questões ---------- */
function QuizLoader({ subject, topic }: { subject: string; topic: number }) {
  const subjects = useApp((s) => s.subjects)
  const [fase, setFase] = useState<'carregando' | 'vazio' | 'erro'>(
    'carregando',
  )
  const emVoo = useRef(false)
  const h1Ref = useRef<HTMLHeadingElement>(null)

  const load = useCallback(async () => {
    if (emVoo.current) return
    emVoo.current = true
    await Promise.resolve()
    const original = useApp.getState().quiz
    try {
      const all = await carregarQuestoes(subjects, subject, topic)
      const q = useApp.getState().quiz
      if (q !== original) return
      // A pessoa já saiu da tela (sessão limpa ou outra lição).
      if (!q || q.subject !== subject || q.topic !== topic || q.finished) return
      const questions = shuffle(all).slice(0, TAMANHO_LICAO)
      if (!questions.length) {
        setFase('vazio')
        return
      }
      const captura = await novaSessaoCaptura('licao')
      const atual = useApp.getState().quiz
      if (!atual || atual !== q || atual.finished) return
      useApp.getState().setQuiz({ ...atual, questions, captura })
    } catch {
      setFase('erro')
    } finally {
      emVoo.current = false
    }
  }, [subjects, subject, topic])

  useEffect(() => {
    // Busca de dados: os setState dentro de load() só acontecem depois do await.
    // eslint-disable-next-line react/set-state-in-effect
    load()
  }, [load])

  // Foco no h1 quando sai do "carregando" (focusTitle do front antigo).
  useEffect(() => {
    if (fase === 'carregando') return
    const h = h1Ref.current
    if (h) {
      h.tabIndex = -1
      h.focus({ preventScroll: true })
    }
    window.scrollTo(0, 0)
  }, [fase])

  const voltar = (
    <Link
      className="btn btn--outline"
      style={{ marginTop: '1rem' }}
      to={urls.area(subject)}
    >
      Voltar para os temas
    </Link>
  )
  const retry = () => {
    setFase('carregando')
    load()
  }
  if (fase === 'vazio')
    return (
      <>
        <h1 className="quiz-count" ref={h1Ref}>
          Ainda não há questões neste tema.
        </h1>
        {voltar}
      </>
    )
  if (fase === 'erro')
    return (
      <>
        <h1 className="quiz-count" ref={h1Ref}>
          Não foi possível carregar as questões.
        </h1>
        <p className="lede">Confira sua conexão e tente de novo.</p>
        <button
          className="btn btn--primary"
          style={{ marginTop: '1rem' }}
          id="retry"
          onClick={retry}
        >
          Tentar de novo
        </button>
        {voltar}
      </>
    )
  return <h1 className="quiz-count">Preparando a lição…</h1>
}

/* ---------- A questão em si ---------- */
function QuizQuestao({ quiz }: { quiz: QuizSession }) {
  const subjects = useApp((s) => s.subjects)
  const setQuiz = useApp((s) => s.setQuiz)
  const pushResult = useApp((s) => s.pushResult)
  const speakOn = useApp((s) => s.a11y.speak)
  const navigate = useNavigate()

  const s = subjects[quiz.subject]
  const t = s.topics[quiz.topic]
  const item = quiz.questions![quiz.i]
  const total = quiz.questions!.length
  const chosen = quiz.chosen[quiz.i]
  const result = quiz.results[quiz.i]
  const answer = result ? item.options.indexOf(result.respostaCorreta) : -1
  const last = quiz.i === total - 1

  const h1Ref = useRef<HTMLHeadingElement>(null)
  const montou = useRef(false)

  const readAloud = useCallback(
    () =>
      speak(
        `Questão ${quiz.i + 1}. ${item.text ? item.text + '. ' : ''}${
          item.imagem?.descricao
            ? 'Imagem: ' + item.imagem.descricao + '. '
            : ''
        }${item.ask} ${item.options.map((o, k) => `Alternativa ${LETTERS[k]}: ${o}.`).join(' ')}`,
      ),
    [quiz.i, item],
  )

  useEffect(() => {
    void apresentar(
      quiz.captura,
      questaoAprendizagem(item, quiz.subject, t.slug),
      tentativaId(quiz.captura, quiz.i),
    )
  }, [quiz.captura, quiz.i, quiz.subject, item, t.slug])

  // Avançou (Continuar): foca o h1 e rola para o topo (focusTitle antigo),
  // e lê a questão se "voz alta" estiver ligada.
  useEffect(() => {
    if (!montou.current) {
      montou.current = true
      // Na 1ª questão, a leitura automática cuida da voz.
      if (speakOn && quiz.i === 0 && quiz.chosen[0] === undefined) readAloud()
      return
    }
    const h = h1Ref.current
    if (h) {
      h.tabIndex = -1
      h.focus({ preventScroll: true })
    }
    window.scrollTo(0, 0)
    document.getElementById('app')!.scrollTop = 0
    if (speakOn) readAloud()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiz.i])

  const escolher = (k: number) => {
    const q = useApp.getState().quiz!
    if (q.captura?.confiavel && q.pendente?.[q.i] !== undefined) return
    const chosen = q.chosen.slice()
    chosen[q.i] = k
    setQuiz({ ...q, chosen })
  }

  // Guarda o resumo da lição (com a correção que veio da API) e abre o resultado.
  const finishingRef = useRef(false)
  const finishLesson = async () => {
    const q = useApp.getState().quiz
    if (
      !q ||
      q.questions !== quiz.questions ||
      q.finished ||
      finishingRef.current
    )
      return
    finishingRef.current = true
    try {
      await concluirSessao(q.captura)
      const depois = useApp.getState().quiz
      if (depois?.questions !== q.questions || depois.finished) return
      const items = q.questions!.map((item, k) => {
        const r = q.results[k]!
        return {
          id: item.id, // conta como atividade concluída quando acertada (stats.ts)
          ask: item.ask,
          options: item.options,
          chosen: q.chosen[k],
          answer: item.options.indexOf(r.respostaCorreta),
          why: r.resolucao,
          topic: item.topic,
          ok: r.acertou,
        }
      })
      const correct = items.filter((x) => x.ok).length
      pushResult({
        v: 3, // lição por tema
        subject: q.subject,
        topic: q.topic,
        date: Date.now(),
        correct,
        total: items.length,
        items,
        weakTopic: correct < items.length ? q.topic : null,
      })
      setQuiz({ ...q, finished: true })
      navigate(urls.resultado(useApp.getState().results.length - 1))
    } finally {
      finishingRef.current = false
    }
  }

  return (
    <>
      <div className="quiz-top">
        <Link
          className="icon-btn"
          to={urls.area(quiz.subject)}
          aria-label="Sair da lição"
        >
          <Icon name="xBox" />
        </Link>
        <div
          className="progress"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={quiz.i + 1}
          aria-label="Progresso da lição"
        >
          <i style={{ width: `${((quiz.i + 1) / total) * 100}%` }} />
        </div>
      </div>
      <h1 className="quiz-count" ref={h1Ref}>
        Questão {quiz.i + 1} de {total}
      </h1>
      <p className="q-contexto">
        {s.name} · {t.title}
      </p>
      <section className="statement" aria-labelledby="ask">
        <Enunciado item={item} onOuvir={readAloud} />
      </section>
      {/* key por questão: estado local (checando/erro) recomeça a cada uma,
          como o drawQuestion que recriava o DOM. */}
      <QuestaoBox
        key={quiz.i}
        quiz={quiz}
        item={item}
        chosen={chosen}
        result={result}
        answer={answer}
        last={last}
        onChoose={escolher}
        onNext={() => {
          stopSpeaking()
          if (last) finishLesson()
          else setQuiz({ ...useApp.getState().quiz!, i: quiz.i + 1 })
        }}
      />
    </>
  )
}

function QuestaoBox({
  quiz,
  item,
  chosen,
  result,
  answer,
  last,
  onChoose,
  onNext,
}: {
  quiz: QuizSession
  item: QuestaoItem
  chosen: number | undefined
  result: RespostaApi | undefined
  answer: number
  last: boolean
  onChoose: (k: number) => void
  onNext: () => void
}) {
  const [checking, setChecking] = useState(false)
  const checkingRef = useRef(false)
  const [checkError, setCheckError] = useState(false)
  const checkRef = useRef<HTMLButtonElement>(null)
  const fbRef = useRef<HTMLHeadingElement>(null)
  const speakOn = useApp((s) => s.a11y.speak)
  const subjects = useApp((s) => s.subjects)

  // Correção chegou: foca o título do feedback e lê em voz alta se ligado.
  useEffect(() => {
    if (!result) return
    const h = fbRef.current
    if (h) {
      h.tabIndex = -1
      h.focus()
    }
    if (speakOn)
      speak(
        `${result.acertou ? 'Você acertou!' : 'Não foi dessa vez. A resposta certa é: ' + result.respostaCorreta + '.'} ${result.resolucao}`,
      )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result])

  // Erro na correção: foca o "Conferir" de novo (como o front antigo).
  useEffect(() => {
    if (checkError) checkRef.current?.focus()
  }, [checkError])

  // Conferir: manda o TEXTO da alternativa para a API e mostra a correção na hora.
  const conferir = async () => {
    if (checking || checkingRef.current || chosen === undefined) return
    checkingRef.current = true
    setChecking(true)
    setCheckError(false)
    stopSpeaking()
    const temaSlug = subjects[quiz.subject].topics[quiz.topic].slug
    const questao = questaoAprendizagem(item, quiz.subject, temaSlug)
    const sess = quiz.captura ?? null
    const atual = () =>
      useApp.getState().quiz?.questions === quiz.questions &&
      !useApp.getState().quiz?.finished
    if (!atual()) return
    const tid = tentativaId(sess, quiz.i)
    const texto =
      useApp.getState().quiz?.pendente?.[quiz.i] ?? item.options[chosen]
    if (sess) {
      const gravada = await submeter(sess, questao, tid, true, false, texto)
      if (!atual()) return
      if (gravada) {
        const q0 = useApp.getState().quiz!
        const pendente = (q0.pendente ?? []).slice()
        pendente[quiz.i] = texto
        useApp.getState().setQuiz({ ...q0, pendente })
      }
    }
    try {
      if (!atual()) return
      const r = await api.resposta(item.id, texto)
      if (!atual()) return
      if (sess)
        await corrigir(
          sess,
          questao,
          tid,
          r.acertou,
          false,
          r.revisaoConteudo,
          r.codigo,
        )
      if (!atual()) return
      const q = useApp.getState().quiz
      if (!q || q.questions !== quiz.questions) return
      const results = q.results.slice()
      results[quiz.i] = r
      useApp.getState().setQuiz({ ...q, results })
    } catch {
      if (!atual()) return
      checkingRef.current = false
      setCheckError(true)
      setChecking(false)
    }
  }

  if (result) {
    return (
      <>
        <Alternativas
          item={item}
          chosen={chosen}
          onChoose={() => {}}
          result={result}
        />
        <section
          className={`tip feedback ${result.acertou ? 'feedback--ok' : 'feedback--bad'}`}
          aria-labelledby="feedback-title"
        >
          <h2 id="feedback-title" ref={fbRef}>
            <Icon name={result.acertou ? 'check' : 'x'} />
            {result.acertou ? 'Você acertou!' : 'Não foi dessa vez'}
          </h2>
          {!result.acertou && (
            <p>
              <strong>Resposta certa:</strong> {LETTERS[answer]}){' '}
              <Tex>{result.respostaCorreta}</Tex>
            </p>
          )}
          <p>
            <Tex>{result.resolucao}</Tex>
          </p>
        </section>
        <div className="quiz-nav quiz-nav--fixa">
          <button className="btn btn--primary" id="next" onClick={onNext}>
            {last ? 'Ver resultado' : 'Continuar'}
            <Icon name="chevronRight" />
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      <Alternativas item={item} chosen={chosen} onChoose={onChoose} />
      <p className="error" id="check-error" role="alert" hidden={!checkError}>
        Não foi possível conferir. Sua escolha foi mantida. Tente de novo.
      </p>
      <div className="quiz-nav quiz-nav--fixa">
        <button
          className="btn btn--primary"
          id="check"
          ref={checkRef}
          disabled={chosen === undefined || checking}
          onClick={conferir}
        >
          {checking ? 'Conferindo…' : 'Conferir'}
        </button>
      </div>
    </>
  )
}
