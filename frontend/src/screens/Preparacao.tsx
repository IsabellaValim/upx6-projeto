/* Minha preparação — feedback com dados reais da primeira atividade.
   Nunca equiparar percentual de acertos a domínio ou aprovação no Encceja. */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { Screen } from '../components/Screen'
import { NIVEIS, materiasDoNivel } from '../core/catalogo'
import { avaliarArea, type AvaliacaoEstudo } from '../core/capturaAprendizagem'
import { avaliarEvolucao } from '../core/aprendizagem/evolucao'
import { useApp } from '../core/store'
import { urls } from '../core/urls'

export default function Preparacao() {
  const nivel = useApp((s) => s.nivel)
  const subjects = useApp((s) => s.subjects)
  const results = useApp((s) => s.results)
  const materias = materiasDoNivel(subjects, nivel)
  const chaves = materias.map((m) => m.id).join(',')
  const [avaliacoes, setAvaliacoes] = useState<
    Record<string, AvaliacaoEstudo | null>
  >({})

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
    }
    return () => {
      ativo = false
    }
  }, [chaves, results])

  return (
    <Screen cls="screen--nav" nav="preparacao">
      <h1 className="title">Minha preparação</h1>
      <p className="lede">
        Encceja: <strong>{(nivel && NIVEIS[nivel]?.nome) ?? ''}</strong>
      </p>

      <section className="card" aria-labelledby="preparo-exame">
        <h2 id="preparo-exame">Estou pronto(a) para o Encceja?</h2>
        <p className="preparo-resposta">Ainda não dá para saber.</p>
        <p className="small">
          A prova tem outras áreas além das que estudamos aqui.
        </p>
      </section>

      <h2 className="section-label">Suas matérias</h2>
      {materias.map((materia) => {
        const evolucao = avaliarEvolucao(results, materia.id)
        const consolidados = Object.values(
          avaliacoes[materia.id]?.dominios ?? {},
        ).filter((d) => d.estado === 'dominio-confirmado').length
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
                <p className="preparo-estagio">{evolucao.rotulo}</p>
              </div>
            </div>
            {evolucao.respondidas > 0 && (
              <p>
                Você acertou{' '}
                <strong>
                  {evolucao.acertos} de {evolucao.respondidas}
                </strong>{' '}
                questões nas últimas atividades.
              </p>
            )}
            {consolidados > 0 && (
              <p className="small">
                {consolidados}{' '}
                {consolidados === 1 ? 'tema consolidado' : 'temas consolidados'}
                .
              </p>
            )}
            <Link className="btn btn--outline" to={urls.area(materia.id)}>
              <Icon name="book" />
              {evolucao.respondidas > 0
                ? 'Continuar estudando'
                : 'Começar a estudar'}
            </Link>
          </section>
        )
      })}
      <p className="small preparo-rodape">
        Estude no seu ritmo — cada resposta já ajuda.
      </p>
    </Screen>
  )
}
