/* Gerador dos arquivos de curadoria pedagógica (ArquivoPedagogia, formato 1).
   A classificação abaixo é a curadoria inicial da equipe Estudaê: cada questão
   recebe habilidade, família de itens equivalentes, dificuldade e tipo. O
   script exige cobertura 1:1 com o banco — uma questão esquecida ou um codigo
   a mais aborta a geração, em vez de produzir um arquivo furado.

   Uso:
     docker compose run --rm api impressoes matematica > backups/impressoes-matematica.json
     docker compose run --rm api impressoes linguagens > backups/impressoes-linguagens.json
     node scripts/pedagogia/gerar-pedagogia.mjs
   Saída: docs/conteudo/pedagogia/pedagogia-<disciplina>.json
   Aplicar: docker compose run --rm -v "$PWD/docs/conteudo/pedagogia:/p:ro" api importar-pedagogia /p/pedagogia-matematica.json --aplicar
*/
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DIFS = new Set(["introdutoria", "intermediaria", "avancada"]);
const REVISOR =
  "Equipe Estudaê — curadoria inicial assistida (revisar antes de publicar)";
const VERSAO = "estudae-em-2026-11";

/* q(codigo, habilidade, familia, dificuldade?, tipo?) — dificuldade omitida cai
   no padrão (autoral: introdutoria; oficial: intermediaria). */
const q = (codigo, h, f, dif, tipo) => ({ codigo, h, f, dif, tipo });

