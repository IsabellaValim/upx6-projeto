import { describe, expect, it } from 'vitest'
import { avaliarDominio } from './dominio'
import { extrairEvidencias } from './evidencias'
import { PARAMETROS_DOMINIO } from './config'
import type {
  EstadoAprendizagem,
  EventoAprendizagem,
  MatrizTema,
  QuestaoAprendizagem,
} from './tipos'

const dia = 24 * 60 * 60 * 1000
function cenario() {
  const estado: EstadoAprendizagem = {
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
  }
  const matriz: MatrizTema = {
    disciplina: 'matematica',
    tema: 'numeros',
    validada: true,
    habilidades: [{ slug: 'contar', essencial: true }],
    questoes: [],
  }
  function adicionar(
    n: number,
    acertou = true,
    instante = n * 1000,
    sessaoId = 's1',
    habilidade = 'contar',
    familia = `f${n}`,
  ) {
    const questao: QuestaoAprendizagem = {
      codigo: `q${n}`,
      disciplina: matriz.disciplina,
      tema: matriz.tema,
      pedagogia: {
        habilidade,
        secundarias: [],
        familia,
        revisao: 'aprovada',
        elegivel: true,
        versao: 1,
      },
    }
    matriz.questoes.push(questao)
    const submissao: EventoAprendizagem = {
      id: `s${n}`,
      codigo: questao.codigo,
      disciplina: matriz.disciplina,
      tema: matriz.tema,
      geracao: 0,
      sessaoId,
      modalidade: 'licao',
      tipo: 'submissao',
      instante,
      dataLocal: new Date(instante).toISOString().slice(0, 10),
      metadados: { ...questao.pedagogia! },
      confiavel: true,
      tentativaId: `t${n}`,
      respondeu: true,
      respostaTexto: 'alternativa',
      revisaoApi: 'conteudo-v1',
    }
    const correcao: EventoAprendizagem = {
      ...submissao,
      id: `c${n}`,
      tipo: 'correcao',
      instante: instante + 1,
      acertou,
    }
    estado.eventos.push(submissao, correcao)
    estado.conclusoes = estado.conclusoes.filter((f) => f.sessaoId !== sessaoId)
    const eventosSessao = estado.eventos.filter((e) => e.sessaoId === sessaoId)
    estado.conclusoes.push({
      id: sessaoId,
      sessaoId,
      geracao: 0,
      instante: Math.max(...eventosSessao.map((e) => e.instante)) + 1,
      eventoIds: eventosSessao.map((e) => e.id),
    })
    return { submissao, correcao, questao }
  }
  return { estado, matriz, adicionar }
}

