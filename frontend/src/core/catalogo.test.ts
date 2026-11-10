import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from './api'
import {
  carregarCatalogo,
  carregarQuestoes,
  fonte,
  materiasDoNivel,
} from './catalogo'
import { useApp } from './store'
import type { CatalogSubject } from '../types'

vi.mock('./api', () => ({
  api: {
    disciplinas: vi.fn(),
    temas: vi.fn(),
    questoes: vi.fn(),
    resposta: vi.fn(),
  },
}))

const disciplinas = [
  {
    slug: 'matematica',
    nome: 'Matemática',
    icone: 'percent',
    nivel: 'medio',
    totalQuestoes: 5,
  },
  {
    slug: 'linguagens',
    nome: 'Linguagens',
    icone: 'pen',
    nivel: 'medio',
    totalQuestoes: 5,
  },
]
const temas = [
  {
    slug: 'porcentagem',
    titulo: 'Porcentagem',
    sobre: 'Sobre',
    totalQuestoes: 5,
    videos: [
      {
        id: 7,
        titulo: 'Aula (Canal X)',
        youtubeId: 'AAAAAAAAAAA',
        duracaoSegundos: 200,
      },
    ],
  },
]

beforeEach(() => {
  vi.mocked(api.disciplinas).mockResolvedValue(disciplinas)
  vi.mocked(api.temas).mockResolvedValue(temas)
  useApp.setState({ subjects: {}, catalogoStatus: 'loading' })
})

describe('carregarCatalogo', () => {
  it('preenche subjects no formato das telas e marca ready', async () => {
    await carregarCatalogo()
    const st = useApp.getState()
    expect(st.catalogoStatus).toBe('ready')
    const m = st.subjects['matematica']
    expect(m.name).toBe('Matemática')
    expect(m.icon).toBe('percent')
    expect(m.topics[0]).toMatchObject({
      slug: 'porcentagem',
      title: 'Porcentagem',
      videos: 1,
      totalQuestoes: 5,
    })
    expect(m.topics[0].lessons[0]).toEqual({
      id: 7,
      kind: 'Aula (Canal X)',
      min: 3, // 200s arredonda para 3min (mínimo 1)
      youtubeId: 'AAAAAAAAAAA',
    })
  })

  it('falha marca error e propaga a exceção', async () => {
    vi.mocked(api.disciplinas).mockRejectedValue(new Error('rede'))
    await expect(carregarCatalogo()).rejects.toThrow('rede')
    expect(useApp.getState().catalogoStatus).toBe('error')
  })
})

describe('carregarQuestoes', () => {
  it('mapeia para o formato das telas (sem gabarito)', async () => {
    vi.mocked(api.questoes).mockResolvedValue([
      {
        id: 2,
        textoBase: 'base',
        enunciado: 'pergunta',
        alternativas: ['a', 'b'],
        prova: { ano: 2024 },
        imagem: { url: 'conteudo/imagens/x.webp', descricao: 'figura' },
      },
    ])
    await carregarCatalogo()
    const subjects = useApp.getState().subjects
    const qs = await carregarQuestoes(subjects, 'matematica', 0)
    expect(api.questoes).toHaveBeenCalledWith('matematica', 'porcentagem')
    expect(qs[0]).toEqual({
      id: 2,
      topic: 0,
      text: 'base',
      ask: 'pergunta',
      options: ['a', 'b'],
      prova: { ano: 2024 },
      imagem: { url: 'conteudo/imagens/x.webp', descricao: 'figura' },
    })
  })
})

describe('materiasDoNivel / fonte', () => {
  it('filtra por nível na ordem do catálogo', async () => {
    await carregarCatalogo()
    const mats = materiasDoNivel(useApp.getState().subjects, 'medio')
    expect(mats.map((m: CatalogSubject) => m.id)).toEqual([
      'matematica',
      'linguagens',
    ])
    expect(materiasDoNivel(useApp.getState().subjects, 'fundamental')).toEqual(
      [],
    )
  })

  it('fonte formata prova oficial e autoral', () => {
    expect(
      fonte({
        ano: 2024,
        edicao: 'Nacional',
        nivel: 'Ensino Médio',
        numero: 2,
      }),
    ).toBe('Fonte: Encceja 2024, Nacional, Ensino Médio, questão 2.')
    expect(fonte(null)).toBe('Questão autoral Estudaê, feita para praticar.')
    expect(fonte({ ano: 2020 })).toBe('Fonte: Encceja 2020.')
  })
})
