/* Rodada guiada: diagnóstico ou verificação multi-tema de UMA disciplina.
   As questões vêm da seleção adaptativa cruzando os temas validados; a
   sessão é 'rodada' — só gera evidência se concluída, como o simulado,
   porque é avaliação e não lição. */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { Screen } from '../components/Screen'
import { montarRodada, novaSessaoCaptura } from '../core/capturaAprendizagem'
import { useApp } from '../core/store'
import { urls } from '../core/urls'
import { QuizQuestao } from './Quiz'

const TAMANHO_RODADA = 6
// Treino de simulado cresce com o aprendizado: ?n= vem do orquestrador e é
// limitado para nunca virar um simulado disfarçado nem uma rodada vazia.
const TAMANHO_MIN = 3
const TAMANHO_MAX = 15

export default function Estudo() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const subjects = useApp((s) => s.subjects)
  const quiz = useApp((s) => s.quiz)
  const setQuiz = useApp((s) => s.setQuiz)
  const s = subjects[id]
  const tamanho = Math.min(
    TAMANHO_MAX,
    Math.max(TAMANHO_MIN, Number(params.get('n')) || TAMANHO_RODADA),
  )

  const ativa =
    !!quiz && quiz.estudo === id && !quiz.finished && !!quiz.questions

  // Sessão da rodada: recria se mudou de disciplina, de tamanho ou terminou.
  useEffect(() => {
    if (!s) return
    const q = useApp.getState().quiz
    if (!q || q.estudo !== id || q.finished)
      setQuiz({
        subject: id,
        topic: -1,
        estudo: id,
        questions: null,
        i: 0,
        chosen: [],
        results: [],
        finished: false,
      })
  }, [id, s, setQuiz])

  if (!s) return <Navigate to={urls.home} replace />
  return (
    <Screen>
      {!ativa ? (
        <RodadaLoader disciplina={id} tamanho={tamanho} />
      ) : (
        <QuizQuestao quiz={quiz} />
      )}
    </Screen>
  )
}

/* ---------- Carregamento da rodada ---------- */
function RodadaLoader({
  disciplina,
  tamanho,
}: {
  disciplina: string
  tamanho: number
}) {
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
      const questions = await montarRodada(disciplina, tamanho)
      const q = useApp.getState().quiz
      if (q !== original) return
      if (!q || q.estudo !== disciplina || q.finished) return
      if (!questions.length) {
        setFase('vazio')
        return
      }
      const captura = await novaSessaoCaptura('rodada')
      const atual = useApp.getState().quiz
      if (!atual || atual !== q || atual.finished) return
      useApp.getState().setQuiz({ ...atual, questions, captura })
    } catch {
      setFase('erro')
    } finally {
      emVoo.current = false
    }
  }, [disciplina, tamanho])

  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect
    load()
  }, [load])

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
      to={urls.area(disciplina)}
    >
      Voltar para os temas
    </Link>
  )
  if (fase === 'vazio')
    return (
      <>
        <h1 className="quiz-count" ref={h1Ref}>
          Ainda não há questões nesta matéria.
        </h1>
        {voltar}
      </>
    )
  if (fase === 'erro')
    return (
      <>
        <h1 className="quiz-count" ref={h1Ref}>
          Não foi possível montar a sua sessão.
        </h1>
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
        {voltar}
      </>
    )
  return <h1 className="quiz-count">Preparando a sua sessão…</h1>
}
