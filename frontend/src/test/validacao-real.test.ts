/* Validação REAL: bate na API de verdade (localhost:8080) e percorre o
   caminho do motor com os dados do banco — catálogo, pedagogia validada,
   matrizes, orquestrador e seleção de rodada. Só roda com a API no ar:
      API_REAL=1 npm test
   Sem a env, o describe inteiro é pulado (CI não precisa da API). */
import 'fake-indexeddb/auto'
import { describe, expect, it, vi } from 'vitest'
import { api } from '../core/api'
import { proximaAcaoEquilibrada } from '../core/aprendizagem/jornada'
import { selecionarRodada } from '../core/aprendizagem/selecao'
import { matrizesAprendizagem } from '../core/capturaAprendizagem'
import type { EstadoAprendizagem } from '../core/aprendizagem/tipos'

const estadoVazio = (): EstadoAprendizagem => ({
  controle: {
    id: 'principal',
    geracao: 0,
    resetPendente: false,
    esquema: 1,
    localLearnerId: 'aluno',
    revisao: 0,
    ultimaSequencia: 0,
  },
  eventos: [],
  conclusoes: [],
})

const MATERIAS_EM = ['matematica', 'linguagens']
const MATERIAS_EF = ['matematica-fundamental', 'linguagens-fundamental']

// O api.ts usa caminhos relativos ('/api/...'); fora do navegador eles
// precisam da origem completa da API real.
const real = globalThis.fetch.bind(globalThis)
vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) =>
  real(new URL(String(input), 'http://localhost:8080'), init),
)

// Sem @types/node neste projeto: process.env é lido via globalThis.
const apiReal = Boolean(
  (globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.API_REAL,
)
const comApi = describe.skipIf(!apiReal)

comApi.each([
  ['Ensino Médio', MATERIAS_EM],
  ['Ensino Fundamental', MATERIAS_EF],
])('jornada real no %s', (_nivel, materias) => {
  it('catálogo + pedagogia validada com essenciais em cada matéria', async () => {
    for (const d of materias) {
      const ped = await api.pedagogia(d)
      expect(ped.matriz?.validada, `${d} não validada`).toBe(true)
      const matrizes = matrizesAprendizagem(ped)
      expect(matrizes.length).toBeGreaterThan(0)
      const essenciais = matrizes.flatMap((m) =>
        m.habilidades.filter((h) => h.essencial),
      )
      expect(essenciais.length, `${d} sem essencial`).toBeGreaterThan(0)
    }
  })

  it('orquestrador agenda diagnóstico para quem nunca estudou', async () => {
    const porMateria = await Promise.all(
      materias.map(async (d) => ({
        disciplina: d,
        matrizes: matrizesAprendizagem(await api.pedagogia(d)),
      })),
    )
    const acao = proximaAcaoEquilibrada(estadoVazio(), porMateria)
    expect(acao).not.toBeNull()
    expect(acao!.tipo).toBe('diagnostico')
    expect(materias).toContain(acao!.disciplina)
  })

  it('seleção adaptativa monta rodada real de questões', async () => {
    for (const d of materias) {
      const ped = await api.pedagogia(d)
      const matrizes = matrizesAprendizagem(ped)
      const rodada = selecionarRodada(matrizes, estadoVazio(), 6)
      expect(rodada.questoes.length, `${d} não montou rodada`).toBeGreaterThan(
        0,
      )
      // Questões de famílias distintas — a dedup do motor já vem na seleção.
      const familias = rodada.questoes.map((q) => q.pedagogia!.familia)
      expect(new Set(familias).size).toBe(familias.length)
    }
  })
})
