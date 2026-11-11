/* ==========================================================
   Progresso e listas por matéria (port do progress.js)
   ========================================================== */
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../core/store'
import { resultadosDaProva } from '../core/stats'
import { formatDay, pct } from '../core/utils'
import { urls } from '../core/urls'
import { Icon } from './Icon'

export function Bar({
  done,
  total,
  rotulo,
}: {
  done: number
  total: number
  rotulo: string
}) {
  return (
    <div
      className="bar"
      role="progressbar"
      aria-label={rotulo}
      aria-valuenow={done}
      aria-valuemin={0}
      aria-valuemax={total}
    >
      <i style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
    </div>
  )
}

// "Continuar estudando": Início, Área e Progresso usam a mesma cara.
export function ContinueBtn({
  to,
  kind,
  titulo,
  sub,
}: {
  to: string
  kind: 'aula' | 'pratica'
  titulo: string
  sub: string
}) {
  return (
    <Link className="continue-btn" to={to}>
      <Icon name={kind === 'aula' ? 'playCircle' : 'checkSquare'} />
      <span>
        <strong>{titulo}</strong>
        <small>{sub}</small>
      </span>
      <Icon name="chevronRight" cls="chev" />
    </Link>
  )
}

// Linha de lista de matéria/opção. Com `to` vira link; com `onClick`, botão.
export function SubjectRow({
  to,
  onClick,
  icon,
  className = '',
  ariaCurrent,
  children,
}: {
  to?: string
  onClick?: () => void
  icon: string
  className?: string
  ariaCurrent?: boolean
  children: ReactNode // conteúdo do <span> central
}) {
  const conteudo = (
    <>
      <Icon name={icon} />
      <span>{children}</span>
      <Icon name="chevronRight" cls="chev" />
    </>
  )
  const cls = `subject-row ${className}`.trim()
  const aria = { 'aria-current': ariaCurrent ? ('true' as const) : undefined }
  return to ? (
    <Link className={cls} to={to} {...aria}>
      {conteudo}
    </Link>
  ) : (
    <button type="button" className={cls} onClick={onClick} {...aria}>
      {conteudo}
    </button>
  )
}

// Últimas lições e simulados (só da prova escolhida).
export function HistoryList({ limit }: { limit: number }) {
  const nivel = useApp((s) => s.nivel)
  const subjects = useApp((s) => s.subjects)
  const list = resultadosDaProva(nivel).slice(0, limit)
  return (
    <div className="history">
      {list.map((r) => {
        const s = subjects[r.subject]
        const p = pct(r.correct, r.total)
        const good = p >= 60
        // Lição por tema (v: 3) mostra o tema; quiz antigo, da matéria inteira, não tem.
        const label =
          r.kind === 'simulado'
            ? 'Simulado'
            : r.topic !== undefined
              ? (s.topics[r.topic]?.title ?? 'Tema')
              : 'Todos os temas'
        return (
          <Link
            className={`history-item ${good ? 'ok' : 'bad'}`}
            to={urls.resultado(r.i)}
            key={r.i}
          >
            <span className="badge">
              <Icon name={good ? 'check' : 'x'} />
            </span>
            <span>
              <strong>
                {s.name} — {label}
              </strong>
              <small>
                {formatDay(r.date)} · {r.correct} de {r.total} certas
              </small>
            </span>
            <span className="pct">{p}%</span>
          </Link>
        )
      })}
    </div>
  )
}

// As linhas "X de Y atividades" por matéria saíram de uso: contavam tarefa
// concluída, não aprendizagem. A evolução real por tema fica na tela
// Meu aprendizado (comparador antes/depois sobre evidências confiáveis).