// ============================= MATEMÁTICA (EM) =============================
const MAT = {
  disciplina: "matematica",
  tipoPadrao: "contextual",
  temas: {
    equacoes: {
      habilidades: [
        [
          "traduzir-contexto-em-equacao",
          "Traduzir uma situação do dia a dia em equação",
          true,
        ],
        [
          "resolver-equacao-primeiro-grau",
          "Resolver equação do primeiro grau e isolar a incógnita",
          true,
        ],
      ],
      videos: {
        TLkqE_CWY2E: [
          "resolver-equacao-primeiro-grau",
          "traduzir-contexto-em-equacao",
        ],
        H15tdoHlCSM: [
          "resolver-equacao-primeiro-grau",
          "traduzir-contexto-em-equacao",
        ],
      },
      questoes: [
        q(
          "aut-mat-equ-001",
          "traduzir-contexto-em-equacao",
          "equacao-contexto-cotidiano",
        ),
        q(
          "aut-mat-equ-002",
          "traduzir-contexto-em-equacao",
          "equacao-contexto-cotidiano",
        ),
        q(
          "aut-mat-equ-003",
          "traduzir-contexto-em-equacao",
          "equacao-contexto-cotidiano",
        ),
        q(
          "encceja-em-nacional-2019-mat-038",
          "traduzir-contexto-em-equacao",
          "mistura-e-concentracao",
          "avancada",
        ),
        q(
          "encceja-em-nacional-2019-mat-046",
          "traduzir-contexto-em-equacao",
          "valor-minimo-e-inequacao",
        ),
        q(
          "encceja-em-ppl-2020-mat-048",
          "traduzir-contexto-em-equacao",
          "equacao-custo-comercial",
        ),
        q(
          "encceja-em-ppl-2022-mat-047",
          "resolver-equacao-primeiro-grau",
          "isolar-incognita-em-formula",
          "avancada",
          "conceitual",
        ),
      ],
    },
    "estatistica-basica": {
      habilidades: [
        [
          "calcular-media-mediana-moda",
          "Calcular média, moda e mediana de um conjunto de dados",
          true,
        ],
        [
          "ler-e-comparar-dados",
          "Ler tabelas e gráficos e comparar valores para decidir",
          true,
        ],
      ],
      videos: {
        GIzwKJL33_g: ["calcular-media-mediana-moda"],
        cSk6fn1J3Ig: ["calcular-media-mediana-moda", "ler-e-comparar-dados"],
      },
      questoes: [
        q("aut-mat-est-001", "calcular-media-mediana-moda", "media-simples"),
        q("aut-mat-est-002", "calcular-media-mediana-moda", "moda"),
        q("aut-mat-est-003", "calcular-media-mediana-moda", "mediana"),
        q(
          "encceja-em-nacional-2019-mat-035",
          "calcular-media-mediana-moda",
          "media-com-meta",
          "avancada",
        ),
        q(
          "encceja-em-nacional-2019-mat-053",
          "ler-e-comparar-dados",
          "leitura-e-comparacao",
        ),
        q(
          "encceja-em-nacional-2019-mat-055",
          "calcular-media-mediana-moda",
          "media-simples",
        ),
        q(
          "encceja-em-nacional-2020-mat-043",
          "ler-e-comparar-dados",
          "leitura-e-comparacao",
        ),
        q(
          "encceja-em-nacional-2020-mat-044",
          "ler-e-comparar-dados",
          "leitura-e-comparacao",
        ),
        q(
          "encceja-em-nacional-2020-mat-045",
          "calcular-media-mediana-moda",
          "media-simples",
        ),
        q(
          "encceja-em-nacional-2020-mat-054",
          "calcular-media-mediana-moda",
          "media-com-meta",
          "avancada",
        ),
        q(
          "encceja-em-nacional-2020-mat-056",
          "ler-e-comparar-dados",
          "decisao-por-criterio",
        ),
        q(
          "encceja-em-nacional-2022-mat-049",
          "ler-e-comparar-dados",
          "leitura-e-comparacao",
        ),
        q(
          "encceja-em-nacional-2022-mat-057",
          "ler-e-comparar-dados",
          "leitura-e-comparacao",
        ),
        q(
          "encceja-em-nacional-2022-mat-058",
          "calcular-media-mediana-moda",
          "media-simples",
        ),
        q(
          "encceja-em-nacional-2022-mat-059",
          "calcular-media-mediana-moda",
          "media-simples",
        ),
        q(
          "encceja-em-ppl-2020-mat-034",
          "ler-e-comparar-dados",
          "leitura-e-comparacao",
        ),
        q(
          "encceja-em-ppl-2020-mat-039",
          "calcular-media-mediana-moda",
          "media-simples",
        ),
        q(
          "encceja-em-ppl-2020-mat-042",
          "ler-e-comparar-dados",
          "decisao-por-criterio",
        ),
        q(
          "encceja-em-ppl-2020-mat-052",
          "ler-e-comparar-dados",
          "decisao-por-criterio",
        ),
        q(
          "encceja-em-ppl-2020-mat-054",
          "ler-e-comparar-dados",
          "leitura-e-comparacao",
        ),
        q(
          "encceja-em-ppl-2022-mat-031",
          "ler-e-comparar-dados",
          "leitura-e-comparacao",
        ),
        q(
          "encceja-em-ppl-2022-mat-033",
          "ler-e-comparar-dados",
          "decisao-por-criterio",
        ),
        q(
          "encceja-em-ppl-2022-mat-035",
          "calcular-media-mediana-moda",
          "media-simples",
        ),
        q(
          "encceja-em-ppl-2022-mat-041",
          "ler-e-comparar-dados",
          "leitura-e-comparacao",
        ),
        q(
          "encceja-em-ppl-2022-mat-044",
          "ler-e-comparar-dados",
          "leitura-e-comparacao",
        ),
        q(
          "encceja-em-ppl-2022-mat-045",
          "ler-e-comparar-dados",
          "decisao-por-criterio",
        ),
        q(
          "encceja-em-ppl-2022-mat-049",
          "ler-e-comparar-dados",
          "leitura-e-comparacao",
        ),
        q(
          "encceja-em-ppl-2022-mat-057",
          "calcular-media-mediana-moda",
          "media-simples",
          "avancada",
        ),
      ],
    },
    funcoes: {
      habilidades: [
        [
          "traduzir-situacao-em-funcao",
          "Escrever a expressão algébrica de uma situação do dia a dia",
          true,
        ],
        [
          "interpretar-grafico-de-funcao",
          "Escolher o gráfico que representa uma situação",
          true,
        ],
        [
          "calcular-valor-de-funcao",
          "Calcular valores e projeções a partir da função",
          false,
        ],
      ],
      videos: {
        _kbkCpoiWq4: [
          "traduzir-situacao-em-funcao",
          "interpretar-grafico-de-funcao",
        ],
        "5rz7jkOvrCc": [
          "interpretar-grafico-de-funcao",
          "calcular-valor-de-funcao",
        ],
      },
      questoes: [
        q(
          "encceja-em-nacional-2019-mat-042",
          "traduzir-situacao-em-funcao",
          "expressao-do-contexto",
        ),
        q(
          "encceja-em-nacional-2019-mat-045",
          "traduzir-situacao-em-funcao",
          "expressao-do-contexto",
        ),
        q(
          "encceja-em-nacional-2019-mat-050",
          "calcular-valor-de-funcao",
          "valor-e-projecao",
        ),
        q(
          "encceja-em-nacional-2019-mat-059",
          "interpretar-grafico-de-funcao",
          "grafico-do-contexto",
        ),
        q(
          "encceja-em-nacional-2020-mat-036",
          "interpretar-grafico-de-funcao",
          "grafico-do-contexto",
        ),
        q(
          "encceja-em-nacional-2020-mat-048",
          "calcular-valor-de-funcao",
          "valor-e-projecao",
          "avancada",
        ),
        q(
          "encceja-em-nacional-2020-mat-052",
          "traduzir-situacao-em-funcao",
          "expressao-do-contexto",
        ),
        q(
          "encceja-em-nacional-2020-mat-055",
          "traduzir-situacao-em-funcao",
          "expressao-do-contexto",
        ),
        q(
          "encceja-em-nacional-2022-mat-040",
          "calcular-valor-de-funcao",
          "valor-e-projecao",
        ),
        q(
          "encceja-em-nacional-2022-mat-046",
          "calcular-valor-de-funcao",
          "valor-e-projecao",
        ),
        q(
          "encceja-em-nacional-2022-mat-052",
          "traduzir-situacao-em-funcao",
          "expressao-do-contexto",
        ),
        q(
          "encceja-em-nacional-2022-mat-055",
          "traduzir-situacao-em-funcao",
          "expressao-do-contexto",
        ),
        q(
          "encceja-em-nacional-2022-mat-056",
          "interpretar-grafico-de-funcao",
          "grafico-do-contexto",
        ),
        q(
          "encceja-em-ppl-2020-mat-043",
          "interpretar-grafico-de-funcao",
          "grafico-do-contexto",
        ),
        q(
          "encceja-em-ppl-2020-mat-047",
          "calcular-valor-de-funcao",
          "valor-e-projecao",
        ),
        q(
          "encceja-em-ppl-2020-mat-055",
          "traduzir-situacao-em-funcao",
          "expressao-do-contexto",
        ),
        q(
          "encceja-em-ppl-2022-mat-039",
          "traduzir-situacao-em-funcao",
          "expressao-do-contexto",
        ),
        q(
          "encceja-em-ppl-2022-mat-060",
          "traduzir-situacao-em-funcao",
          "expressao-do-contexto",
        ),
      ],
    },
    "geometria-espacial": {
      habilidades: [
        [
          "identificar-solidos-e-formas",
          "Reconhecer sólidos geométricos e suas vistas",
          true,
        ],
        [
          "calcular-volume-e-capacidade",
          "Calcular volume e capacidade de sólidos",
          true,
        ],
        [
          "contar-elementos-do-solido",
          "Contar faces, vértices e arestas de sólidos",
          false,
        ],
      ],
      videos: {
        d6ky8uyGkBI: ["calcular-volume-e-capacidade"],
        UYIK18dih00: [
          "calcular-volume-e-capacidade",
          "identificar-solidos-e-formas",
        ],
      },
      questoes: [
        q(
          "encceja-em-nacional-2019-mat-031",
          "identificar-solidos-e-formas",
          "identificar-forma",
        ),
        q(
          "encceja-em-nacional-2020-mat-033",
          "identificar-solidos-e-formas",
          "projecao-e-vista",
        ),
        q(
          "encceja-em-nacional-2020-mat-034",
          "identificar-solidos-e-formas",
          "identificar-forma",
        ),
        q(
          "encceja-em-nacional-2020-mat-046",
          "calcular-volume-e-capacidade",
          "volume-e-capacidade",
        ),
        q(
          "encceja-em-ppl-2020-mat-051",
          "calcular-volume-e-capacidade",
          "volume-e-capacidade",
        ),
        q(
          "encceja-em-ppl-2020-mat-056",
          "contar-elementos-do-solido",
          "faces-vertices-e-arestas",
        ),
        q(
          "encceja-em-ppl-2022-mat-036",
          "contar-elementos-do-solido",
          "faces-vertices-e-arestas",
          "avancada",
        ),
        q(
          "encceja-em-ppl-2022-mat-054",
          "calcular-volume-e-capacidade",
          "volume-e-capacidade",
          "avancada",
        ),
        q(
          "encceja-em-ppl-2022-mat-058",
          "contar-elementos-do-solido",
          "faces-vertices-e-arestas",
        ),
      ],
    },
    "geometria-plana": {
      habilidades: [
        [
          "calcular-area-e-perimetro",
          "Calcular área e perímetro em situações práticas",
          true,
        ],
        [
          "medir-angulos-e-figuras",
          "Medir ângulos e partes de figuras planas",
          true,
        ],
        [
          "posicionar-figuras-e-trajetos",
          "Ler posição, vistas e trajetos em figuras",
          false,
        ],
      ],
      videos: {
        aIKxhaxynJ8: ["calcular-area-e-perimetro"],
        PalDzybqElQ: ["calcular-area-e-perimetro", "medir-angulos-e-figuras"],
      },
      questoes: [
        q("aut-mat-geo-001", "calcular-area-e-perimetro", "area-e-perimetro"),
        q("aut-mat-geo-002", "calcular-area-e-perimetro", "area-e-perimetro"),
        q("aut-mat-geo-003", "calcular-area-e-perimetro", "area-e-perimetro"),
        q(
          "encceja-em-nacional-2019-mat-036",
          "posicionar-figuras-e-trajetos",
          "posicao-e-trajeto",
        ),
        q(
          "encceja-em-nacional-2019-mat-043",
          "medir-angulos-e-figuras",
          "angulos",
          "avancada",
        ),
        q(
          "encceja-em-nacional-2019-mat-049",
          "calcular-area-e-perimetro",
          "area-e-perimetro",
        ),
        q(
          "encceja-em-nacional-2019-mat-054",
          "posicionar-figuras-e-trajetos",
          "posicao-e-trajeto",
        ),
        q(
          "encceja-em-nacional-2019-mat-058",
          "medir-angulos-e-figuras",
          "angulos",
        ),
        q(
          "encceja-em-nacional-2020-mat-039",
          "medir-angulos-e-figuras",
          "medidas-figura",
        ),
        q(
          "encceja-em-nacional-2020-mat-041",
          "posicionar-figuras-e-trajetos",
          "posicao-e-trajeto",
        ),
        q(
          "encceja-em-nacional-2020-mat-053",
          "medir-angulos-e-figuras",
          "angulos",
        ),
        q(
          "encceja-em-nacional-2022-mat-041",
          "medir-angulos-e-figuras",
          "medidas-figura",
        ),
        q(
          "encceja-em-nacional-2022-mat-042",
          "posicionar-figuras-e-trajetos",
          "posicao-e-trajeto",
        ),
        q(
          "encceja-em-nacional-2022-mat-044",
          "medir-angulos-e-figuras",
          "angulos",
        ),
        q(
          "encceja-em-nacional-2022-mat-045",
          "medir-angulos-e-figuras",
          "medidas-figura",
        ),
        q(
          "encceja-em-nacional-2022-mat-048",
          "medir-angulos-e-figuras",
          "medidas-figura",
          "avancada",
        ),
        q(
          "encceja-em-nacional-2022-mat-050",
          "calcular-area-e-perimetro",
          "area-e-perimetro",
        ),
        q(
          "encceja-em-ppl-2020-mat-037",
          "posicionar-figuras-e-trajetos",
          "posicao-e-trajeto",
        ),
        q(
          "encceja-em-ppl-2020-mat-040",
          "calcular-area-e-perimetro",
          "area-e-perimetro",
          "avancada",
        ),
        q(
          "encceja-em-ppl-2020-mat-044",
          "posicionar-figuras-e-trajetos",
          "posicao-e-trajeto",
        ),
        q(
          "encceja-em-ppl-2020-mat-059",
          "medir-angulos-e-figuras",
          "medidas-figura",
          "avancada",
        ),
        q(
          "encceja-em-ppl-2022-mat-042",
          "medir-angulos-e-figuras",
          "medidas-figura",
        ),
        q(
          "encceja-em-ppl-2022-mat-048",
          "calcular-area-e-perimetro",
          "area-e-perimetro",
        ),
      ],
    },
    "grandezas-e-medidas": {
      habilidades: [
        ["converter-unidades", "Converter entre unidades de medida", true],
        ["usar-escala", "Usar escala em mapas e plantas", true],
        [
          "calcular-com-unidades",
          "Fazer contas mantendo as unidades corretas",
          false,
        ],
      ],
      videos: {
        IQHZeOryTNQ: ["converter-unidades", "usar-escala"],
        UYIK18dih00: ["converter-unidades"],
      },
      questoes: [
        q(
          "encceja-em-nacional-2019-mat-032",
          "calcular-com-unidades",
          "calculo-com-medidas",
        ),
        q(
          "encceja-em-nacional-2019-mat-033",
          "converter-unidades",
          "conversao-de-unidades",
        ),
        q(
          "encceja-em-nacional-2019-mat-037",
          "calcular-com-unidades",
          "calculo-com-medidas",
        ),
        q(
          "encceja-em-nacional-2019-mat-040",
          "converter-unidades",
          "conversao-de-unidades",
        ),
        q("encceja-em-nacional-2019-mat-051", "usar-escala", "escala-e-planta"),
        q(
          "encceja-em-nacional-2020-mat-031",
          "converter-unidades",
          "conversao-de-unidades",
        ),
        q(
          "encceja-em-nacional-2020-mat-040",
          "converter-unidades",
          "conversao-de-unidades",
        ),
        q(
          "encceja-em-nacional-2020-mat-051",
          "calcular-com-unidades",
          "calculo-com-medidas",
        ),
        q("encceja-em-nacional-2020-mat-060", "usar-escala", "escala-e-planta"),
        q(
          "encceja-em-nacional-2022-mat-031",
          "converter-unidades",
          "conversao-de-unidades",
        ),
        q(
          "encceja-em-nacional-2022-mat-033",
          "calcular-com-unidades",
          "calculo-com-medidas",
        ),
        q(
          "encceja-em-nacional-2022-mat-038",
          "calcular-com-unidades",
          "calculo-com-medidas",
        ),
        q("encceja-em-nacional-2022-mat-047", "usar-escala", "escala-e-planta"),
        q(
          "encceja-em-ppl-2020-mat-036",
          "calcular-com-unidades",
          "calculo-com-medidas",
        ),
        q(
          "encceja-em-ppl-2020-mat-038",
          "usar-escala",
          "escala-e-planta",
          "avancada",
        ),
        q(
          "encceja-em-ppl-2020-mat-053",
          "calcular-com-unidades",
          "calculo-com-medidas",
          "avancada",
        ),
        q(
          "encceja-em-ppl-2020-mat-060",
          "converter-unidades",
          "conversao-de-unidades",
        ),
        q("encceja-em-ppl-2022-mat-034", "usar-escala", "escala-e-planta"),
      ],
    },
    "numeros-e-operacoes": {
      habilidades: [
        [
          "operacoes-com-numeros",
          "Usar as quatro operações no dia a dia",
          true,
        ],
        [
          "comparar-precos-e-planos",
          "Comparar preços e planos para economizar",
          true,
        ],
        [
          "representar-numeros",
          "Ler e representar números (fração, decimal, posicional)",
          false,
        ],
      ],
      videos: {
        hTL9IHLORj4: ["operacoes-com-numeros"],
        k72XW_wdtvA: ["operacoes-com-numeros", "representar-numeros"],
      },
      questoes: [
        q(
          "encceja-em-nacional-2019-mat-039",
          "operacoes-com-numeros",
          "operacoes-do-dia-a-dia",
        ),
        q(
          "encceja-em-nacional-2019-mat-048",
          "representar-numeros",
          "representar-e-ler-numeros",
        ),
        q(
          "encceja-em-nacional-2019-mat-052",
          "comparar-precos-e-planos",
          "comparar-precos-e-planos",
        ),
        q(
          "encceja-em-nacional-2020-mat-037",
          "comparar-precos-e-planos",
          "comparar-precos-e-planos",
        ),
        q(
          "encceja-em-nacional-2020-mat-047",
          "operacoes-com-numeros",
          "divisao-e-organizacao",
        ),
        q(
          "encceja-em-nacional-2022-mat-032",
          "representar-numeros",
          "representar-e-ler-numeros",
        ),
        q(
          "encceja-em-nacional-2022-mat-034",
          "representar-numeros",
          "representar-e-ler-numeros",
        ),
        q(
          "encceja-em-nacional-2022-mat-036",
          "operacoes-com-numeros",
          "operacoes-do-dia-a-dia",
        ),
        q(
          "encceja-em-nacional-2022-mat-039",
          "operacoes-com-numeros",
          "operacoes-do-dia-a-dia",
        ),
        q(
          "encceja-em-nacional-2022-mat-051",
          "comparar-precos-e-planos",
          "comparar-precos-e-planos",
        ),
        q(
          "encceja-em-nacional-2022-mat-053",
          "operacoes-com-numeros",
          "divisao-e-organizacao",
        ),
        q(
          "encceja-em-ppl-2020-mat-031",
          "representar-numeros",
          "representar-e-ler-numeros",
        ),
        q(
          "encceja-em-ppl-2020-mat-035",
          "operacoes-com-numeros",
          "operacoes-do-dia-a-dia",
        ),
        q(
          "encceja-em-ppl-2020-mat-041",
          "representar-numeros",
          "representar-e-ler-numeros",
        ),
        q(
          "encceja-em-ppl-2020-mat-045",
          "comparar-precos-e-planos",
          "comparar-precos-e-planos",
        ),
        q(
          "encceja-em-ppl-2020-mat-049",
          "representar-numeros",
          "representar-e-ler-numeros",
        ),
        q(
          "encceja-em-ppl-2020-mat-057",
          "comparar-precos-e-planos",
          "comparar-precos-e-planos",
        ),
        q(
          "encceja-em-ppl-2022-mat-032",
          "representar-numeros",
          "representar-e-ler-numeros",
        ),
        q(
          "encceja-em-ppl-2022-mat-038",
          "operacoes-com-numeros",
          "operacoes-do-dia-a-dia",
        ),
        q(
          "encceja-em-ppl-2022-mat-040",
          "comparar-precos-e-planos",
          "comparar-precos-e-planos",
        ),
        q(
          "encceja-em-ppl-2022-mat-046",
          "comparar-precos-e-planos",
          "comparar-precos-e-planos",
        ),
        q(
          "encceja-em-ppl-2022-mat-050",
          "operacoes-com-numeros",
          "operacoes-do-dia-a-dia",
        ),
        q(
          "encceja-em-ppl-2022-mat-052",
          "representar-numeros",
          "representar-e-ler-numeros",
        ),
        q(
          "encceja-em-ppl-2022-mat-059",
          "operacoes-com-numeros",
          "operacoes-do-dia-a-dia",
        ),
      ],
    },
    "porcentagem-e-proporcao": {
      habilidades: [
        [
          "calcular-porcentagem",
          "Calcular porcentagem, desconto, aumento e juros",
          true,
        ],
        ["usar-regra-de-tres", "Usar regra de três direta e inversa", true],
        [
          "comparar-porcentagens",
          "Comparar preços e percentuais entre opções",
          false,
        ],
      ],
      videos: {
        OjOyNmTt7Mw: ["calcular-porcentagem"],
        Qt1CTaMBNnM: ["usar-regra-de-tres", "calcular-porcentagem"],
      },
      questoes: [
        q("aut-mat-por-001", "calcular-porcentagem", "porcentagem-direta"),
        q("aut-mat-por-002", "usar-regra-de-tres", "regra-de-tres"),
        q("aut-mat-por-003", "comparar-porcentagens", "comparar-precos"),
        q(
          "encceja-em-nacional-2019-mat-034",
          "calcular-porcentagem",
          "lucro-e-preco",
          "avancada",
        ),
        q(
          "encceja-em-nacional-2019-mat-041",
          "comparar-porcentagens",
          "comparar-precos",
        ),
        q(
          "encceja-em-nacional-2019-mat-044",
          "calcular-porcentagem",
          "porcentagem-direta",
        ),
        q(
          "encceja-em-nacional-2019-mat-056",
          "comparar-porcentagens",
          "comparar-precos",
        ),
        q(
          "encceja-em-nacional-2019-mat-057",
          "calcular-porcentagem",
          "porcentagem-direta",
        ),
        q(
          "encceja-em-nacional-2019-mat-060",
          "calcular-porcentagem",
          "porcentagem-direta",
        ),
        q(
          "encceja-em-nacional-2020-mat-032",
          "calcular-porcentagem",
          "porcentagem-direta",
        ),
        q(
          "encceja-em-nacional-2020-mat-035",
          "calcular-porcentagem",
          "porcentagem-direta",
        ),
        q(
          "encceja-em-nacional-2020-mat-038",
          "usar-regra-de-tres",
          "regra-de-tres",
        ),
        q(
          "encceja-em-nacional-2020-mat-042",
          "comparar-porcentagens",
          "comparar-percentuais",
        ),
        q(
          "encceja-em-nacional-2020-mat-049",
          "usar-regra-de-tres",
          "regra-de-tres",
        ),
        q(
          "encceja-em-nacional-2020-mat-058",
          "comparar-porcentagens",
          "comparar-precos",
        ),
        q(
          "encceja-em-nacional-2020-mat-059",
          "usar-regra-de-tres",
          "regra-de-tres-inversa",
          "avancada",
        ),
        q(
          "encceja-em-nacional-2022-mat-035",
          "usar-regra-de-tres",
          "regra-de-tres",
        ),
        q(
          "encceja-em-nacional-2022-mat-037",
          "calcular-porcentagem",
          "juros-e-taxa",
        ),
        q(
          "encceja-em-nacional-2022-mat-054",
          "calcular-porcentagem",
          "lucro-e-preco",
        ),
        q(
          "encceja-em-ppl-2020-mat-032",
          "calcular-porcentagem",
          "juros-e-taxa",
          "avancada",
        ),
        q(
          "encceja-em-ppl-2020-mat-033",
          "calcular-porcentagem",
          "porcentagem-direta",
        ),
        q(
          "encceja-em-ppl-2020-mat-046",
          "comparar-porcentagens",
          "comparar-precos",
        ),
        q(
          "encceja-em-ppl-2020-mat-058",
          "comparar-porcentagens",
          "comparar-percentuais",
          "avancada",
        ),
        q(
          "encceja-em-ppl-2022-mat-037",
          "comparar-porcentagens",
          "comparar-precos",
        ),
        q(
          "encceja-em-ppl-2022-mat-051",
          "calcular-porcentagem",
          "porcentagem-direta",
        ),
        q(
          "encceja-em-ppl-2022-mat-053",
          "calcular-porcentagem",
          "lucro-e-preco",
        ),
        q(
          "encceja-em-ppl-2022-mat-055",
          "comparar-porcentagens",
          "comparar-percentuais",
        ),
        q(
          "encceja-em-ppl-2022-mat-056",
          "calcular-porcentagem",
          "porcentagem-direta",
        ),
      ],
    },
    "probabilidade-e-contagem": {
      habilidades: [
        ["calcular-probabilidade", "Calcular probabilidade de um evento", true],
        [
          "contar-agrupamentos",
          "Contar agrupamentos e combinações possíveis",
          false,
        ],
      ],
      videos: {
        THkQvksYZjs: ["calcular-probabilidade"],
        N1iXSpirpDE: ["contar-agrupamentos"],
      },
      questoes: [
        q(
          "encceja-em-nacional-2019-mat-047",
          "contar-agrupamentos",
          "contagem",
        ),
        q(
          "encceja-em-nacional-2020-mat-050",
          "calcular-probabilidade",
          "probabilidade-simples",
        ),
        q(
          "encceja-em-nacional-2020-mat-057",
          "calcular-probabilidade",
          "probabilidade-simples",
        ),
        q(
          "encceja-em-nacional-2022-mat-043",
          "calcular-probabilidade",
          "probabilidade-simples",
        ),
        q(
          "encceja-em-nacional-2022-mat-060",
          "calcular-probabilidade",
          "probabilidade-com-meta",
          "avancada",
        ),
        q(
          "encceja-em-ppl-2020-mat-050",
          "calcular-probabilidade",
          "probabilidade-com-meta",
          "avancada",
        ),
        q("encceja-em-ppl-2022-mat-043", "contar-agrupamentos", "contagem"),
      ],
    },
  },
};

