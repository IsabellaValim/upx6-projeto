/* ---------- Blocos de evolução antes/depois (Meu aprendizado + Resultado)
   O componente só desenha o que o comparador decidiu: comparação válida,
   resultados separados quando não dá para comparar, ou primeiro resultado.
   Textos aqui, num lugar só, para as duas telas contarem a mesma história. */
import type {
  EvolucaoTema,
  InterpretacaoEvolucao,
  MotivoNaoComparavel,
  RodadaAprendizagem,
} from '../core/aprendizagem/evolucao'
import { Bar } from './Progress'

const INTERPRETACAO_TEXTO: Record<InterpretacaoEvolucao, string> = {
  melhorou:
    'Você acertou mais questões — seu desempenho melhorou neste assunto.',
  manteve: 'Você manteve um bom desempenho.',
  continuar: 'Vamos continuar praticando este assunto.',
}

const MOTIVO_COMPARACAO_TEXTO: Record<MotivoNaoComparavel, string> = {
  'poucas-questoes': 'A última atividade foi curtinha demais para comparar.',
  'habilidades-distintas': 'As duas atividades medem habilidades diferentes.',
  'dificuldade-diferente': 'As questões desta vez eram mais difíceis.',
  'questoes-repetidas': 'As questões se repetiram — repetição não conta.',
  'familias-repetidas': 'As questões se repetiram — repetição não conta.',
}

function Placar({
  rotulo,
  r,
  destaque = false,
}: {
  rotulo: string
  r: RodadaAprendizagem
  destaque?: boolean
}) {
  return (
    <div className={destaque ? 'antes-depois--agora' : undefined}>
      <span>{rotulo}</span>
      <strong>
        {r.acertos} de {r.total}
      </strong>
      <Bar
        done={r.acertos}
        total={r.total}
        rotulo={`${rotulo}: ${r.acertos} de ${r.total} questões certas`}
      />
    </div>
  )
}

/* Corpo do cartão de evolução de UM tema. Assume que há ao menos uma
   rodada (e.referencia ?? e.ultima); fora disso devolve null. */
export function ComparacaoTema({ e }: { e: EvolucaoTema }) {
  if (e.comparavel && e.referencia && e.verificacao) {
    return (
      <>
        <div className="antes-depois">
          <Placar rotulo="Antes de estudar" r={e.referencia} />
          <Placar rotulo="Depois de estudar" r={e.verificacao} destaque />
        </div>
        <p className="evolucao-msg">{INTERPRETACAO_TEXTO[e.interpretacao!]}</p>
      </>
    )
  }
  if (e.referencia && e.ultima) {
    return (
      <>
        <div className="antes-depois">
          <Placar rotulo="Primeira atividade" r={e.referencia} />
          <Placar rotulo="Atividade mais recente" r={e.ultima} />
        </div>
        <p className="evolucao-msg">
          {MOTIVO_COMPARACAO_TEXTO[e.motivo!] ??
            'Ainda não dá para comparar essas atividades.'}
        </p>
      </>
    )
  }
  const r = e.referencia ?? e.ultima
  if (!r) return null
  return (
    <p>
      <strong>Seu primeiro resultado:</strong> você acertou {r.acertos} de{' '}
      {r.total} questões. Continue — na próxima atividade, questões novas medem
      sua evolução.
    </p>
  )
}
