# API do Estudaê: contrato para o frontend

Versão do MVP (08/11/2026), com a conta do aluno (10/11/2026), o progresso no servidor
(17/11/2026) e os contratos pedagógicos aditivos da curadoria. O conteúdo é público e o
visitante usa tudo sem conta. Quem tem conta ([Conta](#conta-do-aluno)) grava o progresso
na API ([Progresso](#progresso-do-aluno)). A captura adaptativa usa IndexedDB separado
quando explicitamente habilitada para um tema curado.

## Onde a API está

| Ambiente                    | Base                              | Observação                                                  |
| --------------------------- | --------------------------------- | ----------------------------------------------------------- |
| Produção / `docker compose` | mesma origem do site (`/api/...`) | o front é servido pela própria API                          |
| Desenvolvimento             | `http://localhost:5151`           | `dotnet run --project src/Estudae.Api` dentro de `backend/` |

Em desenvolvimento, execute `npm run dev` em `frontend/`: o Vite encaminha `/api`
e `/conteudo` à API em `localhost:5151`. `frontend/src/core/api.ts` usa sempre a
mesma origem. A antiga chave `estudae:api` não é utilizada.

- Corpo e respostas em **JSON**, chaves em **camelCase**, textos em **UTF-8**.
- Conteúdo: sem autenticação. Conta: sessão por **cookie HttpOnly** (`estudae_sessao`), que o
  navegador manda sozinho; o front não lê nem guarda token nenhum.

Os exemplos de resposta abaixo são **ilustrativos**: valores reais vêm do conteúdo importado.

## Resumo

| Método           | Rota                                                  | Para quê                                             |
| ---------------- | ----------------------------------------------------- | ---------------------------------------------------- | --------------------- |
| `GET`            | `/api/disciplinas`                                    | Tela de escolha de matéria                           |
| `GET`            | `/api/disciplinas/{disciplina}/temas`                 | Temas da matéria, com os vídeos                      |
| `GET`            | `/api/disciplinas/{disciplina}/temas/{tema}/questoes` | Quiz de um tema (sem gabarito)                       |
| `GET`            | `/api/disciplinas/{disciplina}/pedagogia`             | Matriz pedagógica (habilidades por tema)             |
| `POST`           | `/api/questoes/{id}/resposta`                         | Corrigir uma resposta                                | Corrigir uma resposta |
| `GET`            | `/api/conta/opcoes`                                   | O cadastro está aberto?                              |
| `POST`           | `/api/conta/cadastro`                                 | Criar conta (manda e-mail de confirmação)            |
| `POST`           | `/api/conta/confirmar-email`                          | Tela aberta pelo link do e-mail; já entra            |
| `POST`           | `/api/conta/reenviar-confirmacao`                     | "Não recebi o e-mail"                                |
| `POST`           | `/api/conta/entrar`                                   | Login                                                |
| `POST`           | `/api/conta/sair`                                     | Logout                                               |
| `GET`            | `/api/conta/eu`                                       | Quem está logado (401 se ninguém)                    |
| `POST`           | `/api/conta/esqueci-senha`                            | Manda o link para criar senha nova                   |
| `POST`           | `/api/conta/redefinir-senha`                          | Tela aberta pelo link; troca a senha e já entra      |
| `POST`           | `/api/conta/excluir`                                  | Apagar a conta (pede a senha)                        |
| `GET`            | `/api/progresso`                                      | Lições, simulados e aulas vistas de quem está logado |
| `POST`           | `/api/progresso/sessoes`                              | Gravar uma lição ou simulado terminado               |
| `GET`            | `/api/progresso/sessoes/{id}`                         | Detalhe de uma sessão (tela de Resultado)            |
| `PUT` / `DELETE` | `/api/progresso/aulas/{videoaulaId}`                  | Marcar / desmarcar aula como vista                   |
| `POST`           | `/api/progresso/importar`                             | Levar o progresso do `localStorage` para a conta     |
| `GET`            | `/health`                                             | Saúde da API e do banco (não é para as telas)        |

`{disciplina}` e `{tema}` são **slugs** (`matematica`, `porcentagem-e-proporcao`), que são
estáveis. Use os slugs nas rotas do front (`#/tema/matematica/equacoes`), não posições de lista
nem `id`. O `id` da questão só serve para o `POST`, e deve sempre vir da resposta da API.

---

## `GET /api/disciplinas`

Lista as disciplinas, em ordem alfabética do nome.

```json
[
  {
    "slug": "matematica",
    "nome": "Matemática",
    "icone": "percent",
    "nivel": "medio",
    "totalQuestoes": 2
  }
]
```

| Campo           | Tipo           | Nota                                                                                      |
| --------------- | -------------- | ----------------------------------------------------------------------------------------- |
| `slug`          | string         | usar nas próximas chamadas                                                                |
| `nome`          | string         | para exibir                                                                               |
| `icone`         | string \| null | nome do ícone do front (`pen`, `percent`)                                                 |
| `nivel`         | string         | `"medio"` ou `"fundamental"`: a prova do Encceja. O front mostra só as da prova escolhida |
| `totalQuestoes` | number         | só questões publicadas, somando todos os temas                                            |

## `GET /api/disciplinas/{disciplina}/temas`

Temas na ordem definida pelo conteúdo, cada um com seus vídeos já na ordem.

```json
[
  {
    "slug": "porcentagem-e-proporcao",
    "titulo": "Porcentagem e proporção",
    "sobre": "Como calcular descontos, aumentos e partes de um total, com exemplos do dia a dia.",
    "totalQuestoes": 1,
    "videos": [
      {
        "id": 1,
        "titulo": "Porcentagem no dia a dia",
        "youtubeId": "AAAAAAAAAAA",
        "duracaoSegundos": 480
      }
    ]
  }
]
```

| Campo                      | Tipo           | Nota                                                                 |
| -------------------------- | -------------- | -------------------------------------------------------------------- |
| `totalQuestoes`            | number         | pode ser `0`: tema só com vídeo. Esconder o botão de quiz nesse caso |
| `videos`                   | array          | pode ser vazio                                                       |
| `videos[].youtubeId`       | string         | sempre 11 caracteres                                                 |
| `videos[].duracaoSegundos` | number \| null | `null` = não informado; não mostrar a duração                        |

**Player:** `https://www.youtube-nocookie.com/embed/{youtubeId}` num `<iframe>`, com `title`
descritivo (leitor de tela). O vídeo nunca é hospedado por nós.

Erro: `404` se a disciplina não existe.

## `GET /api/disciplinas/{disciplina}/temas/{tema}/questoes`

Questões **publicadas** do tema, em ordem fixa. **Não traz gabarito nem resolução.**

```json
[
  {
    "id": 2,
    "textoBase": "Pensei em um número. Multipliquei esse número por 3 e somei 5 ao resultado. No final, obtive 20.",
    "enunciado": "Em que número eu pensei?",
    "alternativas": ["25", "15", "5", "3"],
    "prova": {
      "ano": 2024,
      "edicao": "Nacional",
      "nivel": "Ensino Médio",
      "numero": 2
    }
  }
]
```

| Campo          | Tipo           | Nota                                                                                                                                                                                                                                                                                                        |
| -------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`           | number         | usar no `POST` de resposta                                                                                                                                                                                                                                                                                  |
| `textoBase`    | string \| null | texto de apoio; mostrar antes do enunciado quando houver                                                                                                                                                                                                                                                    |
| `enunciado`    | string         |                                                                                                                                                                                                                                                                                                             |
| `alternativas` | string[]       | de 2 a 5. **Já vêm embaralhadas**, em ordem nova a cada pedido. **Exceção:** questão com `imagem` vem na ordem da prova, porque o recorte mostra as letras originais                                                                                                                                        |
| `imagem`       | objeto \| null | recorte da prova (figura, tabela, gráfico...): `{ "url": "conteudo/imagens/2022/x.webp", "descricao": "..." }`. `url` é relativa à raiz da API (o `GET /conteudo/imagens/{caminho}` lê da tabela `imagem`, com `ETag`; 404 se não existir); `descricao` é o texto alternativo (`alt` e leitura em voz alta) |
| `prova`        | objeto \| null | origem da questão. Exibir como fonte: _"Encceja {ano}, {edicao}, questão {numero}"_. **`null` = questão autoral** (escrita pela equipe): exibir "Questão autoral Estudaê"                                                                                                                                   |

- Lista vazia (`[]`) quando o tema ainda não tem questões publicadas.
- Se quiser embaralhar também a ordem das questões, faça no front.
- Erro: `404` se a disciplina ou o tema não existem.

### As letras A, B, C, D são do front

A API não tem letras: as alternativas são **textos**. O front pode mostrar "A)", "B)"... pela
posição na tela, mas **na resposta envia o texto**, nunca a letra nem o índice.

## `POST /api/questoes/{id}/resposta`

Corrige uma resposta. **Não grava nada.**

Corpo:

```json
{ "alternativa": "5" }
```

`alternativa` é o **texto exato** de uma das alternativas que vieram no `GET`. Espaços nas pontas
são ignorados.

Resposta `200`:

```json
{
  "acertou": true,
  "respostaCorreta": "5",
  "resolucao": "Chamando o número de x, o texto diz que \\( 3x + 5 = 20 \\). Tirando 5 dos dois lados: \\( 3x = 15 \\). Dividindo por 3: \\( x = 5 \\)."
}
```

| Campo             | Tipo    | Nota                                                    |
| ----------------- | ------- | ------------------------------------------------------- |
| `acertou`         | boolean |                                                         |
| `respostaCorreta` | string  | texto da alternativa certa, para destacar na tela       |
| `resolucao`       | string  | explicação; pode ter fórmula (ver "Textos com fórmula") |

Erros: `400` se faltar `alternativa`, se ela não for uma das alternativas da questão ou se o
corpo não for JSON; `404` se a questão não existe (ou ainda é rascunho).

Exemplo com `fetch`:

```js
const r = await fetch(`/api/questoes/${id}/resposta`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ alternativa: textoEscolhido }),
});
const corpo = await r.json();
if (!r.ok) mostrarErro(corpo.erro);
```

## Conta do aluno

Login por **e-mail e senha**, com **confirmação de e-mail obrigatória**. Regras (em
`Estudae.Infra/Identity/PoliticaConta.cs`):

- **Senha:** de 8 a 128 caracteres, **sem** regra de maiúscula, número ou símbolo. Frase com
  espaço e acento vale ("netos da vovó"). O front não deve inventar regra extra.
- **E-mail:** aparado e em minúsculas pela API, então `Maria@Gmail.com ` e `maria@gmail.com`
  são a mesma conta. **Nome:** de 1 a 150 caracteres, espaços repetidos viram um só.
- **Sessão:** 30 dias, renovada a cada uso. O cookie é `HttpOnly` e `SameSite=Lax`, e o front
  usa `fetch` normal na mesma origem (o cookie vai sozinho, sem `credentials` especial).
- **Bloqueio:** depois de 5 senhas erradas seguidas, 5 minutos sem conseguir entrar.
- **Limite por IP:** `cadastro`, `reenviar-confirmacao` e `esqueci-senha` somados, 5 a cada 15
  minutos; `entrar`, `confirmar-email` e `redefinir-senha`, 20 por minuto. Acima disso, `429` com
  `{ "erro" }` e o cabeçalho `Retry-After` (segundos).
- **Limite de e-mails (silencioso):** no máximo 3 e-mails por endereço por hora e 90 por dia no
  total. Acima disso a API responde `202` como sempre, mas o e-mail não sai (um erro revelaria quem
  tem conta). O front pode dizer "não chegou? espere alguns minutos e peça de novo".
- **A API nunca diz se um e-mail tem conta.** Cadastro, reenviar e "esqueci a senha" respondem
  sempre `202`. Login com e-mail inexistente ou senha errada dá a mesma mensagem.

**Cadastro aberto ou fechado.** Sem o envio de e-mail de verdade (Resend), o cadastro fica
**fechado em produção**, e cadastro, reenviar e "esqueci a senha" respondem `503`. O front pergunta
uma vez, em `GET /api/conta/opcoes` → `{ "cadastroAberto": true }`, e esconde "Criar conta" e
"Esqueci minha senha" quando vier `false`. Em desenvolvimento ele está sempre aberto, e o e-mail
aparece no log da API (`docker compose logs api` ou o terminal do `dotnet run`), com o link.

**Links dos e-mails.** Os e-mails apontam para **telas do front**, que leem `u` e `t` da URL e
chamam a API:

| Link no e-mail                      | Tela do front                   | Chama                             |
| ----------------------------------- | ------------------------------- | --------------------------------- |
| `/confirmar-email?u=<id>&t=<token>` | "Confirmando seu e-mail..."     | `POST /api/conta/confirmar-email` |
| `/redefinir-senha?u=<id>&t=<token>` | campo de senha nova             | `POST /api/conta/redefinir-senha` |
| `/login`, `/esqueci-senha`          | (do e-mail "você já tem conta") |                                   |

O link de confirmação vale **3 dias**; o de senha, **1 dia** e **uma vez só**.

### Corpos e respostas

Usuário logado (resposta de `confirmar-email`, `entrar`, `redefinir-senha` e `eu`):

```json
{ "nome": "Maria da Silva", "email": "maria@gmail.com" }
```

| Rota                   | Corpo                                     | Sucesso                   | Erros                                                                                         |
| ---------------------- | ----------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------- |
| `cadastro`             | `{ "nome", "email", "senha" }`            | `202 { "mensagem" }`      | `400` campo inválido, `429` muitas tentativas, `503` fechado ou e-mail fora do ar             |
| `confirmar-email`      | `{ "usuarioId": u, "token": t }`          | `200` usuário (já logado) | `400` link inválido ou vencido, `429`                                                         |
| `reenviar-confirmacao` | `{ "email" }`                             | `202 { "mensagem" }`      | `400`, `429`, `503`                                                                           |
| `entrar`               | `{ "email", "senha" }`                    | `200` usuário             | `401` e-mail ou senha incorretos, `403` falta confirmar, `429` bloqueado ou muitas tentativas |
| `sair`                 | —                                         | `204`                     | —                                                                                             |
| `eu`                   | —                                         | `200` usuário             | `401`                                                                                         |
| `esqueci-senha`        | `{ "email" }`                             | `202 { "mensagem" }`      | `400`, `429`, `503`                                                                           |
| `redefinir-senha`      | `{ "usuarioId": u, "token": t, "senha" }` | `200` usuário (já logado) | `400` link inválido ou senha curta, `429`                                                     |
| `excluir`              | `{ "senha" }`                             | `204` (e desloga)         | `401` sem login ou senha incorreta                                                            |

O `403` do login (senha certa, e-mail não confirmado) traz um **código**, para o front mostrar
"Reenviar e-mail" em vez de só a mensagem:

```json
{
  "erro": "Falta confirmar seu e-mail. Abra o e-mail que enviamos e toque no botão.",
  "codigo": "email-nao-confirmado"
}
```

```js
// Ao abrir o app: tem alguém logado?
const r = await fetch("/api/conta/eu");
const usuario = r.ok ? await r.json() : null; // 401 = visitante
```

## Progresso do aluno

Só para quem tem **conta**: todas as rotas exigem o cookie de sessão e respondem `401`
(`{ "erro" }`) sem ele, ou se a conta foi excluída. O dono é **sempre** o usuário do cookie; nenhum
id de usuário vai na URL ou no corpo. O visitante continua só no `localStorage`.

- **Sessão** = uma lição (`tipo: "licao"`, um tema) ou um simulado (`tipo: "simulado"`, a
  disciplina toda) **já terminada**. Sessão em andamento não é enviada.
- **O servidor corrige.** O front manda só o **texto** da alternativa escolhida; `acertou` é
  calculado na API, com a mesma normalização do `POST /api/questoes/{id}/resposta`.
- **`chave`**: gerada pelo front, única **por aluno** (1 a 64 caracteres: letras, números e
  `_ . : -`; um UUID serve). Reenviar a mesma chave **não duplica**: a API devolve a sessão já
  gravada (`200` em vez de `201`), mesmo que o corpo venha diferente. Assim é seguro repetir o
  envio quando a rede falha ou o servidor demora a acordar.
- **Slugs e ids, nunca posições:** `disciplina` e `tema` são slugs, `questaoId` vem da lista de
  questões e `videoaulaId` vem de `videos[].id` em `GET .../temas`.
- **Datas** em ISO 8601 com fuso (`2026-11-17T14:30:00-03:00` ou `...Z`); voltam sempre em UTC
  (`Z`). Recusadas: antes de 2026, mais de 10 minutos no futuro, `concluidaEm` antes de
  `iniciadaEm` ou sessão de mais de 24 horas. "Dias seguidos" é calculado pelo front, no fuso do
  aparelho.

| Método   | Rota                                 | Sucesso                                                | Erros                                    |
| -------- | ------------------------------------ | ------------------------------------------------------ | ---------------------------------------- |
| `GET`    | `/api/progresso`                     | `200` com `{ sessoes, aulas }`                         | `401`                                    |
| `POST`   | `/api/progresso/sessoes`             | `201` (nova) ou `200` (chave já gravada), com o resumo | `400`, `401`                             |
| `GET`    | `/api/progresso/sessoes/{id}`        | `200` com o detalhe (tela de Resultado)                | `401`, `404` (inclusive de outra pessoa) |
| `PUT`    | `/api/progresso/aulas/{videoaulaId}` | `204` (marcar de novo mantém a primeira data)          | `401`, `404`                             |
| `DELETE` | `/api/progresso/aulas/{videoaulaId}` | `204` (também se não estava marcada)                   | `401`                                    |
| `POST`   | `/api/progresso/importar`            | `200` com o que entrou e o que não                     | `400` (lote grande demais), `401`, `409` |

### Gravar uma sessão

```json
POST /api/progresso/sessoes
{
  "chave": "3f2a9c1e-7b4d-4e8a-9f00-1c2d3e4f5a6b",
  "tipo": "simulado",
  "disciplina": "matematica",
  "tema": null,
  "treino": false,
  "iniciadaEm": "2026-11-17T14:00:00-03:00",
  "concluidaEm": "2026-11-17T14:52:10-03:00",
  "tempoLimiteSeg": 5400,
  "respostas": [
    { "questaoId": 12, "alternativa": "R$ 120,00" },
    { "questaoId": 31, "alternativa": null }
  ]
}
```

- `respostas` na ordem em que apareceram (de 1 a 100, sem questão repetida).
- `alternativa: null` = **em branco**, só no simulado (conta como erro). Na lição toda questão
  tem resposta.
- Lição: `tema` obrigatório, sem `treino` nem `tempoLimiteSeg`. Simulado: sem `tema`;
  `tempoLimiteSeg` (1 a 86400) é opcional, e `treino: true` = montado com questões autorais.
- `400` também quando o conteúdo não combina: disciplina ou tema que não existe, questão fora do
  tema (lição) ou da disciplina (simulado), questão em rascunho, alternativa que não é da questão.

Resposta (`201`/`200`), o mesmo formato de cada item de `sessoes` no `GET /api/progresso`:

```json
{
  "id": 41,
  "chave": "3f2a9c1e-…",
  "tipo": "simulado",
  "disciplina": "matematica",
  "tema": null,
  "treino": false,
  "iniciadaEm": "2026-11-17T17:00:00Z",
  "concluidaEm": "2026-11-17T17:52:10Z",
  "tempoLimiteSeg": 5400,
  "acertos": 1,
  "total": 2,
  "tentativas": [
    {
      "questaoId": 12,
      "tema": "porcentagem-e-proporcao",
      "acertou": true,
      "emBranco": false
    },
    { "questaoId": 31, "tema": "equacoes", "acertou": false, "emBranco": true }
  ]
}
```

O tempo usado é `concluidaEm - iniciadaEm`; o tema com mais erros sai de `tentativas[].tema`.

### Ler o progresso

`GET /api/progresso` → `{ "sessoes": [ ...resumos, da mais antiga para a mais nova ], "aulas": [
{ "videoaulaId": 5, "assistidaEm": "2026-11-16T22:10:00Z" } ] }`. O resumo não traz enunciado nem
gabarito, para a resposta continuar pequena.

`GET /api/progresso/sessoes/{id}` (tela de Resultado) traz os mesmos campos do resumo, mas com
`questoes` no lugar de `tentativas`:

```json
{
  "questaoId": 12,
  "ordem": 1,
  "tema": "porcentagem-e-proporcao",
  "textoBase": null,
  "enunciado": "Uma loja anunciou 20% de desconto…",
  "alternativas": ["R$ 30,00", "R$ 120,00", "R$ 130,00", "R$ 170,00"],
  "imagem": null,
  "escolhida": "R$ 120,00",
  "respostaCorreta": "R$ 120,00",
  "resolucao": "20% de 150 é…",
  "acertou": true
}
```

Aqui o gabarito aparece porque o aluno já respondeu. As `alternativas` vêm na ordem do banco (não
embaralhadas); o front marca `escolhida` e `respostaCorreta` pelo texto.

### Importar o `localStorage`

No primeiro login em um aparelho que já tem progresso de visitante, o front manda tudo de uma vez:

```json
POST /api/progresso/importar
{
  "sessoes": [ /* até 500, no mesmo formato do POST /sessoes */ ],
  "aulas": [ { "videoaulaId": 5, "assistidaEm": "2026-11-16T19:10:00-03:00" } ]
}
```

```json
{
  "sessoesNovas": 7,
  "sessoesRepetidas": 2,
  "sessoesIgnoradas": [
    {
      "posicao": 3,
      "chave": "local:1731850000000",
      "erro": "Questão 999 não encontrada."
    }
  ],
  "aulasNovas": 4,
  "aulasIgnoradas": 0
}
```

- Ao contrário do `POST /sessoes`, um item ruim **não derruba o lote**: ele vai para
  `sessoesIgnoradas` (`posicao` = índice em `sessoes`) e o resto entra, tudo numa transação.
- Repetir o pedido é seguro: sessões pela `chave`, aulas porque já estão marcadas. Para o
  `estudae:results` antigo, que não tem chave, use uma derivada da entrada (ex.:
  `local:<date>`), sempre a mesma para a mesma entrada.
- Aulas: até 1000; `assistidaEm` opcional (sem ela, vale a hora do pedido). Vídeo que não existe
  ou data fora do intervalo conta em `aulasIgnoradas`.
- `409`: outro aparelho estava importando ao mesmo tempo. Basta repetir.

## Erros

Todo erro tem o mesmo formato, com uma mensagem em português que pode ser mostrada ao usuário:

```json
{ "erro": "Tema \"nao-existe\" não encontrado em \"matematica\"." }
```

| Status | Quando                                                                                           |
| ------ | ------------------------------------------------------------------------------------------------ |
| `400`  | corpo inválido no `POST`                                                                         |
| `401`  | rota de conta sem login, ou e-mail/senha incorretos                                              |
| `403`  | e-mail ainda não confirmado (com `"codigo"`, ver Conta)                                          |
| `404`  | disciplina, tema ou questão não encontrados                                                      |
| `429`  | conta bloqueada por senhas erradas (5 minutos), ou muitas tentativas do mesmo IP (`Retry-After`) |
| `503`  | cadastro fechado, ou o e-mail não pôde ser enviado                                               |
| `500`  | erro interno (`"Erro interno. Tente de novo em instantes."`)                                     |

Rota que não existe (`/api/qualquer-coisa`) responde `404` **sem corpo**. Falha de rede (API
fora do ar) não tem corpo nenhum. Trate os dois casos com uma mensagem genérica.

## Textos com fórmula (Matemática)

`textoBase`, `enunciado`, `alternativas` e `resolucao` podem conter LaTeX entre `\( ... \)` (na
linha) ou `\[ ... \]` (em bloco). Nunca `$` (`R$ 10,00` é dinheiro, não fórmula). O conteúdo
usa o mínimo possível de fórmula, então a maior parte é texto puro.

- **Renderizar com KaTeX** (`renderMathInElement` com esses dois delimitadores) depois de
  inserir o texto no DOM. Inserir o texto com `textContent`/`esc`, **nunca** como HTML.
- **Leitura em voz alta:** não mandar o LaTeX cru para o `speechSynthesis` (ele soletraria
  "barra dfrac..."). O mínimo aceitável é trocar cada fórmula por "fórmula" ou pelo texto
  acessível que o KaTeX gera.

## Frontend e histórico local

O frontend é React 19 + TypeScript + Vite + Zustand. Progresso e Perfil continuam
acessíveis a visitantes, que gravam só neste navegador; quem tem conta grava na API
([Progresso](#progresso-do-aluno)) e o aparelho guarda uma cópia. `estudae:results` e
`estudae:watched` preservam o histórico legado; preferências ficam em `estudae:a11y`.
As rotas tradicionais podem usar posições de tema; novos fatos adaptativos usam
nível, disciplina, tema slug e código estável de questão, nunca posições.

## Curadoria pedagógica aditiva

`GET /api/disciplinas/{disciplina}/pedagogia` retorna a disciplina, a matriz
(`versao`, `validada`) e temas com habilidades (`slug`, `titulo`, `essencial`) e
índice de questões publicadas (`codigo`, `pedagogia`). Não retorna enunciado,
gabarito ou resolução. Disciplina desconhecida responde 404.

Nos GETs de questões, `codigo` identifica o item entre ambientes. `pedagogia` é
nulo antes da classificação; quando presente contém `habilidade`, `secundarias`,
`familia`, `dificuldade`, `tipo`, `revisao`, `elegivel` e `versao`. Publicação sozinha
não significa elegibilidade. Famílias equivalentes não multiplicam evidência.
O GET de temas inclui habilidades; cada vídeo inclui seus vínculos de habilidades.
GET de questões, índice pedagógico e correção incluem `revisaoConteudo`: um UUID
opaco e não derivado do gabarito. O cliente guarda a revisão antes do envio e compara
com a correção; se divergir, a resposta não pode comprovar domínio. A revisão muda
quando o conteúdo ou a imagem muda, não numa reimportação sem alterações.
A correção também acrescenta `codigo` para identificar o conteúdo corrigido.
Campos aditivos não alteram a comparação da resposta pelo texto.

A classificação é importada por CLI, nunca por endpoint público de escrita.
A matriz precisa representar a área inteira; banco insuficiente não permite
concluir que o estudante está despreparado. A ativação do motor e a aprovação
pedagógica são decisões separadas. O exemplo de curadoria contém dados fictícios,
não aprovação de questões reais.

## Fora do contrato por enquanto

Paginação do histórico em `GET /api/progresso` (hoje vem tudo) e limite de requisições nas
rotas de progresso: entram quando o volume pedir. O histórico local do visitante pode ser
apagado ou modificado pelo navegador e não constitui certificação.
