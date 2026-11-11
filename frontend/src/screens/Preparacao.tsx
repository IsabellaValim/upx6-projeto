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
  const [avaliacoes, setAvaliacoes] = useState<Record<string, AvaliacaoEstudo | null>>({})

  useEffect(() => {
    let ativo = true
    if (chaves) {
      void Promise.all(
        chaves.split(',').map(async (id) => [id, await avaliarArea(id)] as const),
      ).then((entradas) => {
        if (ativo) setAvaliacoes(Object.fromEntries(entradas))
      })
    }
    return () => { ativo = false }
  }, [chaves, results])

  const hoje = new Date().toDateString()
  const atividadesHoje = results.filter(
    (r) =>
      subjects[r.subject]?.nivel === nivel &&
      new Date(r.date).toDateString() === hoje &&
      Number.isSafeInteger(r.total) && r.total > 0 &&
      Number.isSafeInteger(r.correct) && r.correct >= 0 && r.correct <= r.total,
  )
  const respondidasHoje = atividadesHoje.reduce((s, r) => s + r.total, 0)
  const acertosHoje = atividadesHoje.reduce((s, r) => s + r.correct, 0)

  return (
    <Screen cls="screen--nav" nav="preparacao">
      <h1 className="title">Minha preparação</h1>
      <p className="lede">
        Encceja: <strong>{(nivel && NIVEIS[nivel]?.nome) ?? ''}</strong>
      </p>

      <section className="card" aria-labelledby="preparo-exame">
        <h2 id="preparo-exame">Estou pronto(a) para o Encceja?</h2>
        <p className="preparo-resposta">
          Ainda não é possível confirmar a preparação para a prova inteira.
        </p>
        <p className="small">
          O Estudaê ainda acompanha Matemática e Linguagens. Outras áreas
          e a redação também fazem parte do Encceja. Os resultados abaixo
          mostram sua evolução, mas não garantem aprovação.
        </p>
      </section>

      <section className="card" aria-labelledby="preparo-hoje">
        <h2 id="preparo-hoje">Seu estudo de hoje</h2>
        {respondidasHoje > 0 ? (
          <p>
            Você respondeu <strong>{respondidasHoje}</strong> questões e
            acertou <strong>{acertosHoje}</strong>. Isso ajuda a escolher
            o que praticar depois.
          </p>
        ) : (
          <p>Você ainda não respondeu questões hoje. Pode começar com uma atividade curta.</p>
        )}
        <p className="small">Atividades concluídas neste navegador.</p>
      </section>

      <h2 className="section-label">Como você está em cada matéria</h2>
      {materias.map((materia) => {
        const evolucao = avaliarEvolucao(results, materia.id)
        const avaliacao = avaliacoes[materia.id]
        const consolidados = Object.values(avaliacao?.dominios ?? {}).filter(
          (d) => d.estado === 'dominio-confirmado',
        ).length
        return (
          <section className="card preparo-materia" key={materia.id} aria-label={materia.name}>
            <div className="preparo-materia__cabecalho">
              <Icon name={materia.icon} />
              <div>
                <h3>{materia.name}</h3>
                <p className="preparo-estagio">{evolucao.rotulo}</p>
              </div>
            </div>
            {evolucao.respondidas > 0 ? (
              <p>
                Nas últimas {evolucao.atividades} atividades, você acertou{' '}
                <strong>{evolucao.acertos} de {evolucao.respondidas}</strong> questões.
                {' '}{evolucao.mensagem}
              </p>
            ) : (
              <p>Ainda não temos respostas suficientes para acompanhar esta matéria.</p>
            )}
            {consolidados > 0 && (
              <p className="small">
                {consolidados} {consolidados === 1
                  ? 'tema com domínio confirmado'
                  : 'temas com domínio confirmado'}.
              </p>
            )}
            <Link className="btn btn--outline" to={urls.area(materia.id)}>
              <Icon name="book" />
              {evolucao.respondidas > 0 ? 'Continuar estudando' : 'Começar a estudar'}
            </Link>
          </section>
        )
      })}
      <p className="small preparo-rodape">
        Você pode estudar no seu ritmo. Não precisa resolver todas as questões
        do banco para avançar. O domínio confirmado exige questões revisadas
        e verificação posterior.
      </p>
    </Screen>
  )
}
