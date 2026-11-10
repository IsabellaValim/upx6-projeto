/* ==========================================================
   Tex — texto da API com fórmulas LaTeX \( ... \) e \[ ... \]
   (docs/api.md, "Textos com fórmula").

   Só a saída do KaTeX entra como HTML (dangerouslySetInnerHTML);
   o texto nunca é injetado como HTML — o JSX já escapa.
   ========================================================== */
import { useMemo } from 'react'
import katex from 'katex'
import { splitTex } from '../core/tex'

export function Tex({ children: text }: { children: string }) {
  const segs = useMemo(() => splitTex(text), [text])
  return (
    <>
      {segs.map((s, i) =>
        s.type === 'text' ? (
          s.value
        ) : (
          <span
            key={i}
            dangerouslySetInnerHTML={{
              __html: katex.renderToString(s.value, {
                displayMode: s.type === 'display',
                throwOnError: false, // fórmula malformada aparece em vermelho, não quebra a tela
              }),
            }}
          />
        ),
      )}
    </>
  )
}
