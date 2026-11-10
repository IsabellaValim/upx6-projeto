# Conteúdo do Estudaê

Aqui ficam as questões e os vídeos do site, **um arquivo JSON por disciplina**, e as imagens
das questões em `imagens/`. O importador lê esses arquivos, confere tudo e grava no banco.
Os exemplos em `exemplos/` mostram o formato e os erros que ele pega.

O modelo de dados por trás disso está em `backend/DatabaseDocs/ModelodeDados.md`.
Para carregar as questões de 2022 num banco oficial: [`ENTREGA-QUESTOES-2022.md`](ENTREGA-QUESTOES-2022.md).

## Escopo

- Provas do Encceja de **Ensino Médio e Ensino Fundamental**, áreas de **Linguagens** e
  **Matemática**. A mesma matéria nos dois níveis são duas disciplinas (`matematica` e
  `matematica-fundamental`), com o campo `nivel`.
- Questões com figura, tabela ou gráfico levam o **recorte da prova** como imagem.

  | Arquivo (`slug`) | Nível | Temas (`slug`) |
  |---|---|---|
  | `matematica` | médio | `porcentagem-e-proporcao`, `equacoes`, `geometria-plana`, `estatistica-basica`, `numeros-e-operacoes`, `grandezas-e-medidas`, `funcoes`, `geometria-espacial`, `probabilidade-e-contagem` |
  | `linguagens` | médio | `interpretacao-de-texto`, `generos-textuais`, `variacao-linguistica`, `gramatica`, `literatura`, `comunicacao-e-midias`, `lingua-inglesa`, `lingua-espanhola`, `arte`, `educacao-fisica` |
  | `matematica-fundamental` | fundamental | `numeros-e-operacoes`, `fracoes-e-decimais`, `porcentagem-e-proporcao`, `equacoes`, `grandezas-e-medidas`, `geometria`, `graficos-e-tabelas`, `probabilidade-e-contagem` |
  | `linguagens-fundamental` | fundamental | os mesmos 10 de `linguagens` |

## Formato

```jsonc
{
  "disciplina": { "slug": "matematica", "nome": "Matemática", "icone": "percent", "nivel": "medio" },
  "temas": [
    {
      "slug": "porcentagem-e-proporcao",
      "titulo": "Porcentagem e proporção",
      "sobre": "Texto curto de apresentação do tema.",
      "videos": [
        { "youtube": "https://www.youtube.com/watch?v=XXXXXXXXXXX", "titulo": "...", "duracao_segundos": 480 }
      ],
      "questoes": [
        {
          "codigo": "mat-porcentagem-001",
          "texto_base": "Texto de apoio (opcional).",
          "enunciado": "A pergunta.",
          "alternativas": ["texto 1", "texto 2", "texto 3", "texto 4"],
          "resposta_correta": "texto 2",
          "resolucao": "Explicação passo a passo.",
          "prova_ano": 2019,
          "prova_edicao": "Nacional",
          "prova_nivel": "Ensino Médio",
          "prova_numero": 12,
          "imagem": { "arquivo": "2022/2022_EM_regular_matematica_47.webp", "descricao": "O que a imagem mostra." }
        }
      ]
    }
  ]
}
```

| Campo | Obrigatório | Regra |
|---|---|---|
| `disciplina.slug` | sim | minúsculas sem acento, números e hífen (`matematica`) |
| `disciplina.nome` | sim | até 100 caracteres |
| `disciplina.icone` | não | nome do ícone usado no front (`pen`, `percent`) |
| `disciplina.nivel` | não | `"medio"` (padrão) ou `"fundamental"` |
| `tema.slug` | sim | como o da disciplina; único no arquivo |
| `tema.titulo`, `tema.sobre` | sim | título até 150 caracteres |
| `videos[].youtube` | sim | **link completo do YouTube ou só o ID** (11 caracteres); o importador extrai o ID |
| `videos[].titulo` | sim | até 200 caracteres |
| `videos[].duracao_segundos` | não | maior que zero |
| `questoes[].codigo` | sim | único no arquivo **e no banco**; formato `mat-porcentagem-001` |
| `texto_base` | não | |
| `enunciado`, `resolucao` | sim | |
| `alternativas` | sim | de 2 a 5, sem repetição (maiúscula/minúscula não conta como diferença) |
| `resposta_correta` | sim | **exatamente igual** ao texto de uma das alternativas |
| `prova_ano` | só em questão do INEP | de 2002 até o ano atual |
| `prova_edicao`, `prova_nivel` | só em questão do INEP | texto, até 40 caracteres |
| `prova_numero` | só em questão do INEP | número da questão na prova original, maior que zero |
| `imagem.arquivo` | não | caminho relativo a `conteudo/imagens/` (`.webp`, `.png`, `.jpg`); o arquivo precisa existir |
| `imagem.descricao` | se houver imagem | texto alternativo (até 1000 caracteres): o que a imagem mostra, **sem dar a resposta** |

