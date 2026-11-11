/* Atividade concluída — o fim de uma lição ou simulado.
   O placar da atividade fica pequeno (é só um registro); o protagonista é
   a evolução do tema quando o comparador tem duas rodadas para parear, e
   o próximo passo vem do orquestrador, não da nota. Nada aqui declara
   "tema concluído": concluída é a ATIVIDADE — domínio é critério do motor. */
import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { Screen } from '../components/Screen'
import { Tex } from '../components/Tex'
import { ComparacaoTema } from '../components/Evolucao'
import {
  ESTADO_TEXTO,
  avaliarAprendizado,
  linkDaAcao,
  proximaAcaoNivel,
} from '../core/capturaAprendizagem'
import type { AcaoJornada } from '../core/aprendizagem/jornada'
import type { EvolucaoTema } from '../core/aprendizagem/evolucao'
import { PARAMETROS_DOMINIO } from '../core/aprendizagem/config'
import { useApp } from '../core/store'
import { LETTERS } from '../core/utils'
import { urls } from '../core/urls'

const minutos = (ms: number) => Math.max(1, Math.round(ms / 60000))

export default function Resultado() {
  const { idx = '0' } = useParams()
  const results = useApp((s) => s.results)
  const subjects = useApp((s) => s.subjects)
  const nivel = useApp((s) => s.nivel)

  const r = results[+idx]
  const s = r && subjects[r.subject]
  const tema =
    r && s && r.topic !== undefined && r.kind !== 'simulado'
      ? s.topics[r.topic]
      : null
  const sim = r?.kind === 'simulado'
  const fraco = sim && s && r.weakTopic !== null ? s.topics[r.weakTopic!] : null
  // Tema da evolução exibida: o da lição; no simulado, o que mais errou.
  const temaEvolucao = tema ?? fraco

  const [estagio, setEstagio] = useState<string | null>(null)
  const [evolucao, setEvolucao] = useState<EvolucaoTema | null>(null)
  const [acao, setAcao] = useState<AcaoJornada | null>(null)

  useEffect(() => {
    if (!r || !s) return
    let ativo = true
    void proximaAcaoNivel(nivel).then((a) => {
      if (ativo) setAcao(a)
    })
    void avaliarAprendizado(nivel).then((a) => {
      if (!ativo || !a) return
      if (temaEvolucao) {
        const e = a.evolucoes.find(
          (e) => e.disciplina === r.subject && e.tema === temaEvolucao.slug,
        )
        if (e && (e.referencia ?? e.ultima)) setEvolucao(e)
        const d = a.dominios[temaEvolucao.slug]
        if (d)
          setEstagio(
            d.estado === 'em-pratica'
              ? `${ESTADO_TEXTO[d.estado]} · ${d.janela.length} de ${PARAMETROS_DOMINIO.boaMin} boas práticas`
              : ESTADO_TEXTO[d.estado],
          )
      }
    })
    return () => {
      ativo = false
    }
    // A matéria/tema do resultado é estável por montagem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, nivel])
  const proxima = linkDaAcao(acao)

  if (!r || !s) return <Navigate to={urls.aprendizado} replace />

  const perfeito = r.correct === r.total
  const msg = perfeito
    ? 'Você acertou todas as questões. Excelente trabalho!'
    : sim && fraco
      ? `O tema com mais erros foi “${fraco.title}”.`
      : r.correct === 0
        ? 'Não desanime — cada erro mostra o que estudar em seguida.'
        : null

  return (
    <Screen cls="screen--nav" nav="aprendizado">
      <div className="topbar topbar--split result-head">
        <div>
          <h1>{sim ? 'Simulado concluído' : 'Atividade concluída'}</h1>
          <p className="kicker">
            {s.name}
            {tema ? ' · ' + tema.title : ''}
          </p>
        </div>
        <Link className="icon-btn" to={urls.home} aria-label="Fechar resultado">
          <Icon name="xBox" />
        </Link>
      </div>
      <div className="stats">
        <div className="stat stat--ok">
          <strong>{r.correct}</strong>
          <span>Acertos</span>
        </div>
        <div className="stat stat--bad">
          <strong>{r.total - r.correct}</strong>
          <span>Erros</span>
        </div>
        <div className="stat">
          <strong>{r.total}</strong>
          <span>Questões</span>
        </div>
      </div>
      {msg && (
        <p className="small center" style={{ marginTop: '.75rem' }}>
          {msg}
        </p>
      )}
      {sim && (
        <p className="small center" style={{ marginTop: '.5rem' }}>
          <Icon name="clock" /> Tempo usado: {minutos(r.usedMs!)} de{' '}
          {minutos(r.limitMs!)} minutos
          {r.treino ? ' · simulado de treino com questões autorais' : ''}
        </p>
      )}
      {evolucao && (
        <section
          className="card"
          style={{ marginTop: '1.25rem' }}
          aria-label={`Como você evoluiu em ${temaEvolucao!.title}`}
        >
          <h2 className="card-title">Como você evoluiu neste assunto</h2>
          <ComparacaoTema e={evolucao} />
        </section>
      )}
      {estagio && (
        <p className="small center result-estagio">
          Neste tema você está: <strong>{estagio}</strong>
        </p>
      )}
      {/* Correção sempre recolhida (no simulado são até 30 itens: aberta
          viraria uma parede). O título já conta quantas questões erraram. */}
      <details className="review">
        <summary>
          {perfeito
            ? 'Ver a correção das questões'
            : `Correção das questões — ${r.total - r.correct} errada${r.total - r.correct > 1 ? 's' : ''}`}
        </summary>
        {r.items.map((x, k) => (
          // A correção (resposta certa e explicação) veio da API e foi guardada no resultado.
          <div className={`review-item ${x.ok ? 'ok' : 'bad'}`} key={k}>
            <p>
              <span className="mark">{x.ok ? 'Acertou' : 'Errou'}</span> —{' '}
              {k + 1}. <Tex>{x.ask}</Tex>
            </p>
            <p>
              Resposta certa: {LETTERS[x.answer]}){' '}
              <Tex>{x.options[x.answer]}</Tex>
              {!x.ok && x.chosen !== undefined
                ? ` · Você marcou ${LETTERS[x.chosen]}`
                : ''}
            </p>
            <p>
              <Tex>{x.why}</Tex>
            </p>
          </div>
        ))}
      </details>
      {/* Um único CTA primário: a próxima ação da jornada decidida pelo
          orquestrador a partir do estado que esta sessão deixou. Sem motor
          (ou sem caminho), o par simples de sempre continua disponível. */}
      {proxima ? (
        <Link
          className="btn btn--primary"
          style={{ marginTop: '1rem' }}
          to={proxima.href}
        >
          {proxima.titulo} — {proxima.sub}
        </Link>
      ) : sim ? (
        <Link
          className="btn btn--primary"
          style={{ marginTop: '1rem' }}
          to={urls.area(r.subject)}
        >
          Estudar os temas
        </Link>
      ) : (
        <Link
          className="btn btn--primary"
          style={{ marginTop: '1rem' }}
          to={urls.quiz(r.subject, r.topic!)}
        >
          Praticar de novo
        </Link>
      )}
      <Link
        className="btn btn--outline"
        style={{ marginTop: '.75rem' }}
        to={urls.aprendizado}
      >
        Ver meu aprendizado
      </Link>
      <p className="small center" style={{ marginTop: '1rem' }}>
        Sua evolução fica registrada em Meu aprendizado.
      </p>
    </Screen>
  )
}
