/* Início: logo, a próxima ação da jornada guiada (o orquestrador decide),
   estudar por matéria e testar com o simulado */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ContinueBtn, SubjectRow } from '../components/Progress'
import { Screen } from '../components/Screen'
import {
  avaliarAprendizado,
  linkDaAcao,
  proximaAcaoNivel,
} from '../core/capturaAprendizagem'
import type { AprendizadoNivel } from '../core/capturaAprendizagem'
import type { AcaoJornada } from '../core/aprendizagem/jornada'
import { NIVEIS, materiasDoNivel } from '../core/catalogo'
import { useApp } from '../core/store'
import { nextActivity } from '../core/stats'
import { urls } from '../core/urls'

export default function Home() {
  const user = useApp((s) => s.user)! // a guarda RequireUser garante
  const nivel = useApp((s) => s.nivel)
  const subjects = useApp((s) => s.subjects)
  const results = useApp((s) => s.results)
  const watched = useApp((s) => s.watched)

  const first = user.guest ? '' : user.name.split(' ')[0]
  const materias = materiasDoNivel(subjects, nivel)

  // Matéria estudada por último: a da lição/simulado mais recente ou da
  // última aula marcada, só da prova escolhida.
  const quando: Record<string, number> = {}
  for (const r of results)
    quando[r.subject] = Math.max(quando[r.subject] ?? 0, r.date)
  for (const [k, ts] of Object.entries(watched)) {
    const id = k.split('/')[0]
    quando[id] = Math.max(quando[id] ?? 0, ts)
  }
  const ultima = Object.keys(quando)
    .filter((id) => subjects[id]?.nivel === nivel)
    .sort((a, b) => quando[b] - quando[a])[0]
  const next = ultima ? nextActivity(ultima) : null

  // Ação única: o orquestrador decide a próxima coisa certa agora
  // (diagnóstico, aula, prática dirigida, verificação, revisão ou simulado).
  const idsMaterias = materias.map((m) => m.id).join(',')
  const [acao, setAcao] = useState<{ k: string; a: AcaoJornada | null } | null>(
    null,
  )
  useEffect(() => {
    let ativo = true
    if (!idsMaterias) return
    void proximaAcaoNivel(nivel).then((a) => {
      if (ativo) setAcao({ k: idsMaterias, a })
    })
    return () => {
      ativo = false
    }
    // results/watched mudam junto com o estudo; a ação reflete o estado novo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsMaterias, nivel, results, watched])
  const jornada = acao?.k === idsMaterias ? linkDaAcao(acao.a) : null
  // % de aprendizado sob cada matéria (o motor, não o contador de atividades).
  const [dados, setDados] = useState<AprendizadoNivel | null>(null)
  useEffect(() => {
    let ativo = true
    void avaliarAprendizado(nivel).then((a) => {
      if (ativo) setDados(a)
    })
    return () => {
      ativo = false
    }
  }, [nivel, results.length])
  const proxima =
    jornada ??
    (next && ultima
      ? {
          href: next.href,
          kind: next.kind,
          titulo: 'Continuar estudando',
          sub: `${subjects[ultima].name} · ${next.titulo}`,
        }
      : null)

  return (
    <Screen cls="screen--nav" nav="inicio">
      <img
        className="brand-logo"
        src="/branding/logo-primary.svg"
        alt="Estudaê"
      />
      <h1 className="title home-greeting">
        {first ? `Olá, ${first}! Vamos estudar?` : 'Olá! Vamos estudar?'}
      </h1>
      <p className="lede">
        Prova do Encceja:{' '}
        <strong>{(nivel && NIVEIS[nivel]?.nome) ?? ''}</strong> ·{' '}
        <Link className="link" to={urls.nivel}>
          Trocar
        </Link>
      </p>
      {proxima && (
        <ContinueBtn
          to={proxima.href}
          kind={proxima.kind}
          titulo={proxima.titulo}
          sub={proxima.sub}
        />
      )}
      <h2 className="section-label">Estudar por matéria</h2>
      {materias.length ? (
        <div className="subject-list">
          {materias.map((s) => {
            const pct = dados?.pctPorMateria[s.id]
            return (
              <SubjectRow key={s.id} to={urls.area(s.id)} icon={s.icon}>
                <strong>{s.name}</strong>
                <small>
                  {!pct ? 'Ainda não começou.' : `${pct}% de aprendizado`}
                </small>
                <span className="mini-bar" aria-hidden="true">
                  <i style={{ width: `${pct ?? 0}%` }} />
                </span>
              </SubjectRow>
            )
          })}
        </div>
      ) : (
        <div className="empty">
          <p>Ainda não há matérias disponíveis. Volte mais tarde.</p>
        </div>
      )}
      {materias.length > 0 && (
        <>
          <h2 className="section-label">Testar o que aprendeu</h2>
          <SubjectRow
            to={urls.simulado()}
            icon="clock"
            className="subject-row--sim"
          >
            <strong>Simulado</strong>
            <small>Como no dia da prova, com tempo e resultado no fim.</small>
          </SubjectRow>
        </>
      )}
    </Screen>
  )
}
