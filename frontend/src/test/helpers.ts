/* Fixtures compartilhadas dos testes de tela/integração. */
import type { A11y, CatalogSubject } from '../types'
import type { useApp } from '../core/store'

export type AppState = ReturnType<typeof useApp.getState>

export const A11Y_PADRAO: A11y = {
  font: 'grande',
  contrast: false,
  speak: false,
  motion: false,
  subs: false,
  slow: false,
}

export const MATERIA: CatalogSubject = {
  id: 'matematica',
  nivel: 'medio',
  name: 'Matemática',
  area: '1 tema',
  icon: 'percent',
  totalQuestoes: 3,
  topics: [
    {
      slug: 'porcentagem',
      title: 'Porcentagem',
      about: 'Aprenda a calcular porcentagem.',
      videos: 1,
      totalQuestoes: 3,
      lessons: [
        {
          id: 1,
          kind: 'Porcentagem (Gis com Giz)',
          min: 5,
          youtubeId: 'abc123',
        },
      ],
    },
  ],
}