// ============================= LINGUAGENS (EM) =============================
const LING = {
  disciplina: "linguagens",
  tipoPadrao: "interpretacao",
  temas: {
    arte: {
      habilidades: [
        [
          "analisar-obra-artistica",
          "Analisar o sentido de obras e imagens artísticas",
          true,
        ],
        [
          "relacionar-arte-e-contexto",
          "Relacionar arte e contexto social e histórico",
          false,
        ],
      ],
      videos: {
        ksblph0NNNM: ["analisar-obra-artistica"],
        JShfqng4lGU: ["relacionar-arte-e-contexto"],
      },
      questoes: [
        q(
          "encceja-em-nacional-2019-ling-013",
          "analisar-obra-artistica",
          "sentido-da-obra",
        ),
        q(
          "encceja-em-nacional-2020-ling-008",
          "relacionar-arte-e-contexto",
          "arte-e-sociedade",
        ),
        q(
          "encceja-em-nacional-2020-ling-009",
          "analisar-obra-artistica",
          "sentido-da-obra",
        ),
        q(
          "encceja-em-nacional-2020-ling-010",
          "analisar-obra-artistica",
          "sentido-da-obra",
        ),
        q(
          "encceja-em-nacional-2020-ling-019",
          "relacionar-arte-e-contexto",
          "arte-e-sociedade",
        ),
        q(
          "encceja-em-nacional-2022-ling-010",
          "relacionar-arte-e-contexto",
          "arte-e-sociedade",
        ),
        q(
          "encceja-em-nacional-2022-ling-011",
          "relacionar-arte-e-contexto",
          "arte-e-sociedade",
        ),
        q(
          "encceja-em-nacional-2022-ling-024",
          "analisar-obra-artistica",
          "sentido-da-obra",
        ),
        q(
          "encceja-em-ppl-2020-ling-005",
          "relacionar-arte-e-contexto",
          "arte-e-sociedade",
        ),
        q(
          "encceja-em-ppl-2020-ling-029",
          "relacionar-arte-e-contexto",
          "arte-e-sociedade",
        ),
        q(
          "encceja-em-ppl-2020-ling-030",
          "relacionar-arte-e-contexto",
          "arte-e-sociedade",
        ),
        q(
          "encceja-em-ppl-2022-ling-002",
          "relacionar-arte-e-contexto",
          "arte-e-sociedade",
        ),
        q(
          "encceja-em-ppl-2022-ling-003",
          "analisar-obra-artistica",
          "sentido-da-obra",
        ),
        q(
          "encceja-em-ppl-2022-ling-018",
          "analisar-obra-artistica",
          "sentido-da-obra",
        ),
      ],
    },
    "comunicacao-e-midias": {
      habilidades: [
        [
          "analisar-texto-publicitario",
          "Analisar propagandas, cartazes e recursos de persuasão",
          true,
        ],
        [
          "refletir-sobre-midias-digitais",
          "Refletir sobre o impacto das mídias e da internet",
          true,
        ],
        [
          "identificar-finalidade-do-texto",
          "Identificar a finalidade de um texto",
          false,
        ],
      ],
      videos: {
        "32t-A3lIO2s": ["analisar-texto-publicitario"],
        JShfqng4lGU: ["refletir-sobre-midias-digitais"],
      },
      questoes: [
        q(
          "encceja-em-nacional-2019-ling-003",
          "identificar-finalidade-do-texto",
          "finalidade-do-texto",
        ),
        q(
          "encceja-em-nacional-2019-ling-021",
          "analisar-texto-publicitario",
          "persuasao-e-recurso",
        ),
        q(
          "encceja-em-nacional-2019-ling-022",
          "analisar-texto-publicitario",
          "persuasao-e-recurso",
        ),
        q(
          "encceja-em-nacional-2019-ling-025",
          "identificar-finalidade-do-texto",
          "finalidade-do-texto",
        ),
        q(
          "encceja-em-nacional-2019-ling-028",
          "refletir-sobre-midias-digitais",
          "impacto-das-midias",
        ),
        q(
          "encceja-em-nacional-2019-ling-029",
          "refletir-sobre-midias-digitais",
          "impacto-das-midias",
        ),
        q(
          "encceja-em-nacional-2019-ling-030",
          "analisar-texto-publicitario",
          "persuasao-e-recurso",
        ),
        q(
          "encceja-em-nacional-2020-ling-016",
          "identificar-finalidade-do-texto",
          "finalidade-do-texto",
        ),
        q(
          "encceja-em-nacional-2020-ling-020",
          "analisar-texto-publicitario",
          "critica-no-cartum",
        ),
        q(
          "encceja-em-nacional-2020-ling-029",
          "identificar-finalidade-do-texto",
          "finalidade-do-texto",
        ),
        q(
          "encceja-em-nacional-2022-ling-009",
          "refletir-sobre-midias-digitais",
          "impacto-das-midias",
        ),
        q(
          "encceja-em-nacional-2022-ling-012",
          "identificar-finalidade-do-texto",
          "finalidade-do-texto",
        ),
        q(
          "encceja-em-nacional-2022-ling-014",
          "refletir-sobre-midias-digitais",
          "impacto-das-midias",
        ),
        q(
          "encceja-em-nacional-2022-ling-021",
          "refletir-sobre-midias-digitais",
          "impacto-das-midias",
        ),
        q(
          "encceja-em-nacional-2022-ling-028",
          "analisar-texto-publicitario",
          "critica-no-cartum",
        ),
        q(
          "encceja-em-nacional-2022-ling-030",
          "analisar-texto-publicitario",
          "persuasao-e-recurso",
        ),
        q(
          "encceja-em-ppl-2020-ling-012",
          "analisar-texto-publicitario",
          "persuasao-e-recurso",
        ),
        q(
          "encceja-em-ppl-2020-ling-018",
          "analisar-texto-publicitario",
          "persuasao-e-recurso",
        ),
        q(
          "encceja-em-ppl-2020-ling-023",
          "identificar-finalidade-do-texto",
          "finalidade-do-texto",
        ),
        q(
          "encceja-em-ppl-2020-ling-027",
          "identificar-finalidade-do-texto",
          "finalidade-do-texto",
        ),
        q(
          "encceja-em-ppl-2020-ling-028",
          "refletir-sobre-midias-digitais",
          "impacto-das-midias",
        ),
        q(
          "encceja-em-ppl-2022-ling-001",
          "identificar-finalidade-do-texto",
          "finalidade-do-texto",
        ),
        q(
          "encceja-em-ppl-2022-ling-007",
          "analisar-texto-publicitario",
          "verbale-nao-verbal",
        ),
        q(
          "encceja-em-ppl-2022-ling-010",
          "identificar-finalidade-do-texto",
          "finalidade-do-texto",
        ),
        q(
          "encceja-em-ppl-2022-ling-022",
          "refletir-sobre-midias-digitais",
          "impacto-das-midias",
        ),
        q(
          "encceja-em-ppl-2022-ling-024",
          "refletir-sobre-midias-digitais",
          "impacto-das-midias",
        ),
        q(
          "encceja-em-ppl-2022-ling-028",
          "analisar-texto-publicitario",
          "persuasao-e-recurso",
        ),
      ],
    },
    "educacao-fisica": {
      habilidades: [
        [
          "entender-texto-sobre-esporte-e-saude",
          "Entender textos sobre esporte, saúde e corpo",
          true,
        ],
      ],
      videos: {
        "1ldFZtxknhk": ["entender-texto-sobre-esporte-e-saude"],
        NxCtyHFVJko: ["entender-texto-sobre-esporte-e-saude"],
      },
      questoes: [
        q(
          "encceja-em-nacional-2020-ling-001",
          "entender-texto-sobre-esporte-e-saude",
          "esporte-e-sociedade",
        ),
        q(
          "encceja-em-nacional-2020-ling-002",
          "entender-texto-sobre-esporte-e-saude",
          "saude-e-corpo",
        ),
        q(
          "encceja-em-nacional-2020-ling-003",
          "entender-texto-sobre-esporte-e-saude",
          "saude-e-corpo",
        ),
        q(
          "encceja-em-nacional-2022-ling-018",
          "entender-texto-sobre-esporte-e-saude",
          "esporte-e-sociedade",
        ),
        q(
          "encceja-em-nacional-2022-ling-020",
          "entender-texto-sobre-esporte-e-saude",
          "informacao-e-rotulo",
        ),
        q(
          "encceja-em-nacional-2022-ling-022",
          "entender-texto-sobre-esporte-e-saude",
          "informacao-e-rotulo",
        ),
        q(
          "encceja-em-nacional-2022-ling-029",
          "entender-texto-sobre-esporte-e-saude",
          "saude-e-corpo",
        ),
        q(
          "encceja-em-ppl-2020-ling-009",
          "entender-texto-sobre-esporte-e-saude",
          "saude-e-corpo",
        ),
        q(
          "encceja-em-ppl-2020-ling-010",
          "entender-texto-sobre-esporte-e-saude",
          "saude-e-corpo",
        ),
        q(
          "encceja-em-ppl-2020-ling-011",
          "entender-texto-sobre-esporte-e-saude",
          "saude-e-corpo",
        ),
        q(
          "encceja-em-ppl-2022-ling-004",
          "entender-texto-sobre-esporte-e-saude",
          "saude-e-corpo",
        ),
        q(
          "encceja-em-ppl-2022-ling-026",
          "entender-texto-sobre-esporte-e-saude",
          "esporte-e-sociedade",
        ),
        q(
          "encceja-em-ppl-2022-ling-029",
          "entender-texto-sobre-esporte-e-saude",
          "esporte-e-sociedade",
        ),
      ],
    },
    "generos-textuais": {
      habilidades: [
        [
          "reconhecer-genero-textual",
          "Reconhecer o gênero de um texto pelas características",
          true,
        ],
        [
          "identificar-finalidade-do-genero",
          "Identificar para que serve cada gênero textual",
          false,
        ],
      ],
      videos: {
        "7J_VPmdqdwM": ["reconhecer-genero-textual"],
        "1LKtJ1aOAc0": [
          "reconhecer-genero-textual",
          "identificar-finalidade-do-genero",
        ],
      },
      questoes: [
        q(
          "aut-pt-gen-001",
          "identificar-finalidade-do-genero",
          "finalidade-do-genero",
        ),
        q("aut-pt-gen-002", "reconhecer-genero-textual", "caracterizar-genero"),
        q(
          "aut-pt-gen-003",
          "identificar-finalidade-do-genero",
          "finalidade-do-genero",
        ),
        q(
          "encceja-em-nacional-2019-ling-001",
          "reconhecer-genero-textual",
          "caracterizar-genero",
        ),
        q(
          "encceja-em-nacional-2019-ling-004",
          "identificar-finalidade-do-genero",
          "finalidade-do-genero",
        ),
        q(
          "encceja-em-nacional-2020-ling-021",
          "reconhecer-genero-textual",
          "caracterizar-genero",
        ),
        q(
          "encceja-em-nacional-2020-ling-024",
          "reconhecer-genero-textual",
          "caracterizar-genero",
        ),
        q(
          "encceja-em-nacional-2022-ling-003",
          "reconhecer-genero-textual",
          "caracterizar-genero",
        ),
        q(
          "encceja-em-nacional-2022-ling-008",
          "reconhecer-genero-textual",
          "caracterizar-genero",
        ),
        q(
          "encceja-em-ppl-2020-ling-013",
          "identificar-finalidade-do-genero",
          "finalidade-do-genero",
        ),
        q(
          "encceja-em-ppl-2020-ling-016",
          "identificar-finalidade-do-genero",
          "finalidade-do-genero",
        ),
        q(
          "encceja-em-ppl-2020-ling-021",
          "identificar-finalidade-do-genero",
          "finalidade-do-genero",
        ),
        q(
          "encceja-em-ppl-2022-ling-005",
          "identificar-finalidade-do-genero",
          "finalidade-do-genero",
        ),
        q(
          "encceja-em-ppl-2022-ling-009",
          "identificar-finalidade-do-genero",
          "finalidade-do-genero",
        ),
        q(
          "encceja-em-ppl-2022-ling-011",
          "identificar-finalidade-do-genero",
          "finalidade-do-genero",
        ),
        q(
          "encceja-em-ppl-2022-ling-012",
          "reconhecer-genero-textual",
          "caracterizar-genero",
        ),
        q(
          "encceja-em-ppl-2022-ling-017",
          "identificar-finalidade-do-genero",
          "finalidade-do-genero",
        ),
      ],
    },
    gramatica: {
      habilidades: [
        [
          "reconhecer-conectivos-e-coesao",
          "Reconhecer o papel de conectivos na coesão do texto",
          true,
        ],
        [
          "interpretar-referentes",
          "Identificar o que uma palavra retoma ou expressa",
          false,
        ],
      ],
      videos: {
        IIU6i3UXyi0: ["reconhecer-conectivos-e-coesao"],
        eehRPa7e8T4: [
          "reconhecer-conectivos-e-coesao",
          "interpretar-referentes",
        ],
      },
      questoes: [
        q("aut-pt-gra-001", "reconhecer-conectivos-e-coesao", "conectivos"),
        q("aut-pt-gra-002", "interpretar-referentes", "referentes-e-funcao"),
        q("aut-pt-gra-003", "reconhecer-conectivos-e-coesao", "conectivos"),
        q(
          "encceja-em-nacional-2019-ling-018",
          "reconhecer-conectivos-e-coesao",
          "conectivos",
        ),
        q(
          "encceja-em-nacional-2022-ling-025",
          "reconhecer-conectivos-e-coesao",
          "conectivos",
        ),
        q(
          "encceja-em-ppl-2020-ling-015",
          "reconhecer-conectivos-e-coesao",
          "conectivos",
        ),
        q(
          "encceja-em-ppl-2022-ling-025",
          "interpretar-referentes",
          "referentes-e-funcao",
        ),
      ],
    },
    "interpretacao-de-texto": {
      habilidades: [
        [
          "compreender-ideia-central",
          "Compreender a ideia central e as informações do texto",
          true,
        ],
        [
          "inferir-sentido-e-intencao",
          "Inferir sentido e intenção além do que está escrito",
          true,
        ],
        [
          "reconhecer-estrategia-argumentativa",
          "Reconhecer estratégias usadas para convencer",
          false,
        ],
      ],
      videos: {
        nkcQjccZr3g: [
          "compreender-ideia-central",
          "inferir-sentido-e-intencao",
        ],
        y5jvOIM3XNo: [
          "compreender-ideia-central",
          "inferir-sentido-e-intencao",
        ],
      },
      questoes: [
        q("aut-pt-int-001", "compreender-ideia-central", "ideia-central"),
        q("aut-pt-int-002", "compreender-ideia-central", "ideia-central"),
        q(
          "aut-pt-int-003",
          "inferir-sentido-e-intencao",
          "inferencia-e-intencao",
        ),
        q(
          "encceja-em-nacional-2019-ling-002",
          "inferir-sentido-e-intencao",
          "inferencia-e-intencao",
        ),
        q(
          "encceja-em-nacional-2019-ling-009",
          "inferir-sentido-e-intencao",
          "inferencia-e-intencao",
        ),
        q(
          "encceja-em-nacional-2019-ling-010",
          "inferir-sentido-e-intencao",
          "inferencia-e-intencao",
        ),
        q(
          "encceja-em-nacional-2019-ling-011",
          "compreender-ideia-central",
          "ideia-central",
        ),
        q(
          "encceja-em-nacional-2019-ling-019",
          "inferir-sentido-e-intencao",
          "inferencia-e-intencao",
        ),
        q(
          "encceja-em-nacional-2019-ling-023",
          "inferir-sentido-e-intencao",
          "inferencia-e-intencao",
        ),
        q(
          "encceja-em-nacional-2019-ling-024",
          "compreender-ideia-central",
          "ideia-central",
        ),
        q(
          "encceja-em-nacional-2020-ling-015",
          "inferir-sentido-e-intencao",
          "inferencia-e-intencao",
        ),
        q(
          "encceja-em-nacional-2020-ling-017",
          "reconhecer-estrategia-argumentativa",
          "estrategia-argumentativa",
        ),
        q(
          "encceja-em-nacional-2020-ling-022",
          "reconhecer-estrategia-argumentativa",
          "estrategia-argumentativa",
        ),
        q(
          "encceja-em-nacional-2020-ling-027",
          "compreender-ideia-central",
          "ideia-central",
        ),
        q(
          "encceja-em-nacional-2020-ling-030",
          "compreender-ideia-central",
          "ideia-central",
        ),
        q(
          "encceja-em-nacional-2022-ling-019",
          "compreender-ideia-central",
          "ideia-central",
        ),
        q(
          "encceja-em-nacional-2022-ling-026",
          "inferir-sentido-e-intencao",
          "inferencia-e-intencao",
        ),
        q(
          "encceja-em-nacional-2022-ling-027",
          "inferir-sentido-e-intencao",
          "inferencia-e-intencao",
        ),
        q(
          "encceja-em-ppl-2020-ling-014",
          "compreender-ideia-central",
          "ideia-central",
        ),
        q(
          "encceja-em-ppl-2020-ling-019",
          "compreender-ideia-central",
          "ideia-central",
        ),
        q(
          "encceja-em-ppl-2020-ling-020",
          "compreender-ideia-central",
          "ideia-central",
        ),
        q(
          "encceja-em-ppl-2020-ling-022",
          "inferir-sentido-e-intencao",
          "inferencia-e-intencao",
        ),
        q(
          "encceja-em-ppl-2020-ling-024",
          "reconhecer-estrategia-argumentativa",
          "estrategia-argumentativa",
        ),
        q(
          "encceja-em-ppl-2022-ling-006",
          "reconhecer-estrategia-argumentativa",
          "estrategia-argumentativa",
        ),
      ],
    },
    "lingua-espanhola": {
      habilidades: [
        [
          "interpretar-texto-em-espanhol",
          "Interpretar a ideia e a finalidade de textos em espanhol",
          true,
        ],
        [
          "reconhecer-vocabulo-em-espanhol",
          "Reconhecer palavras e expressões em espanhol",
          false,
        ],
      ],
      videos: {
        u9D13J8CUDU: ["interpretar-texto-em-espanhol"],
        "4J_dYPUMFsM": [
          "interpretar-texto-em-espanhol",
          "reconhecer-vocabulo-em-espanhol",
        ],
      },
      questoes: [
        q(
          "encceja-em-nacional-2019-ling-005",
          "interpretar-texto-em-espanhol",
          "finalidade-e-ideia-es",
        ),
        q(
          "encceja-em-nacional-2019-ling-006",
          "interpretar-texto-em-espanhol",
          "finalidade-e-ideia-es",
        ),
        q(
          "encceja-em-nacional-2019-ling-007",
          "interpretar-texto-em-espanhol",
          "finalidade-e-ideia-es",
        ),
        q(
          "encceja-em-nacional-2020-ling-004",
          "reconhecer-vocabulo-em-espanhol",
          "palavras-e-expressoes-es",
        ),
        q(
          "encceja-em-nacional-2020-ling-006",
          "interpretar-texto-em-espanhol",
          "finalidade-e-ideia-es",
        ),
        q(
          "encceja-em-nacional-2022-ling-002",
          "interpretar-texto-em-espanhol",
          "finalidade-e-ideia-es",
        ),
        q(
          "encceja-em-nacional-2022-ling-023",
          "reconhecer-vocabulo-em-espanhol",
          "palavras-e-expressoes-es",
        ),
        q(
          "encceja-em-ppl-2020-ling-002",
          "interpretar-texto-em-espanhol",
          "finalidade-e-ideia-es",
        ),
        q(
          "encceja-em-ppl-2020-ling-004",
          "interpretar-texto-em-espanhol",
          "finalidade-e-ideia-es",
        ),
        q(
          "encceja-em-ppl-2022-ling-008",
          "interpretar-texto-em-espanhol",
          "finalidade-e-ideia-es",
        ),
        q(
          "encceja-em-ppl-2022-ling-019",
          "reconhecer-vocabulo-em-espanhol",
          "palavras-e-expressoes-es",
        ),
        q(
          "encceja-em-ppl-2022-ling-021",
          "interpretar-texto-em-espanhol",
          "finalidade-e-ideia-es",
        ),
      ],
    },
    "lingua-inglesa": {
      habilidades: [
        [
          "interpretar-texto-em-ingles",
          "Interpretar a ideia e a finalidade de textos em inglês",
          true,
        ],
        [
          "reconhecer-vocabulo-em-ingles",
          "Reconhecer palavras e expressões em inglês",
          false,
        ],
      ],
      videos: {
        SKK_Q3RJqh0: ["reconhecer-vocabulo-em-ingles"],
        uAoYxzKtKZw: ["interpretar-texto-em-ingles"],
      },
      questoes: [
        q(
          "encceja-em-nacional-2019-ling-008",
          "interpretar-texto-em-ingles",
          "finalidade-e-ideia-in",
        ),
        q(
          "encceja-em-nacional-2020-ling-005",
          "interpretar-texto-em-ingles",
          "finalidade-e-ideia-in",
        ),
        q(
          "encceja-em-nacional-2020-ling-007",
          "interpretar-texto-em-ingles",
          "finalidade-e-ideia-in",
        ),
        q(
          "encceja-em-nacional-2022-ling-006",
          "interpretar-texto-em-ingles",
          "finalidade-e-ideia-in",
        ),
        q(
          "encceja-em-nacional-2022-ling-015",
          "interpretar-texto-em-ingles",
          "finalidade-e-ideia-in",
        ),
        q(
          "encceja-em-ppl-2020-ling-001",
          "interpretar-texto-em-ingles",
          "finalidade-e-ideia-in",
        ),
        q(
          "encceja-em-ppl-2020-ling-003",
          "interpretar-texto-em-ingles",
          "finalidade-e-ideia-in",
        ),
        q(
          "encceja-em-ppl-2022-ling-027",
          "reconhecer-vocabulo-em-ingles",
          "palavras-e-expressoes-in",
        ),
        q(
          "encceja-em-ppl-2022-ling-030",
          "reconhecer-vocabulo-em-ingles",
          "palavras-e-expressoes-in",
        ),
      ],
    },
    literatura: {
      habilidades: [
        [
          "analisar-texto-literario",
          "Analisar sentido e tema de textos literários",
          true,
        ],
        [
          "reconhecer-recurso-expressivo",
          "Reconhecer recursos expressivos da linguagem literária",
          false,
        ],
      ],
      videos: {
        n4X1AG0pY8U: ["analisar-texto-literario"],
        G1O9WMNUU4g: [
          "analisar-texto-literario",
          "reconhecer-recurso-expressivo",
        ],
      },
      questoes: [
        q(
          "encceja-em-nacional-2019-ling-014",
          "analisar-texto-literario",
          "sentido-e-tema",
        ),
        q(
          "encceja-em-nacional-2019-ling-015",
          "reconhecer-recurso-expressivo",
          "linguagem-e-recurso",
        ),
        q(
          "encceja-em-nacional-2019-ling-016",
          "reconhecer-recurso-expressivo",
          "linguagem-e-recurso",
        ),
        q(
          "encceja-em-nacional-2019-ling-017",
          "reconhecer-recurso-expressivo",
          "linguagem-e-recurso",
        ),
        q(
          "encceja-em-nacional-2019-ling-026",
          "reconhecer-recurso-expressivo",
          "linguagem-e-recurso",
        ),
        q(
          "encceja-em-nacional-2020-ling-011",
          "analisar-texto-literario",
          "sentido-e-tema",
        ),
        q(
          "encceja-em-nacional-2020-ling-012",
          "analisar-texto-literario",
          "sentido-e-tema",
        ),
        q(
          "encceja-em-nacional-2020-ling-013",
          "reconhecer-recurso-expressivo",
          "linguagem-e-recurso",
        ),
        q(
          "encceja-em-nacional-2020-ling-025",
          "reconhecer-recurso-expressivo",
          "linguagem-e-recurso",
        ),
        q(
          "encceja-em-nacional-2020-ling-026",
          "analisar-texto-literario",
          "sentido-e-tema",
        ),
        q(
          "encceja-em-nacional-2022-ling-005",
          "analisar-texto-literario",
          "sentido-e-tema",
        ),
        q(
          "encceja-em-nacional-2022-ling-013",
          "analisar-texto-literario",
          "sentido-e-tema",
        ),
        q(
          "encceja-em-nacional-2022-ling-017",
          "reconhecer-recurso-expressivo",
          "linguagem-e-recurso",
        ),
        q(
          "encceja-em-ppl-2020-ling-006",
          "analisar-texto-literario",
          "sentido-e-tema",
        ),
        q(
          "encceja-em-ppl-2020-ling-007",
          "reconhecer-recurso-expressivo",
          "linguagem-e-recurso",
        ),
        q(
          "encceja-em-ppl-2020-ling-008",
          "analisar-texto-literario",
          "sentido-e-tema",
        ),
        q(
          "encceja-em-ppl-2022-ling-013",
          "reconhecer-recurso-expressivo",
          "linguagem-e-recurso",
        ),
        q(
          "encceja-em-ppl-2022-ling-016",
          "analisar-texto-literario",
          "sentido-e-tema",
        ),
        q(
          "encceja-em-ppl-2022-ling-020",
          "analisar-texto-literario",
          "sentido-e-tema",
        ),
        q(
          "encceja-em-ppl-2022-ling-023",
          "reconhecer-recurso-expressivo",
          "linguagem-e-recurso",
        ),
      ],
    },
    "variacao-linguistica": {
      habilidades: [
        [
          "reconhecer-variedades-da-lingua",
          "Reconhecer variedades da língua e seus usos",
          true,
        ],
        [
          "refletir-sobre-preconceito-linguistico",
          "Refletir sobre o preconceito linguístico",
          false,
        ],
      ],
      videos: {
        "6fBOVygtNoU": ["reconhecer-variedades-da-lingua"],
        Ks6GACE5DDA: [
          "reconhecer-variedades-da-lingua",
          "refletir-sobre-preconceito-linguistico",
        ],
      },
      questoes: [
        q(
          "aut-pt-var-001",
          "reconhecer-variedades-da-lingua",
          "variedades-e-origem",
        ),
        q(
          "aut-pt-var-002",
          "reconhecer-variedades-da-lingua",
          "registro-e-contexto",
        ),
        q(
          "aut-pt-var-003",
          "refletir-sobre-preconceito-linguistico",
          "preconceito-linguistico",
        ),
        q(
          "encceja-em-nacional-2019-ling-020",
          "reconhecer-variedades-da-lingua",
          "variedades-e-origem",
        ),
        q(
          "encceja-em-nacional-2019-ling-027",
          "reconhecer-variedades-da-lingua",
          "variedades-e-origem",
        ),
        q(
          "encceja-em-nacional-2020-ling-014",
          "reconhecer-variedades-da-lingua",
          "variedades-e-origem",
        ),
        q(
          "encceja-em-nacional-2020-ling-018",
          "reconhecer-variedades-da-lingua",
          "registro-e-contexto",
        ),
        q(
          "encceja-em-nacional-2020-ling-023",
          "refletir-sobre-preconceito-linguistico",
          "preconceito-linguistico",
        ),
        q(
          "encceja-em-nacional-2020-ling-028",
          "refletir-sobre-preconceito-linguistico",
          "preconceito-linguistico",
        ),
        q(
          "encceja-em-nacional-2022-ling-001",
          "reconhecer-variedades-da-lingua",
          "variedades-e-origem",
        ),
        q(
          "encceja-em-nacional-2022-ling-004",
          "reconhecer-variedades-da-lingua",
          "registro-e-contexto",
        ),
        q(
          "encceja-em-nacional-2022-ling-007",
          "reconhecer-variedades-da-lingua",
          "variedades-e-origem",
        ),
        q(
          "encceja-em-nacional-2022-ling-016",
          "reconhecer-variedades-da-lingua",
          "registro-e-contexto",
        ),
        q(
          "encceja-em-ppl-2020-ling-017",
          "reconhecer-variedades-da-lingua",
          "registro-e-contexto",
        ),
        q(
          "encceja-em-ppl-2020-ling-025",
          "reconhecer-variedades-da-lingua",
          "registro-e-contexto",
        ),
        q(
          "encceja-em-ppl-2020-ling-026",
          "reconhecer-variedades-da-lingua",
          "registro-e-contexto",
        ),
        q(
          "encceja-em-ppl-2022-ling-014",
          "reconhecer-variedades-da-lingua",
          "variedades-e-origem",
        ),
        q(
          "encceja-em-ppl-2022-ling-015",
          "reconhecer-variedades-da-lingua",
          "registro-e-contexto",
        ),
      ],
    },
  },
};

