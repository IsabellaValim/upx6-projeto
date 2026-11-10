/* ==========================================================
   Alternativas — .alts radiogroup da lição e do simulado.
   Teclado: setas movem o foco (roving tabindex) E selecionam,
   ciclando no fim — igual ao front antigo.
   ========================================================== */
import { useRef, type KeyboardEvent } from 'react'
import type { QuestaoItem, RespostaApi } from '../types'
import { LETTERS } from '../core/utils'
import { Icon } from './Icon'
import { Tex } from './Tex'

const DIRECOES: Record<string, number> = {
  ArrowDown: 1,
  ArrowRight: 1,
  ArrowUp: -1,
  ArrowLeft: -1,
}

export function Alternativas({
  item,
  chosen,
  onChoose,
  result,
}: {
  item: QuestaoItem
  chosen: number | undefined
  onChoose: (k: number) => void
  result?: RespostaApi | null // correção já conferida (lição); trava o grupo
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const answer = result ? item.options.indexOf(result.respostaCorreta) : -1
  // Posição tabulável do grupo: a marcada (ou a primeira).
  const tab = chosen ?? 0

  const altClass = (k: number) => {
    if (!result) return ''
    if (k === answer) return 'alt--ok'
    if (k === chosen) return 'alt--bad'
    return 'alt--off'
  }
  const altNote = (k: number) => {
    if (!result) return null
    if (k === answer)
      return (
        <span className="alt-note">
          <Icon name="check" />
          Resposta certa
        </span>
      )
    if (k === chosen)
      return (
        <span className="alt-note">
          <Icon name="x" />
          Sua resposta
        </span>
      )
    return null
  }

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, idx: number) => {
    const dir = DIRECOES[e.key]
    if (!dir) return
    e.preventDefault()
    const n = (idx + dir + item.options.length) % item.options.length
    refs.current[n]?.focus()
    onChoose(n) // setas movem e selecionam, como no front antigo
  }

  return (
    <div
      className="alts"
      role="radiogroup"
      aria-labelledby="ask"
      aria-disabled={result ? 'true' : undefined}
    >
      {item.options.map((o, k) => (
        <button
          key={k}
          ref={(b) => {
            refs.current[k] = b
          }}
          className={`alt ${altClass(k)}`.trim()}
          role="radio"
          aria-checked={chosen === k}
          disabled={!!result}
          tabIndex={result ? undefined : tab === k ? 0 : -1}
          onClick={() => onChoose(k)}
          onKeyDown={(e) => onKey(e, k)}
        >
          <span className="letter">{LETTERS[k]}</span>
          <span>
            <Tex>{o}</Tex>
            {altNote(k)}
          </span>
        </button>
      ))}
    </div>
  )
}