### Imagens

- Só para questões que **dependem** do elemento visual (figura, gráfico, tabela, mapa, tirinha,
  foto). Use o recorte da questão como está na prova.
- Questão com imagem **não tem as alternativas embaralhadas**: o recorte mostra as letras
  originais, e elas precisam bater com as da tela.
- A descrição é lida pelo leitor de tela e pela leitura em voz alta. Tabela simples: transcreva
  os dados também no `texto_base`.

### Questão do INEP ou autoral

Os quatro campos `prova_*` são **tudo ou nada**:

- **Questão do INEP:** os quatro preenchidos e conferidos com o PDF e o gabarito oficial. O site
  mostra "Fonte: Encceja 2020, Nacional, Ensino Médio, questão 35."
- **Questão autoral** (escrita pela equipe para praticar): **nenhum** dos quatro, e o `codigo`
  começa com `aut-` (`aut-mat-por-001`). O site mostra "Questão autoral Estudaê, feita para
  praticar." Nunca invente ano ou número para uma questão autoral.
- Só um, dois ou três campos preenchidos é erro: o importador recusa o arquivo.

## Catálogo atual

| Arquivo | Nível | Temas | Vídeos | Questões | Origem |
|---|---|---|---|---|---|
| `matematica.json` | médio | 9 | 4 | 72 | 60 do Encceja 2022 + 12 autorais (`aut-mat-*`) |
| `linguagens.json` | médio | 10 | 4 | 72 | 60 do Encceja 2022 + 12 autorais (`aut-pt-*`) |
| `matematica-fundamental.json` | fundamental | 8 | 0 | 60 | Encceja 2022 |
| `linguagens-fundamental.json` | fundamental | 10 | 0 | 60 | Encceja 2022 |

As 240 questões oficiais (os 8 cadernos de 2022, aplicação Nacional e Reaplicação/PPL) foram
transcritas a partir dos recortes da prova, com gabarito oficial, resolução e tema. A revisão
humana antes de publicar fora do ambiente local está em
[`ENTREGA-QUESTOES-2022.md`](ENTREGA-QUESTOES-2022.md) e em `revisao-2022.csv`. Os temas novos
ainda não têm vídeo. Os vídeos atuais passaram no oEmbed; legenda, ritmo e adequação continuam
sendo revisão humana (checklist abaixo).

**Conteúdo de teste x demonstração:** `exemplos/` tem questões inventadas e IDs de vídeo
falsos, usados só pelos testes automáticos, e não entra na imagem. O que vai para o site são os
arquivos da raiz desta pasta.

Detalhes importantes:

- **A ordem** dos temas e dos vídeos é a ordem em que aparecem no arquivo.
- **As alternativas são guardadas como texto** e o site embaralha a ordem. Por isso uma
  alternativa **não pode citar outra pela posição** ("A e B estão corretas", "Todas as
  anteriores"). O importador recusa esses casos.
- **Campo com nome errado é erro.** `resposta_corecta` não é ignorado: o arquivo inteiro é recusado.
- **Matemática:** usar o mínimo de LaTeX. `5²`, `×`, `÷` e `R$ 10,00` em texto puro bastam na
  maioria das questões (e a leitura em voz alta lê texto puro direito). Quando precisar de
  fórmula, use `\( ... \)` na linha ou `\[ ... \]` em bloco. **Nunca `$`** como delimitador
  (`R$` e `US$` são permitidos). No JSON, a barra invertida é escrita dobrada: `"\\( x^2 \\)"`.
- Espaços nas pontas e quebras de linha do Windows são limpos automaticamente.

## Como importar

### Pelo Docker Compose (não precisa do .NET instalado)

Os JSONs desta pasta são **copiados para dentro da imagem** no build. Então, depois de editar
um arquivo, reconstrua a imagem antes de importar; senão o importador lê a versão antiga.

```bash
docker compose up -d --build --wait                                   # reconstrói e sobe
docker compose run --rm api importar conteudo/linguagens.json --validar   # só confere
docker compose run --rm api importar conteudo/linguagens.json --publicar  # grava publicada
docker compose run --rm api importar conteudo/matematica.json --publicar
curl http://localhost:8080/api/disciplinas                              # confere as contagens
```

### Pelo `dotnet run` (desenvolvimento do backend)

Dentro de `backend/`, com o Postgres do compose de pé:

```bash
# Só confere o arquivo (não precisa de banco). Use antes de abrir o PR.
dotnet run --project src/Estudae.Api -- importar "$PWD/../conteudo/matematica.json" --validar

# Grava como RASCUNHO (não aparece no site).
dotnet run --project src/Estudae.Api -- importar "$PWD/../conteudo/matematica.json"

# Grava como PUBLICADA (aparece no site). Só depois da revisão no PR.
dotnet run --project src/Estudae.Api -- importar "$PWD/../conteudo/matematica.json" --publicar
```

> O caminho precisa ser **absoluto** (`"$PWD/..."`): o `dotnet run` executa a partir da pasta
> do projeto, então `../conteudo` não funcionaria.

- **Se houver qualquer erro, nada é gravado.** A saída lista todos os erros, com a questão e o
  campo de cada um.
- **Reimportar é seguro:** questão com o mesmo `codigo` é **atualizada**, não duplicada (o
  mesmo vale para tema por `slug` e vídeo por ID).
- **Nada é apagado.** Tema ou vídeo que está no banco mas saiu do arquivo continua lá, e o
  importador avisa no resumo.
- **Cuidado:** importar **sem** `--publicar` volta para rascunho até as questões que já estavam
  publicadas, e elas somem do site. O resumo avisa quando isso acontece.

## Fluxo de trabalho

1. Pegar a questão no PDF da prova (ver "Extrair com IA" abaixo).
2. Colocar no JSON da disciplina, no tema certo, e rodar com `--validar`.
3. Abrir um PR. **Outra pessoa revisa** (checklist abaixo).
4. Depois do merge, importar com `--publicar`.

### Checklist de revisão

- [ ] O texto confere com o PDF original, palavra por palavra (inclusive o texto-base).
- [ ] A resposta correta confere com o **gabarito oficial** do INEP.
- [ ] **Matemática: resolvi a questão de novo.** A IA erra conta.
- [ ] A resolução explica o raciocínio, não só a resposta.
- [ ] `prova_ano`, `prova_edicao`, `prova_nivel` e `prova_numero` conferem com o PDF.
- [ ] A questão não depende de figura, tabela ou gráfico.
- [ ] O vídeo (se houver) permite incorporação: abrir
      `https://www.youtube.com/oembed?url=<link do vídeo>` deve mostrar dados do vídeo, não um erro.
      Tem legenda em português, menos de 15 minutos e ritmo calmo.

### Extrair com IA (no chat)

Colar o texto da questão copiado do PDF depois deste prompt:

```text
Converta a questão abaixo para JSON, exatamente neste formato, sem nenhum outro texto:
{"codigo": "", "texto_base": "", "enunciado": "", "alternativas": [], "resposta_correta": "",
 "resolucao": "", "prova_ano": 0, "prova_edicao": "", "prova_nivel": "Ensino Médio", "prova_numero": 0}
Regras:
- Copie o texto-base, o enunciado e as alternativas sem mudar nenhuma palavra.
- Não coloque a letra (A, B, C, D) no texto das alternativas.
- "resposta_correta" é o texto completo da alternativa correta, igual ao da lista.
- "resolucao": explique passo a passo, em linguagem simples, para uma pessoa idosa.
- Matemática em texto puro sempre que possível (5², ×, ÷, R$ 10,00). Se precisar de
  fórmula, use \( ... \), nunca $.
- Deixe "codigo" vazio; eu preencho.
Gabarito oficial: <letra>. Prova: Encceja <ano>, <edição>, questão <número>.
```

## Exemplos

| Arquivo | O que mostra |
|---|---|
| `exemplos/exemplo-valido.json` | 2 questões válidas (uma com o link completo do vídeo, outra só com o ID) |
| `exemplos/exemplo-invalido.json` | 13 erros de validação de uma vez, um tipo por questão |
| `exemplos/exemplo-campo-desconhecido.json` | campo escrito errado (`resposta_corecta`), recusado na leitura |

As questões de exemplo são **inventadas** (não são do INEP) e os IDs de vídeo são falsos. Os
testes automáticos (`backend/tests/`) usam esses arquivos: se mudar um exemplo, rode `dotnet test`.