describe('evidências independentes', () => {
  it('usa cronologia e a primeira evidência da família, sem substituir erro por acerto', () => {
    const { estado, matriz, adicionar } = cenario()
    adicionar(1, false)
    adicionar(2, true, 2000, 's2', 'contar', 'f1')
    estado.eventos.reverse()
    expect(extrairEvidencias(estado, matriz).map((e) => e.acertou)).toEqual([
      false,
    ])
  })
  it.each(['pendente', 'rejeitada'] as const)(
    'não promove metadados %s retroativamente',
    (revisao) => {
      const { estado, matriz, adicionar } = cenario()
      const { submissao } = adicionar(1)
      submissao.metadados!.revisao = revisao
      expect(extrairEvidencias(estado, matriz)).toEqual([])
    },
  )
  it('retira evidência revogada ou de versão alterada', () => {
    const { estado, matriz, adicionar } = cenario()
    const { questao } = adicionar(1)
    questao.pedagogia!.versao++
    expect(extrairEvidencias(estado, matriz)).toEqual([])
  })
  it.each(['ajuda', 'exposicao'] as const)(
    'exclui %s prévia na mesma família',
    (tipo) => {
      const { estado, matriz, adicionar } = cenario()
      const { submissao } = adicionar(1)
      estado.eventos.push({
        ...submissao,
        id: 'antes',
        codigo: 'outra',
        tipo,
        instante: 0,
      })
      expect(extrairEvidencias(estado, matriz)).toEqual([])
    },
  )
  it('exclui ajuda entre submissão e correção', () => {
    const { estado, matriz, adicionar } = cenario()
    const { submissao } = adicionar(1)
    estado.eventos.push({ ...submissao, id: 'ajuda', tipo: 'ajuda' })
    expect(extrairEvidencias(estado, matriz)).toEqual([])
  })
  it('submissão incerta não consome a novidade da família', () => {
    const { estado, matriz, adicionar } = cenario()
    const primeiro = adicionar(1)
    estado.eventos.splice(1, 1)
    primeiro.submissao.incerta = true
    adicionar(2, true, 2000, 's2', 'contar', 'f1')
    expect(extrairEvidencias(estado, matriz).map((e) => e.codigo)).toEqual([
      'q2',
    ])
  })
  it('submissão íntegra sem correção consome a novidade da família', () => {
    const { estado, matriz, adicionar } = cenario()
    adicionar(1)
    estado.eventos.splice(1, 1)
    adicionar(2, true, 2000, 's2', 'contar', 'f1')
    expect(extrairEvidencias(estado, matriz)).toEqual([])
  })
  it('não invalida evidência anterior por exposição posterior', () => {
    const { estado, matriz, adicionar } = cenario()
    const { correcao } = adicionar(1)
    estado.eventos.push({
      ...correcao,
      id: 'exposta',
      tipo: 'exposicao',
      instante: 9000,
    })
    expect(extrairEvidencias(estado, matriz)).toHaveLength(1)
  })
  it('simulado exige conclusão canônica com submissão e correção', () => {
    const { estado, matriz, adicionar } = cenario()
    const { submissao, correcao } = adicionar(1)
    submissao.modalidade = correcao.modalidade = 'simulado'
    estado.conclusoes = []
    expect(extrairEvidencias(estado, matriz)).toHaveLength(0)
    estado.conclusoes.push({
      id: 'fim',
      sessaoId: 's1',
      geracao: 0,
      instante: 2000,
      eventoIds: [submissao.id, correcao.id],
    })
    expect(extrairEvidencias(estado, matriz)).toHaveLength(1)
  })
  it('não mistura gerações ou correções conflitantes', () => {
    const { estado, matriz, adicionar } = cenario()
    const { correcao } = adicionar(1)
    estado.eventos.push({ ...correcao, id: 'duplicada', acertou: false })
    expect(extrairEvidencias(estado, matriz)).toHaveLength(0)
    estado.eventos.pop()
    estado.controle.geracao++
    expect(extrairEvidencias(estado, matriz)).toHaveLength(0)
  })
})

