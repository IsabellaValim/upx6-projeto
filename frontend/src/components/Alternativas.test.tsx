/* Alternativas: roving tabindex, setas que movem e marcam, estados de correção. */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { QuestaoItem } from '../types'
import { Alternativas } from './Alternativas'

const item: QuestaoItem = {
  id: 1,
  topic: 0,
  text: null,
  ask: 'Quanto é 2 + 2?',
  options: ['3', '4', '5'],
  prova: null,
  imagem: null,
}

afterEach(cleanup)

describe('Alternativas', () => {
  it('radiogroup com roving tabindex; setas movem e selecionam', () => {
    const escolhas: number[] = []
    render(
      <Alternativas
        item={item}
        chosen={undefined}
        onChoose={(k) => escolhas.push(k)}
      />,
    )

    const group = screen.getByRole('radiogroup')
    expect(group).toHaveAttribute('aria-labelledby', 'ask')

    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(3)
    // Só a primeira (sem marcada) é tabulável.
    expect(radios.map((r) => r.tabIndex)).toEqual([0, -1, -1])

    // Seta para baixo: foca E marca a próxima, ciclando no fim.
    fireEvent.keyDown(radios[0], { key: 'ArrowDown' })
    expect(escolhas).toEqual([1])
    fireEvent.keyDown(radios[2], { key: 'ArrowDown' })
    expect(escolhas).toEqual([1, 0])
    fireEvent.keyDown(radios[0], { key: 'ArrowUp' })
    expect(escolhas).toEqual([1, 0, 2])

    // Clique marca também.
    fireEvent.click(radios[2])
    expect(escolhas).toEqual([1, 0, 2, 2])
  })

  it('com a marcada, o tabindex acompanha a escolha', () => {
    render(<Alternativas item={item} chosen={1} onChoose={() => {}} />)
    expect(screen.getAllByRole('radio').map((r) => r.tabIndex)).toEqual([
      -1, 0, -1,
    ])
    expect(screen.getAllByRole('radio')[1]).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  it('com correção: trava o grupo e rotula certa/sua resposta', () => {
    render(
      <Alternativas
        item={item}
        chosen={2}
        onChoose={vi.fn()}
        result={{
          acertou: false,
          respostaCorreta: '4',
          resolucao: 'Porque 2+2=4.',
        }}
      />,
    )
    const radios = screen.getAllByRole('radio')
    expect(radios.every((r) => (r as HTMLButtonElement).disabled)).toBe(true)
    expect(screen.getByRole('radiogroup')).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    expect(screen.getByText('Resposta certa')).toBeInTheDocument()
    expect(screen.getByText('Sua resposta')).toBeInTheDocument()
  })
})
