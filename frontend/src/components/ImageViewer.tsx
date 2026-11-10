/* ==========================================================
   Imagem em tela cheia (<dialog> nativo) — port do visualizador
   de questao.js: prende o foco, fecha com Esc, é anunciado como
   janela e o voltar do celular também fecha (a abertura empilha
   uma entrada no histórico, sem mudar a rota).
   ========================================================== */
import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'

const ZOOM = [1, 1.5, 2, 3]

export function ImageViewer({
  src,
  alt,
  onClose,
}: {
  src: string
  alt: string
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [nivel, setNivel] = useState(0)

  useEffect(() => {
    const d = ref.current!
    history.pushState({ visualizador: true }, '')
    d.showModal()
    const onPop = () => d.close()
    window.addEventListener('popstate', onPop)
    d.querySelector<HTMLElement>('[data-fechar]')?.focus()
    return () => {
      window.removeEventListener('popstate', onPop)
      if (d.open) d.close()
    }
    // Montar = abrir; desmontar = fechar (o pai some com o componente).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // O 'close' do <dialog> é o ponto único de saída: Esc, botão Fechar e o
  // voltar (via popstate → close) caem aqui. Se a entrada que empilhamos
  // ainda está no topo, desempilha com history.back().
  const handleClose = () => {
    if (window.history.state?.visualizador) window.history.back()
    onClose()
  }

  return (
    <dialog
      ref={ref}
      className="visualizador"
      aria-label="Imagem da questão em tela cheia"
      onClose={handleClose}
    >
      <div className="visualizador__barra">
        <button
          type="button"
          className="visualizador__btn"
          aria-label="Diminuir"
          disabled={nivel === 0}
          onClick={() => setNivel((n) => Math.max(0, n - 1))}
        >
          <Icon name="minus" />
        </button>
        <span className="visualizador__nivel" aria-live="polite">
          {ZOOM[nivel] * 100}%
        </span>
        <button
          type="button"
          className="visualizador__btn"
          aria-label="Aumentar"
          disabled={nivel === ZOOM.length - 1}
          onClick={() => setNivel((n) => Math.min(ZOOM.length - 1, n + 1))}
        >
          <Icon name="plus" />
        </button>
        <button
          type="button"
          className="visualizador__fechar"
          data-fechar
          onClick={() => ref.current?.close()}
        >
          <Icon name="x" />
          Fechar
        </button>
      </div>
      <div
        className="visualizador__area"
        tabIndex={0}
        role="region"
        aria-label="Imagem ampliada. Use as setas para mover."
      >
        <img
          src={src}
          alt={alt || 'Imagem da questão'}
          style={{ width: `${ZOOM[nivel] * 100}%` }}
          onDoubleClick={() => setNivel((n) => (n === 0 ? 2 : 0))}
        />
      </div>
      <p className="visualizador__dica">
        Use dois dedos para aproximar e arrastar, ou os botões + e −.
      </p>
    </dialog>
  )
}