describe('domínio conservador', () => {
  it('bom desempenho requer quatro, domínio requer seis e rodada posterior no mesmo dia', () => {
    const { estado, matriz, adicionar } = cenario()
    for (let i = 1; i <= 3; i++) adicionar(i)
    expect(avaliarDominio(estado, matriz).estado).toBe('em-pratica')
    adicionar(4)
    expect(avaliarDominio(estado, matriz).estado).toBe('bom-desempenho')
    adicionar(5, true, 5000, 's2')
    expect(avaliarDominio(estado, matriz).estado).toBe('bom-desempenho')
    adicionar(6, true, 6000, 's2')
    expect(avaliarDominio(estado, matriz).estado).toBe('dominio-confirmado')
  })
  it('a rodada de verificação precisa ser outra sessão, não a mesma', () => {
    const { estado, matriz, adicionar } = cenario()
    for (let i = 1; i <= 6; i++) adicionar(i)
    expect(avaliarDominio(estado, matriz).verificacaoIndependente).toBe(false)
    expect(avaliarDominio(estado, matriz).estado).toBe('bom-desempenho')
  })
  it('os dois acertos da verificação precisam caber na mesma rodada', () => {
    const { estado, matriz, adicionar } = cenario()
    for (let i = 1; i <= 4; i++) adicionar(i)
    adicionar(5, true, 5000, 's2')
    adicionar(6, true, 6000, 's3')
    expect(avaliarDominio(estado, matriz).verificacaoIndependente).toBe(false)
    // Juntar as duas respostas numa só rodada habilita a verificação.
    estado.eventos
      .filter((e) => e.tentativaId === 't6')
      .forEach((e) => {
        e.sessaoId = 's2'
      })
    estado.conclusoes = estado.conclusoes.filter((f) => f.sessaoId === 's1')
    const eventosS2 = estado.eventos.filter((e) => e.sessaoId === 's2')
    estado.conclusoes.push({
      id: 's2',
      sessaoId: 's2',
      geracao: 0,
      instante: Math.max(...eventosS2.map((e) => e.instante)) + 1,
      eventoIds: eventosS2.map((e) => e.id),
    })
    expect(avaliarDominio(estado, matriz).verificacaoIndependente).toBe(true)
  })
  it('limita W a oito e exige 80%, sem apagar erros recorrentes antigos', () => {
    const { estado, matriz, adicionar } = cenario()
    adicionar(1, false)
    adicionar(2, false)
    for (let i = 3; i <= 10; i++) adicionar(i, true, i * 1000, 's1', 'outra')
    matriz.habilidades.push({ slug: 'outra', essencial: false })
    const d = avaliarDominio(estado, matriz)
    expect(d.janela).toHaveLength(8)
    expect(d.taxa).toBe(1)
    expect(d.recorrenciasResolvidas).toBe(false)
    adicionar(11)
    expect(avaliarDominio(estado, matriz).recorrenciasResolvidas).toBe(false)
    adicionar(12)
    expect(avaliarDominio(estado, matriz).recorrenciasResolvidas).toBe(true)
  })
  it('essenciais usam suas próprias últimas quatro e nunca secundárias', () => {
    const { estado, matriz, adicionar } = cenario()
    matriz.habilidades.push({ slug: 'outra', essencial: true })
    for (let i = 1; i <= 6; i++)
      adicionar(i).submissao.metadados!.secundarias = ['outra']
    expect(avaliarDominio(estado, matriz).essenciaisAtendidas).toBe(false)
    adicionar(7, true, 7000, 's1', 'outra')
    adicionar(8, true, 8000, 's1', 'outra')
    expect(avaliarDominio(estado, matriz).essenciaisAtendidas).toBe(true)
    for (let i = 9; i <= 11; i++) adicionar(i, false, i * 1000, 's1', 'outra')
    expect(avaliarDominio(estado, matriz).essenciaisAtendidas).toBe(false)
  })
  it('matriz sem validação ou essenciais não confirma domínio', () => {
    const { estado, matriz, adicionar } = cenario()
    for (let i = 1; i <= 6; i++)
      adicionar(i, true, i <= 4 ? i * 1000 : 3 * dia + i, i <= 4 ? 's1' : 's2')
    matriz.validada = false
    expect(avaliarDominio(estado, matriz).estado).toBe('bom-desempenho')
    matriz.validada = true
    matriz.habilidades[0]!.essencial = false
    expect(avaliarDominio(estado, matriz).essenciaisAtendidas).toBe(false)
  })
  it('80% é inclusivo para bom desempenho', () => {
    const { estado, matriz, adicionar } = cenario()
    for (let i = 1; i <= 5; i++) adicionar(i, i !== 5)
    expect(avaliarDominio(estado, matriz).estado).toBe('bom-desempenho')
    adicionar(6, false)
    expect(avaliarDominio(estado, matriz).estado).toBe('em-pratica')
  })
  it('cinco essenciais completam cobertura com cinco respostas novas na revisão', () => {
    const { estado, matriz, adicionar } = cenario()
    matriz.habilidades = Array.from({ length: 5 }, (_, i) => ({
      slug: `h${i}`,
      essencial: true,
    }))
    for (let i = 0; i < 5; i++)
      adicionar(i + 1, true, (i + 1) * 1000, 's1', `h${i}`)
    const inicial = avaliarDominio(estado, matriz)
    expect(inicial.essenciaisAtendidas).toBe(false)
    expect(inicial.marcoBomDesempenho?.instante).toBe(5000)
    expect(inicial.estado).toBe('bom-desempenho')
    for (let i = 0; i < 5; i++)
      adicionar(i + 6, true, 2 * dia + 5000 + i * 1000, 's2', `h${i}`)
    const final = avaliarDominio(estado, matriz)
    expect(extrairEvidencias(estado, matriz)).toHaveLength(10)
    expect(final.janela).toHaveLength(8)
    expect(final.essenciaisAtendidas).toBe(true)
    expect(final.verificacaoIndependente).toBe(true)
    expect(final.estado).toBe('dominio-confirmado')
  })
  it('três essenciais confirmam com quatro respostas iniciais e duas na revisão', () => {
    const { estado, matriz, adicionar } = cenario()
    matriz.habilidades = ['h1', 'h2', 'h3'].map((slug) => ({
      slug,
      essencial: true,
    }))
    for (const [i, habilidade] of ['h1', 'h1', 'h2', 'h3'].entries())
      adicionar(i + 1, true, (i + 1) * 1000, 's1', habilidade)
    const inicial = avaliarDominio(estado, matriz)
    expect(inicial.essenciaisAtendidas).toBe(false)
    expect(inicial.marcoBomDesempenho?.instante).toBe(4000)
    adicionar(5, true, 2 * dia + 4000, 's2', 'h2')
    adicionar(6, true, 2 * dia + 5000, 's2', 'h3')
    const final = avaliarDominio(estado, matriz)
    expect(final.janela).toHaveLength(6)
    expect(final.essenciaisAtendidas).toBe(true)
    expect(final.verificacaoIndependente).toBe(true)
    expect(final.estado).toBe('dominio-confirmado')
  })
  it('marco usa última submissão da sessão, não o quarto item', () => {
    const { estado, matriz, adicionar } = cenario()
    for (let i = 1; i <= 4; i++) adicionar(i)
    adicionar(5, true, dia, 's1')
    adicionar(6, true, 2 * dia + 4000, 's2')
    const d = avaliarDominio(estado, matriz)
    expect(d.marcoBomDesempenho?.instante).toBe(dia)
    expect(d.verificacaoIndependente).toBe(false)
  })
  it('confirmação independe do intervalo: rodada posterior com acertos basta', () => {
    const { estado, matriz, adicionar } = cenario()
    for (let i = 1; i <= 4; i++) adicionar(i)
    adicionar(5, true, dia, 's2')
    adicionar(6, true, 3 * dia, 's2')
    adicionar(7, true, 3 * dia + 1, 's2')
    expect(avaliarDominio(estado, matriz).verificacaoIndependente).toBe(true)
  })
  it('dois acertos de três numa revisão não confirmam verificação e invalidam o marco', () => {
    const { estado, matriz, adicionar } = cenario()
    for (let i = 1; i <= 4; i++) adicionar(i)
    adicionar(5, true, 3 * dia, 's2')
    adicionar(6, false, 3 * dia + 1000, 's2')
    adicionar(7, true, 3 * dia + 2000, 's2')
    expect(avaliarDominio(estado, matriz).taxa).toBeGreaterThanOrEqual(0.8)
    expect(avaliarDominio(estado, matriz).verificacaoIndependente).toBe(false)
    expect(avaliarDominio(estado, matriz).marcoBomDesempenho).toBeNull()
    adicionar(8, true, 6 * dia, 's3')
    adicionar(9, true, 6 * dia + 1, 's3')
    expect(avaliarDominio(estado, matriz).verificacaoIndependente).toBe(false)
  })
  it('ignora sessão intermediária sem evidência por metadados ou repetição', () => {
    const { estado, matriz, adicionar } = cenario()
    for (let i = 1; i <= 4; i++) adicionar(i)
    const desconhecida = adicionar(5, true, dia, 's2')
    desconhecida.submissao.metadados!.revisao = 'pendente'
    const repetida = adicionar(6, false, dia + 1000, 's2', 'contar', 'f1')
    repetida.submissao.codigo = 'q-repetida'
    repetida.correcao.codigo = 'q-repetida'
    expect(extrairEvidencias(estado, matriz)).toHaveLength(4)
    adicionar(7, true, 3 * dia, 's3')
    adicionar(8, true, 3 * dia + 1000, 's3')
    const d = avaliarDominio(estado, matriz)
    expect(d.verificacaoIndependente).toBe(true)
    expect(d.estado).toBe('dominio-confirmado')
  })
  it('repetição filtrada junto de evidência não apaga marco; erro elegível apaga', () => {
    const { estado, matriz, adicionar } = cenario()
    for (let i = 1; i <= 4; i++) adicionar(i)
    adicionar(5, true, dia, 's2')
    const repetida = adicionar(6, false, dia + 1000, 's2', 'contar', 'f1')
    repetida.submissao.codigo = 'q-repetida'
    repetida.correcao.codigo = 'q-repetida'
    expect(extrairEvidencias(estado, matriz)).toHaveLength(5)
    expect(avaliarDominio(estado, matriz).marcoBomDesempenho).not.toBeNull()
    adicionar(7, true, 3 * dia, 's3')
    adicionar(8, true, 3 * dia + 1000, 's3')
    expect(avaliarDominio(estado, matriz).estado).toBe('dominio-confirmado')
    adicionar(9, false, 5 * dia, 's4')
    expect(avaliarDominio(estado, matriz).marcoBomDesempenho).toBeNull()
    expect(avaliarDominio(estado, matriz).verificacaoIndependente).toBe(false)
  })
  it('confirmação exige sessão concluída e conta apenas tentativas qualificadas', () => {
    const { estado, matriz, adicionar } = cenario()
    for (let i = 1; i <= 4; i++) adicionar(i)
    adicionar(5, true, 3 * dia, 's2')
    adicionar(6, true, 3 * dia + 1000, 's2')
    const terceiro = adicionar(7, true, 3 * dia + 2000, 's2')
    terceiro.submissao.incerta = true
    expect(avaliarDominio(estado, matriz).verificacaoIndependente).toBe(true)
    terceiro.submissao.incerta = false
    estado.conclusoes = estado.conclusoes.filter((f) => f.sessaoId !== 's2')
    expect(avaliarDominio(estado, matriz).verificacaoIndependente).toBe(false)
  })
  it('recorrência considera apenas essenciais e sua janela própria de quatro', () => {
    const { estado, matriz, adicionar } = cenario()
    matriz.habilidades.push({ slug: 'outra', essencial: false })
    adicionar(1, false, 1000, 's1', 'outra')
    adicionar(2, false, 2000, 's1', 'outra')
    expect(avaliarDominio(estado, matriz).recorrenciasResolvidas).toBe(true)
    adicionar(3, false)
    adicionar(4, false)
    expect(avaliarDominio(estado, matriz).recorrenciasResolvidas).toBe(false)
    adicionar(5)
    adicionar(6)
    expect(avaliarDominio(estado, matriz).recorrenciasResolvidas).toBe(true)
    adicionar(7, false)
    expect(avaliarDominio(estado, matriz).recorrenciasResolvidas).toBe(false)
  })
  it('evidência exige texto submetido e revisão de conteúdo correspondente', () => {
    const { estado, matriz, adicionar } = cenario()
    const { submissao, correcao } = adicionar(1)
    delete submissao.respostaTexto
    expect(extrairEvidencias(estado, matriz)).toHaveLength(0)
    submissao.respostaTexto = 'alternativa'
    delete submissao.revisaoApi
    expect(extrairEvidencias(estado, matriz)).toHaveLength(0)
    submissao.revisaoApi = 'v1'
    correcao.revisaoApi = 'v2'
    expect(extrairEvidencias(estado, matriz)).toHaveLength(0)
    correcao.revisaoApi = 'v1'
    expect(extrairEvidencias(estado, matriz)).toHaveLength(1)
  })
})

