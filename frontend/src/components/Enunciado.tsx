/* ==========================================================
   Enunciado da questão (lição e simulado) — port do questao.js.
   Ordem pensada para o celular: ouvir primeiro, a imagem em
   largura total, o texto de apoio num cartão, a pergunta em
   destaque e a fonte por último.
   ========================================================== */
import { useState } from 'react'
import { fonte } from '../core/catalogo'
import type { QuestaoItem } from '../types'
import { Icon } from './Icon'
import { ImageViewer } from './ImageViewer'
import { Tex } from './Tex'

export function Enunciado({ item, onOuvir }: { item: QuestaoItem; onOuvir: () => void }) {
  const [ampliada, setAmpliada] = useState(false)
  const img = item.imagem
  return (
    <>
      <button type="button" className="btn btn--soft q-ouvir" id="listen" onClick={onOuvir}>
        <Icon name="volume" />
        Ouvir questão
      </button>
      {img?.url && (
        <figure className="q-figure">
          <button
            type="button"
            className="q-figure__abrir"
            onClick={() => setAmpliada(true)}
            aria-label={`Ampliar imagem em tela cheia. ${img.descricao || ''}`}
          >
            {/* url vem relativa da API ("conteudo/imagens/..."): "/" + url
                resolve na mesma origem (proxy do Vite em dev). */}
            <img src={'/' + img.url} alt="" loading="lazy" />
            <span className="q-figure__dica" aria-hidden="true">
              <Icon name="search" />
              Toque para ampliar
            </span>
          </button>
          <figcaption className="sr-only">{img.descricao || 'Imagem da questão'}</figcaption>
        </figure>
      )}
      {item.text && (
        <section className="q-apoio" aria-label="Texto de apoio">
          <p>
            <Tex>{item.text}</Tex>
          </p>
        </section>
      )}
      <p className="q-pergunta" id="ask">
        <Tex>{item.ask}</Tex>
      </p>
      <p className="q-fonte">{fonte(item.prova)}</p>
      {ampliada && img?.url && (
        <ImageViewer
          src={'/' + img.url}
          alt={img.descricao}
          onClose={() => setAmpliada(false)}
        />
      )}
    </>
  )
}
