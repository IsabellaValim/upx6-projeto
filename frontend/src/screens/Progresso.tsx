/* Progresso: resumo da prova escolhida, cada matéria e as últimas lições/simulados */
import { Link } from 'react-router-dom'
import { Bar, ContinueBtn, HistoryList, SubjectStats } from '../components/Progress'
import { Screen } from '../components/Screen'
import { NIVEIS, materiasDoNivel } from '../core/catalogo'
import { useApp } from '../core/store'
import { nextActivity, resultadosDaProva, streakDays, subjectProgress } from '../core/stats'
import { pct } from '../core/utils'
import { urls } from '../core/urls'

export default function Progresso() {
  const nivel = useApp((s) => s.nivel)
  const subjects = useApp((s) => s.subjects)
  // Assina results/watched para a tela refletir na hora.
  useApp((s) => s.results)
  useApp((s) => s.watched)

  const materias = materiasDoNivel(subjects, nivel)
  const geral = materias.reduce(
    (acc, s) => {
      const p = subjectProgress(s.id)
      return { done: acc.done + p.done, total: acc.total + p.total }
    },
    { done: 0, total: 0 },
  )
  const resultados = resultadosDaProva(nivel)
  const certas = resultados.reduce((s, r) => s + r.correct, 0)
  const respondidas = resultados.reduce((s, r) => s + r.total, 0)
  const dias = streakDays()
  // "Continuar": primeiro a matéria estudada por último (como no início), depois as outras.
  const ultima = resultados[0]?.subject
  const ordem = [...materias].sort((a, b) => Number(b.id === ultima) - Number(a.id === ultima))
  const next = ordem.map((s) => ({ s, n: nextActivity(s.id) })).find((x) => x.n)

  const destaque = (valor: string | number, rotulo: string) => (
    <div className="stat" key={rotulo}>
      <strong>{valor}</strong>
      <span>{rotulo}</span>
    </div>
  )

  return (
    <Screen cls="screen--nav" nav="progresso">
      <h1 className="title">Seu progresso</h1>
      <p className="lede">
        Prova: <strong>{(nivel && NIVEIS[nivel]?.nome) ?? ''}</strong> ·{' '}
        <Link className="link" to={urls.nivel}>
          Trocar
        </Link>
      </p>

      <section className="card progress-card" aria-labelledby="resumo">
        <h2 id="resumo">Atividades concluídas</h2>
        <p>
          <strong>{geral.done}</strong> de {geral.total}
        </p>
        <Bar done={geral.done} total={geral.total} rotulo="Atividades concluídas na prova" />
        <div className="stats" style={{ marginTop: '1rem' }}>
          {destaque(dias, dias === 1 ? 'dia seguido' : 'dias seguidos')}
          {destaque(
            resultados.length,
            resultados.length === 1 ? 'lição ou simulado' : 'lições e simulados',
          )}
          {destaque(respondidas ? pct(certas, respondidas) + '%' : '—', 'de acertos')}
        </div>
      </section>

      {next && (
        <ContinueBtn
          to={next.n!.href}
          kind={next.n!.kind}
          titulo="Continuar estudando"
          sub={`${next.s.name} · ${next.n!.titulo}`}
        />
      )}

      <h2 className="section-label">Por matéria</h2>
      <div className="card">
        <SubjectStats />
      </div>

      <h2 className="section-label">Últimas lições e simulados</h2>
      {resultados.length ? (
        <HistoryList limit={10} />
      ) : (
        <div className="empty">
          <p>Quando você praticar um tema ou fizer um simulado, o resultado aparece aqui.</p>
          <Link className="btn btn--primary btn--sm" to={urls.home}>
            Escolher um tema
          </Link>
        </div>
      )}
    </Screen>
  )
}