describe('parâmetros de domínio injetados', () => {
  it('exporta padrões congelados sem mudar o comportamento de produção', () => {
    expect(PARAMETROS_DOMINIO).toEqual({
      window: 8,
      min: 6,
      taxa: 0.8,
      boaMin: 4,
      skillWindow: 4,
      skillCorrect: 2,
      erroRecorrente: 2,
      confirmacaoMin: 2,
    })
    expect(Object.isFrozen(PARAMETROS_DOMINIO)).toBe(true)
  })
  it('aplica mínimo de verificação personalizado sem mudar padrões ou estado', () => {
    const { estado, matriz, adicionar } = cenario()
    for (let i = 1; i <= 4; i++) adicionar(i)
    adicionar(5, true, 5000, 's2')
    adicionar(6, true, 6000, 's2')
    const antes = structuredClone(estado)
    expect(avaliarDominio(estado, matriz).estado).toBe('dominio-confirmado')
    expect(
      avaliarDominio(estado, matriz, {
        ...PARAMETROS_DOMINIO,
        min: 7,
      }).estado,
    ).toBe('bom-desempenho')
    expect(
      avaliarDominio(estado, matriz, {
        ...PARAMETROS_DOMINIO,
        confirmacaoMin: 3,
      }).verificacaoIndependente,
    ).toBe(false)
    expect(estado).toEqual(antes)
    expect(PARAMETROS_DOMINIO.confirmacaoMin).toBe(2)
  })
  it('aplica janela, bom desempenho e cobertura de habilidade personalizados', () => {
    const { estado, matriz, adicionar } = cenario()
    for (let i = 1; i <= 4; i++) adicionar(i)
    expect(
      avaliarDominio(estado, matriz, { ...PARAMETROS_DOMINIO, boaMin: 5 })
        .estado,
    ).toBe('em-pratica')
    expect(
      avaliarDominio(estado, matriz, {
        ...PARAMETROS_DOMINIO,
        skillWindow: 2,
        skillCorrect: 2,
      }).essenciaisAtendidas,
    ).toBe(true)
    adicionar(5, false)
    expect(
      avaliarDominio(estado, matriz, {
        ...PARAMETROS_DOMINIO,
        skillWindow: 2,
        skillCorrect: 2,
      }).essenciaisAtendidas,
    ).toBe(false)
    expect(
      avaliarDominio(estado, matriz, {
        ...PARAMETROS_DOMINIO,
        erroRecorrente: 1,
      }).recorrenciasResolvidas,
    ).toBe(false)
    expect(
      avaliarDominio(estado, matriz, { ...PARAMETROS_DOMINIO, taxa: 1 }).estado,
    ).toBe('em-pratica')
    expect(
      avaliarDominio(estado, matriz, {
        ...PARAMETROS_DOMINIO,
        window: 4,
        min: 4,
      }).janela,
    ).toHaveLength(4)
  })
  it.each([
    { window: 0 },
    { window: 9 },
    { min: 0 },
    { min: 9 },
    { min: 3 },
    { boaMin: 0 },
    { boaMin: 7 },
    { boaMin: 1.5 },
    { skillWindow: 0 },
    { skillCorrect: 0 },
    { skillCorrect: 5 },
    { erroRecorrente: 0 },
    { erroRecorrente: 5 },
    { confirmacaoMin: 0 },
    { confirmacaoMin: 9 },
    { confirmacaoMin: Infinity },
    { taxa: 0 },
    { taxa: 1.1 },
    { taxa: NaN },
  ])('rejeita parâmetro inválido antes de avaliar: %o', (alteracao) => {
    const { estado, matriz } = cenario()
    expect(() =>
      avaliarDominio(estado, matriz, { ...PARAMETROS_DOMINIO, ...alteracao }),
    ).toThrow('Parâmetros de domínio inválidos')
  })
})
