/* Acessibilidade */
import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { Screen } from '../components/Screen'
import { SwitchRow } from '../components/Switch'
import { speak } from '../core/speech'
import { useApp } from '../core/store'
import { toast } from '../core/toast'
import type { A11y, FontSize } from '../types'
import { urls } from '../core/urls'

const SIZES: [FontSize, string][] = [
  ['padrao', 'Padrão'],
  ['grande', 'Grande'],
  ['extragrande', 'Extragrande'],
]

const ROWS: [keyof Omit<A11y, 'font'>, string, string, string][] = [
  [
    'contrast',
    'contrast',
    'Alto contraste',
    'Cores mais fortes e fundo mais claro.',
  ],
  [
    'speak',
    'volume',
    'Ler questões em voz alta',
    'Ouça o enunciado e as alternativas automaticamente.',
  ],
  [
    'motion',
    'zap',
    'Reduzir animações',
    'Telas trocam sem efeitos de movimento.',
  ],
]

export default function Acessibilidade() {
  const a11y = useApp((s) => s.a11y)
  const setA11y = useApp((s) => s.setA11y)
  const navigate = useNavigate()

  // Voltar para onde a pessoa estava (o Perfil ou a aula): o histórico,
  // como no front antigo; fallback para o Perfil se entrou direto.
  const voltar = () =>
    window.history.length > 1 ? navigate(-1) : navigate(urls.perfil)

  return (
    <Screen cls="screen--nav" nav="perfil">
      <div className="topbar topbar--split">
        <button
          className="icon-btn icon-btn--solid"
          id="back"
          aria-label="Voltar"
          onClick={voltar}
        >
          <Icon name="arrowLeft" />
        </button>
        <h1>Acessibilidade</h1>
        <span style={{ width: '2.25rem' }} />
      </div>
      <h2 className="section-label" style={{ marginTop: '.5rem' }}>
        Tamanho do texto
      </h2>
      <div className="size-picker" role="group" aria-label="Tamanho do texto">
        {SIZES.map(([v, l]) => (
          <button
            key={v}
            aria-pressed={a11y.font === v}
            aria-label={l}
            onClick={() => setA11y({ font: v })}
          >
            A
          </button>
        ))}
      </div>
      <p className="small" style={{ marginTop: '.5rem' }} id="size-desc">
        Atual: {SIZES.find((s) => s[0] === a11y.font)?.[1] ?? 'Grande'}
      </p>
      <h2 className="section-label">Leitura e contraste</h2>
      <div className="card card--flush">
        {ROWS.map(([k, ic, titulo, desc]) => (
          <SwitchRow
            key={k}
            ic={ic}
            rotuloId={`lbl-${k}`}
            titulo={titulo}
            desc={desc}
            checked={a11y[k]}
            onToggle={() => {
              setA11y({ [k]: !a11y[k] })
              if (k === 'speak' && !a11y.speak)
                speak('Leitura em voz alta ativada.')
            }}
          />
        ))}
      </div>
      <button
        className="btn btn--primary"
        style={{ marginTop: '1.5rem' }}
        id="confirm"
        onClick={() => {
          toast('Preferências salvas')
          voltar()
        }}
      >
        Confirmar e voltar
      </button>
    </Screen>
  )
}
