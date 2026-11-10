import { describe, expect, it } from 'vitest'
import { formatDay, initials, LETTERS, pct, shuffle } from './utils'

describe('utils', () => {
  it('LETTERS cobre o máximo de 5 alternativas da API', () => {
    expect(LETTERS).toEqual(['A', 'B', 'C', 'D', 'E'])
  })

  it('pct arredonda e trata zero', () => {
    expect(pct(1, 3)).toBe(33)
    expect(pct(0, 0)).toBe(0)
  })

  it('initials pega até 2 iniciais e tem fallback', () => {
    expect(initials('maria silva souza')).toBe('MS')
    expect(initials('joão')).toBe('J')
    expect(initials('   ')).toBe('E')
  })

  it('formatDay: hoje, ontem e data antiga', () => {
    expect(formatDay(Date.now())).toBe('Hoje')
    expect(formatDay(Date.now() - 86400000)).toBe('Ontem')
    const antiga = formatDay(new Date(2020, 0, 5).getTime())
    expect(antiga).toContain('05')
  })

  it('shuffle não muda o array original e mantém os elementos', () => {
    const orig = [1, 2, 3, 4, 5]
    const copia = [...orig]
    const s = shuffle(orig)
    expect(orig).toEqual(copia)
    expect(s.slice().sort()).toEqual(orig)
  })
})
