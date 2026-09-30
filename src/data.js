/* Conteúdo do Estudaê: áreas, temas, vídeo-aulas e questões */
const LESSON_KINDS = [
  { kind: "Vídeo introdutório", min: 4 },
  { kind: "Aprofundando", min: 13 },
  { kind: "Exercícios comentados", min: 9 },
  { kind: "Revisão rápida", min: 6 },
];

const SUBJECTS = {
  pt: {
    id: "pt",
    name: "Português",
    area: "Linguagens",
    icon: "pen",
    topics: [
      { title: "Interpretação de texto", videos: 2, about: "Uma aula prática, com explicação calma e passo a passo, sobre técnicas para localizar a ideia principal em um texto e diferenciá-la de informações secundárias." },
      { title: "Gramática e concordância", videos: 2, about: "Entenda como o verbo combina com o sujeito e como evitar os erros de concordância mais cobrados no Encceja." },
      { title: "Produção textual", videos: 3, about: "Como organizar introdução, desenvolvimento e conclusão para escrever uma redação clara e bem argumentada." },
      { title: "Encontro vocálico", videos: 2, about: "Ditongo, tritongo e hiato explicados com exemplos do dia a dia e dicas para separar sílabas sem medo." },
      { title: "Concordância gramatical", videos: 4, about: "Concordância nominal e verbal com palavras como anexo, meio, bastante e obrigado, com exercícios resolvidos." },
    ],
    questions: [
      {
        topic: 0,
        text: "Em muitas cidades brasileiras, as feiras livres continuam resistindo aos supermercados. Mais do que comprar frutas e verduras, as pessoas vão à feira para conversar, pechinchar e reencontrar vizinhos. A feira é, assim, também um espaço de convivência.",
        ask: "A ideia central do texto é que a feira livre:",
        options: ["É sempre mais barata que o supermercado.", "Deve desaparecer nos próximos anos.", "É também um lugar de encontro entre as pessoas.", "Vende apenas frutas e verduras."],
        answer: 2,
        why: "O texto termina afirmando que a feira é “também um espaço de convivência”. Essa é a ideia que amarra todas as outras informações.",
      },
      {
        topic: 1,
        ask: "Qual frase está escrita de acordo com a norma-padrão?",
        options: ["Fazem dois anos que me mudei.", "Faz dois anos que me mudei.", "Houveram muitos problemas na reunião.", "Os aluno chegou cedo."],
        answer: 1,
        why: "Quando indica tempo decorrido, o verbo “fazer” não tem sujeito e fica no singular: “faz dois anos”.",
      },
      {
        topic: 2,
        ask: "Em um texto dissertativo-argumentativo, a função da conclusão é:",
        options: ["Apresentar o tema pela primeira vez.", "Retomar a tese e propor uma solução.", "Contar uma história pessoal do autor.", "Listar as fontes consultadas."],
        answer: 1,
        why: "A conclusão fecha o raciocínio: retoma o ponto de vista defendido e, no Encceja, costuma trazer uma proposta de solução.",
      },
      {
        topic: 3,
        ask: "Qual das palavras abaixo apresenta um ditongo?",
        options: ["Saída", "Pai", "Paraguai", "Juiz"],
        answer: 1,
        why: "Em “pai”, as vogais ficam na mesma sílaba (pai). “Saída” e “juiz” têm hiato, e “Paraguai” tem tritongo (guai).",
      },
      {
        topic: 4,
        ask: "Complete a frase: “Seguem ____ os documentos solicitados.”",
        options: ["anexo", "anexos", "anexa", "anexas"],
        answer: 1,
        why: "“Anexo” concorda com o substantivo a que se refere. Como “documentos” é masculino plural, o correto é “anexos”.",
      },
    ],
  },
  mat: {
    id: "mat",
    name: "Matemática",
    area: "Números e cálculos",
    icon: "percent",
    topics: [
      { title: "MMC", videos: 2, about: "Mínimo múltiplo comum com situações do cotidiano, como horários de ônibus e remédios, resolvidas passo a passo." },
      { title: "Regra de sinais", videos: 2, about: "Como multiplicar, dividir, somar e subtrair números positivos e negativos sem confundir os sinais." },
      { title: "MDC", videos: 3, about: "Máximo divisor comum para dividir coisas em partes iguais do maior tamanho possível." },
      { title: "Equação de primeiro grau", videos: 2, about: "Transforme problemas escritos em equações e descubra o valor desconhecido com calma." },
      { title: "Teorema de Pitágoras", videos: 4, about: "A relação entre os lados do triângulo retângulo, com exemplos de escadas, rampas e terrenos." },
    ],
    questions: [
      {
        topic: 0,
        ask: "Um ônibus passa no ponto a cada 12 minutos e outro a cada 18 minutos. Se os dois passaram juntos às 8h, a que horas passarão juntos de novo?",
        options: ["8h30", "8h36", "8h54", "9h12"],
        answer: 1,
        why: "O MMC de 12 e 18 é 36. Então os ônibus voltam a se encontrar 36 minutos depois: às 8h36.",
      },
      {
        topic: 1,
        ask: "Qual é o resultado de (−3) × (+4) + (−2) × (−5)?",
        options: ["−22", "−2", "2", "22"],
        answer: 1,
        why: "(−3) × (+4) = −12 e (−2) × (−5) = +10. Somando: −12 + 10 = −2.",
      },
      {
        topic: 2,
        ask: "Uma costureira tem duas fitas, de 24 cm e 36 cm, e quer cortá-las em pedaços iguais, do maior tamanho possível, sem sobras. Cada pedaço terá:",
        options: ["6 cm", "8 cm", "12 cm", "18 cm"],
        answer: 2,
        why: "O maior número que divide 24 e 36 ao mesmo tempo é 12. Esse é o MDC.",
      },
      {
        topic: 3,
        ask: "Marcos pagou 3 cadernos iguais com uma nota de R$ 50 e recebeu R$ 5 de troco. Quanto custou cada caderno?",
        options: ["R$ 12", "R$ 15", "R$ 16", "R$ 18"],
        answer: 1,
        why: "3x + 5 = 50, então 3x = 45 e x = 15. Cada caderno custou R$ 15.",
      },
      {
        topic: 4,
        ask: "Uma escada de 5 m está apoiada em um muro, com o pé a 3 m da base do muro. A que altura a escada toca o muro?",
        options: ["2 m", "3 m", "4 m", "8 m"],
        answer: 2,
        why: "Pelo Teorema de Pitágoras: 5² = 3² + h², então 25 = 9 + h², h² = 16 e h = 4 m.",
      },
    ],
  },
};

function lessonsFor(topic) {
  return LESSON_KINDS.slice(0, topic.videos);
}
