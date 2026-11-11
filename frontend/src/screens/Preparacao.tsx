/* Meu aprendizado — dois estados para a pessoa: "Continue estudando" e
   "Você está preparado(a)" (só com domínio confirmado nos temas avaliados
   da matéria — nunca por tempo, percentual de acertos ou aprovação no
   Encceja, que tem outras áreas além das que estudamos aqui). */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ContinueBtn } from '../components/Progress'
import { Icon } from '../components/Icon'
import { Screen } from '../components/Screen'
import { NIVEIS, materiasDoNivel } from '../core/catalogo'
import {
  avaliarArea,
  linkDaAcao,
  proximaAcaoNivel,
  type AvaliacaoEstudo,
} from '../core/capturaAprendizagem'
import type { AcaoJornada } from '../core/aprendizagem/jornada'
import { avaliarEvolucao } from '../core/aprendizagem/evolucao'
import { useApp } from '../core/store'
import { urls } from '../core/urls'

export default function Preparacao() {
  const nivel = useApp((s) => s.nivel)
  const subjects = useApp((s) => s.subjects)
  const results = useApp((s) => s.results)
  const watched = useApp((s) => s.watched)
  const materias = materiasDoNivel(subjects, nivel)
  const chaves = materias.map((m) => m.id).join(',')
  const [avaliacoes, setAvaliacoes] = useState<
    Record<string, AvaliacaoEstudo | null>
  >({})
  const [acao, setAcao] = useState<AcaoJornada | null>(null)

  useEffect(() => {
    let ativo = true
    if (chaves) {
      void Promise.all(
        chaves
          .split(',')
          .map(async (id) => [id, await avaliarArea(id)] as const),
      ).then((entradas) => {
        if (ativo) setAvaliacoes(Object.fromEntries(entradas))
      })
      void proximaAcaoNivel(nivel).then((a) => {
        if (ativo) setAcao(a)
      })
    }
    return () => {
      ativo = false
    }
  }, [chaves, nivel, results, watched])
  const proxima = linkDaAcao(acao)

  return (
    <Screen cls="screen--nav" nav="preparacao">
      <h1 className="title">Meu aprendizado</h1>
      <p className="lede">
        Encceja: <strong>{(nivel && NIVEIS[nivel]?.nome) ?? ''}</strong>
      </p>

      {proxima && (
        <ContinueBtn
          to={proxima.href}
          kind={proxima.kind}
          titulo="Seu próximo estudo"
          sub={`${proxima.titulo} · ${proxima.sub}`}
        />
      )}

      <h2 className="section-label">Suas matérias</h2>
      {materias.map((materia) => {
        const evolucao = avaliarEvolucao(results, materia.id)
        const detalhes = avaliacoes[materia.id]?.preparacao.detalhes ?? []
        const confirmados = detalhes.filter(
          (d) => d.estado === 'dominio-confirmado',
        ).length
        // Preparado só quando TODO tema avaliável da matéria confirmou —
        // e mesmo assim o recado é escopado aos temas avaliados.
        const preparado = detalhes.length > 0 && confirmados === detalhes.length
        return (
          <section
            className="card preparo-materia"
            key={materia.id}
            aria-label={materia.name}
          >
            <div className="preparo-materia__cabecalho">
              <Icon name={materia.icon} />
              <div>
                <h3>{materia.name}</h3>
                <p
                  className={`preparo-estagio${preparado ? ' preparo-estagio--ok' : ''}`}
                >
                  {preparado ? 'Você está preparado(a)' : 'Continue estudando'}
                </p>
              </div>
            </div>
            {preparado ? (
              <p className="small">
                Nos temas avaliados desta matéria. A prova tem outros conteúdos.
              </p>
            ) : (
              evolucao.respondidas > 0 && (
                <p>
                  Você acertou{' '}
                  <strong>
                    {evolucao.acertos} de {evolucao.respondidas}
                  </strong>{' '}
                  questões nas últimas atividades.
                </p>
              )
            )}
            <Link className="btn btn--outline" to={urls.area(materia.id)}>
              <Icon name="book" />
              {preparado
                ? 'Rever os temas'
                : evolucao.respondidas > 0
                  ? 'Continuar estudando'
                  : 'Começar a estudar'}
            </Link>
          </section>
        )
      })}
      <p className="small preparo-rodape">
        A prova completa do Encceja tem outras áreas além destas matérias.
      </p>
    </Screen>
  )
}
