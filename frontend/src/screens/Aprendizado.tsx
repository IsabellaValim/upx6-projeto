/* Meu aprendizado — a única tela de evolução, uma página por vez.
   Três coisas visíveis: como você estava x como está (comparação honesta
   por tema), o que você já conseguiu resolver e o próximo estudo.
   O antes/depois usa o comparador de evidências (questões e famílias
   inéditas, sem cola); domínio continua sendo critério do motor, em outra
   camada — aqui nunca se declara "tema concluído". */
import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { Screen } from '../components/Screen'
import { ContinueBtn, HistoryList, SubjectRow } from '../components/Progress'
import { ComparacaoTema } from '../components/Evolucao'
import { materiasDoNivel } from '../core/catalogo'
import {
  avaliarAprendizado,
  linkDaAcao,
  proximaAcaoNivel,
} from '../core/capturaAprendizagem'
import type { AprendizadoNivel } from '../core/capturaAprendizagem'
import type { AcaoJornada } from '../core/aprendizagem/jornada'
import {
  destaqueEvolucao,
  fraseEvolucao,
  tituloEvolucao,
} from '../core/aprendizagem/evolucao'
import { useApp } from '../core/store'
import { urls } from '../core/urls'
import type { CatalogSubject } from '../types'

function tituloHabilidade(
  subjects: Record<string, CatalogSubject>,
  disciplina: string,
  tema: string,
  slug: string,
): string {
  return (
    subjects[disciplina]?.topics
      .find((t) => t.slug === tema)
      ?.habilidades.find((h) => h.slug === slug)?.titulo ?? slug
  )
}

export default function Aprendizado() {
  const nivel = useApp((s) => s.nivel)
  const subjects = useApp((s) => s.subjects)
  const results = useApp((s) => s.results)
  const watched = useApp((s) => s.watched)
  const [dados, setDados] = useState<AprendizadoNivel | null>(null)
  const [acao, setAcao] = useState<AcaoJornada | null>(null)
  const [carregado, setCarregado] = useState(false)

  useEffect(() => {
    let vivo = true
    Promise.all([avaliarAprendizado(nivel), proximaAcaoNivel(nivel)]).then(
      ([a, ac]) => {
        if (!vivo) return
        setDados(a)
        setAcao(ac)
        setCarregado(true)
      },
    )
    return () => {
      vivo = false
    }
    // results.length: uma atividade nova concluída recarrega a evolução sem
    // sair da tela — o registro adaptativo já foi escrito durante a lição.
  }, [nivel, results.length])

  const destaque = dados?.destaque ?? null
  const materias = materiasDoNivel(subjects, nivel)
  const temaDestaque = destaque ? tituloEvolucao(subjects, destaque) : null
  const materiaDestaque = destaque
    ? (subjects[destaque.disciplina]?.name ?? destaque.disciplina)
    : null
  const consolidado =
    destaque && dados?.dominios[destaque.tema]?.estado === 'dominio-confirmado'

  // "O que você já conseguiu": no máximo 2 habilidades, começando pelo tema
  // em destaque e seguindo pelos temas mexidos mais recentemente.
  const conseguidas: string[] = []
  if (dados) {
    const ordenadas = [...dados.evolucoes].sort(
      (a, b) =>
        (b.rodadas[b.rodadas.length - 1]?.instante ?? 0) -
        (a.rodadas[a.rodadas.length - 1]?.instante ?? 0),
    )
    for (const e of ordenadas) {
      const boas = dados.boasPorTema[`${e.disciplina}/${e.tema}`] ?? []
      for (const slug of boas) {
        conseguidas.push(tituloHabilidade(subjects, e.disciplina, e.tema, slug))
        if (conseguidas.length === 2) break
      }
      if (conseguidas.length === 2) break
    }
  }

  const msgTopo = !carregado
    ? 'Carregando sua evolução…'
    : !destaque || !destaque.rodadas.length
      ? 'Responda algumas questões e sua evolução aparece aqui.'
      : destaque.comparavel
        ? destaque.interpretacao === 'melhorou'
          ? `Você melhorou seu desempenho em ${temaDestaque}!`
          : destaque.interpretacao === 'manteve'
            ? `Você manteve um bom desempenho em ${temaDestaque}.`
            : `Vamos continuar praticando ${temaDestaque}.`
        : 'Você começou seus estudos!'

  const aulasVistas = Object.keys(watched).length

  return (
    <Screen cls="screen--nav" nav="aprendizado">
      <header className="topbar">
        <h1>Meu aprendizado</h1>
      </header>
      <p className="aprendizado-msg" role="status">
        {msgTopo}
      </p>

      {carregado && destaque && (destaque.referencia ?? destaque.ultima) && (
        <section className="card antes-depois-card" aria-label="Antes e agora">
          <h2 className="card-title">
            {materiaDestaque} · {temaDestaque}
          </h2>
          <ComparacaoTema e={destaque} />
          {consolidado && (
            <p className="evolucao-msg">Você já consolidou este tema.</p>
          )}
        </section>
      )}

      {carregado && !destaque && (
        <div className="empty">
          <p>Responda algumas questões — sua evolução aparece aqui.</p>
        </div>
      )}

      {conseguidas.length > 0 && (
        <section aria-label="O que você já conseguiu">
          <h2 className="section-label">O que você já conseguiu</h2>
          <div className="card card--flush">
            {conseguidas.map((titulo) => (
              <div className="linha-boa" key={titulo}>
                <Icon name="check" />
                <span>{titulo}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {carregado && acao && (
        <section aria-label="Seu próximo estudo">
          <h2 className="section-label">Seu próximo estudo</h2>
          {(() => {
            const l = linkDaAcao(acao)
            return (
              l && (
                <ContinueBtn
                  to={l.href}
                  kind={l.kind}
                  titulo={l.titulo}
                  sub={l.sub}
                />
              )
            )
          })()}
        </section>
      )}

      <section aria-label="Outras matérias">
        <h2 className="section-label">Por matéria</h2>
        <div className="card card--flush">
          {materias.map((s) => {
            const ev =
              dados?.evolucoes.filter((e) => e.disciplina === s.id) ?? []
            const destaqueMateria = destaqueEvolucao(ev)
            return (
              <SubjectRow key={s.id} to={urls.area(s.id)} icon={s.icon}>
                <strong>{s.name}</strong>
                <small>{fraseEvolucao(subjects, destaqueMateria)}</small>
              </SubjectRow>
            )
          })}
        </div>
      </section>

      {results.length > 0 && (
        <details className="tip aprendizado-historico">
          <summary>Histórico de atividades</summary>
          <HistoryList limit={10} />
          {aulasVistas > 0 && (
            <p className="historico-aulas">
              {aulasVistas}{' '}
              {aulasVistas === 1 ? 'aula assistida' : 'aulas assistidas'}
            </p>
          )}
        </details>
      )}
    </Screen>
  )
}
