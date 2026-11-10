/* Escolha da prova (Ensino Fundamental ou Médio). Aparece uma vez;
   dá para trocar no Perfil. */
import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { BackBtn } from '../components/Nav'
import { SubjectRow } from '../components/Progress'
import { Screen } from '../components/Screen'
import { NIVEIS, materiasDoNivel } from '../core/catalogo'
import { useApp } from '../core/store'
import { toast } from '../core/toast'
import type { Nivel as NivelId } from '../types'
import { urls } from '../core/urls'

export default function Nivel() {
  const nivel = useApp((s) => s.nivel)
  const setNivel = useApp((s) => s.setNivel)
  const subjects = useApp((s) => s.subjects)
  const navigate = useNavigate()
  const trocando = !!nivel

  const escolher = (id: NivelId) => {
    const mudou = nivel !== id
    setNivel(id)
    if (mudou && trocando) toast(`Prova trocada para ${NIVEIS[id].nome}`)
    navigate(urls.home)
  }

  return (
    <Screen cls={trocando ? 'screen--nav' : ''} nav={trocando ? 'perfil' : undefined}>
      {trocando ? (
        <div className="topbar">
          <BackBtn to={urls.home} />
        </div>
      ) : (
        <img className="brand-logo" src="/branding/logo-primary.svg" alt="Estudaê" />
      )}
      <h1 className="title" style={{ marginTop: '1.25rem' }}>
        Qual prova do Encceja você vai fazer?
      </h1>
      <p className="lede">
        Assim mostramos as matérias e questões certas para você. Dá para trocar depois, no
        seu perfil.
      </p>
      <div className="subject-list" style={{ marginTop: '1.25rem' }}>
        {(Object.entries(NIVEIS) as [NivelId, (typeof NIVEIS)[NivelId]][]).map(([id, n]) => {
          const materias = materiasDoNivel(subjects, id)
            .map((s) => s.name)
            .join(' e ')
          const atual = nivel === id
          return (
            <SubjectRow
              key={id}
              icon={id === 'medio' ? 'book' : 'pen'}
              className={`level-option ${atual ? 'is-current' : ''}`}
              ariaCurrent={atual}
              onClick={() => escolher(id)}
            >
              <strong>{n.nome}</strong>
              <small>
                {n.sobre}
                {materias ? ` ${materias}.` : ''}
              </small>
              {atual && (
                <small className="level-current">
                  <Icon name="check" />
                  Sua prova atual
                </small>
              )}
            </SubjectRow>
          )
        })}
      </div>
    </Screen>
  )
}