// ============================= Geração =============================
function gerar(config, impressoesPath) {
  const impressoes = JSON.parse(
    readFileSync(impressoesPath, "utf8").replace(/^﻿/, ""),
  );
  const porCodigo = new Map(impressoes.map((i) => [i.codigo, i]));
  const porTema = new Map();
  for (const i of impressoes) {
    if (!porTema.has(i.tema)) porTema.set(i.tema, []);
    porTema.get(i.tema).push(i.codigo);
  }
  const erros = [];
  const cobertos = new Set();
  const familiasPorTema = new Map();

  const temas = Object.entries(config.temas).map(([slug, t]) => {
    const habilidades = t.habilidades.map(([hs, titulo, essencial]) => {
      if (!SLUG.test(hs)) erros.push(`${slug}: habilidade "${hs}" não é slug`);
      return { slug: hs, titulo, essencial };
    });
    const slugsH = new Set(t.habilidades.map(([hs]) => hs));
    const videos = Object.entries(t.videos ?? {}).map(([yt, habs]) => {
      for (const h of habs)
        if (!slugsH.has(h))
          erros.push(
            `${slug}: vídeo ${yt} cita habilidade "${h}" não declarada`,
          );
      return { youtube: yt, habilidades: habs };
    });
    const questoes = t.questoes.map((x) => {
      const imp = porCodigo.get(x.codigo);
      if (!imp) erros.push(`${slug}: codigo "${x.codigo}" não existe no banco`);
      else if (imp.tema !== slug)
        erros.push(
          `${slug}: "${x.codigo}" pertence ao tema "${imp.tema}", não a "${slug}"`,
        );
      if (cobertos.has(x.codigo))
        erros.push(`${slug}: codigo "${x.codigo}" repetido`);
      cobertos.add(x.codigo);
      if (!slugsH.has(x.h))
        erros.push(
          `${slug}: "${x.codigo}" usa habilidade "${x.h}" não declarada`,
        );
      if (!SLUG.test(x.f)) erros.push(`${slug}: família "${x.f}" não é slug`);
      familiasPorTema.set(`${slug}/${x.f}`, x.codigo);
      const dif =
        x.dif ??
        (x.codigo.startsWith("aut-") ? "introdutoria" : "intermediaria");
      if (!DIFS.has(dif))
        erros.push(`${slug}: dificuldade "${dif}" inválida em "${x.codigo}"`);
      return {
        codigo: x.codigo,
        habilidade: x.h,
        secundarias: [],
        familia: x.f,
        dificuldade: dif,
        tipo: x.tipo ?? config.tipoPadrao,
        revisao: "aprovada",
        elegivel: true,
        impressao: imp?.impressao,
      };
    });
    return { slug, habilidades, videos, questoes };
  });

  for (const [tema, codigos] of porTema)
    for (const c of codigos)
      if (!cobertos.has(c))
        erros.push(`tema "${tema}": questão "${c}" sem classificação`);
  for (const tema of porTema.keys())
    if (!config.temas[tema])
      erros.push(`tema "${tema}" existe no banco e falta na curadoria`);

  if (erros.length) {
    console.error(`${erros.length} erro(s) de curadoria:`);
    for (const e of erros) console.error(`  - ${e}`);
    process.exit(1);
  }

  return {
    formato: 1,
    revisor: REVISOR,
    disciplina: config.disciplina,
    matriz: { versao: VERSAO, validada: true },
    temas,
  };
}

const out = join(RAIZ, "docs", "conteudo", "pedagogia");
mkdirSync(out, { recursive: true });
for (const [cfg, dump] of [
  [MAT, join(RAIZ, "backups", "impressoes-matematica.json")],
  [LING, join(RAIZ, "backups", "impressoes-linguagens.json")],
]) {
  const arquivo = gerar(cfg, dump);
  const destino = join(out, `pedagogia-${cfg.disciplina}.json`);
  writeFileSync(destino, JSON.stringify(arquivo, null, 2) + "\n");
  const qs = arquivo.temas.reduce((n, t) => n + t.questoes.length, 0);
  const hs = arquivo.temas.reduce((n, t) => n + t.habilidades.length, 0);
  const vs = arquivo.temas.reduce((n, t) => n + t.videos.length, 0);
  console.log(
    `${destino}\n  ${arquivo.temas.length} temas, ${hs} habilidades, ${vs} vínculos de vídeo, ${qs} questões classificadas`,
  );
}
