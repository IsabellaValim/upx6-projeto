import { describe, expect, it } from 'vitest'
import { splitTex, stripTex } from './tex'

describe('splitTex', () => {
  it('texto puro vira um segmento só', () => {
    expect(splitTex('Quanto é R$ 10,00?')).toEqual([{ type: 'text', value: 'Quanto é R$ 10,00?' }])
  })

  it('separa fórmula na linha \\( ... \\)', () => {
    expect(splitTex('Seja \\( x = 5 \\) o valor.')).toEqual([
      { type: 'text', value: 'Seja ' },
      { type: 'inline', value: ' x = 5 ' },
      { type: 'text', value: ' o valor.' },
    ])
  })

  it('separa fórmula em bloco \\[ ... \\]', () => {
    expect(splitTex('\\[ 3x = 15 \\]')).toEqual([{ type: 'display', value: ' 3x = 15 ' }])
  })

  it('mistura os dois tipos e preserva a ordem', () => {
    const seg = splitTex('a \\(b\\) c \\[d\\] e')
    expect(seg.map((s) => s.type)).toEqual(['text', 'inline', 'text', 'display', 'text'])
    expect(seg.map((s) => s.value)).toEqual(['a ', 'b', ' c ', 'd', ' e'])
  })

  it('delimitador não fechado fica como texto', () => {
    expect(splitTex('abre \\( e não fecha')).toEqual([
      { type: 'text', value: 'abre \\( e não fecha' },
    ])
  })
})

describe('stripTex', () => {
  it('troca cada fórmula por "fórmula" (voz alta)', () => {
    expect(stripTex('Seja \\( x = 5 \\) e \\[ y = 2 \\].')).toBe('Seja fórmula e fórmula.')
  })
})
