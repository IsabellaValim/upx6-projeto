/* Fórmulas LaTeX nos textos da API (docs/api.md): só \( ... \) na linha
   e \[ ... \] em bloco — nunca $ (R$ 10,00 é dinheiro). */

export interface TexSegment {
  type: 'text' | 'inline' | 'display'
  value: string
}

// Divide o texto em trechos de texto puro e de fórmula, sem os delimitadores.
export function splitTex(text: string): TexSegment[] {
  const out: TexSegment[] = []
  const re = /\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ type: 'text', value: text.slice(last, m.index) })
    if (m[1] !== undefined) out.push({ type: 'display', value: m[1] })
    else out.push({ type: 'inline', value: m[2] })
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ type: 'text', value: text.slice(last) })
  return out
}

/* Para leitura em voz alta: o speechSynthesis soletraria o LaTeX cru
   ("barra dfrac..."). O mínimo aceitável (docs/api.md) é trocar cada
   fórmula pela palavra "fórmula". */
export function stripTex(text: string): string {
  return splitTex(text)
    .map((s) => (s.type === 'text' ? s.value : 'fórmula'))
    .join('')
}
