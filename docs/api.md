# API do Estudaê: contrato para o frontend

Versão do MVP (08/11/2026), com a conta do aluno (10/11/2026). O conteúdo é público e o
visitante usa tudo sem conta. A conta (seção [Conta](#conta-do-aluno)) existe, mas o progresso
ainda não é gravado no servidor: isso entra num próximo ticket.

## Onde a API está

| Ambiente | Base | Observação |
|---|---|---|
| Produção / `docker compose` | mesma origem do site (`/api/...`) | o front é servido pela própria API |
| Desenvolvimento | `http://localhost:5151` | `dotnet run --project src/Estudae.Api` dentro de `backend/` |

Em desenvolvimento, o front pode continuar sendo servido em outra porta
(`python -m http.server`, `npx serve .`): a API aceita CORS de qualquer `http://localhost:<porta>`.
Para não espalhar a URL pelas telas, use uma constante só. O padrão é a mesma origem (produção e
compose). Quem roda o front em outra porta configura uma vez, no console do navegador:
`localStorage.setItem("estudae:api", "http://localhost:5151")`.

```js
// src/core/api.js
let BASE = "";
try { BASE = localStorage.getItem("estudae:api") ?? ""; } catch { /* sem storage: mesma origem */ }
```

- Corpo e respostas em **JSON**, chaves em **camelCase**, textos em **UTF-8**.
- Conteúdo: sem autenticação. Conta: sessão por **cookie HttpOnly** (`estudae_sessao`), que o
  navegador manda sozinho; o front não lê nem guarda token nenhum.

Os exemplos de resposta abaixo são **ilustrativos**: valores reais vêm do conteúdo importado.

## Resumo

| Método | Rota | Para quê |
|---|---|---|
| `GET` | `/api/disciplinas` | Tela de escolha de matéria |
| `GET` | `/api/disciplinas/{disciplina}/temas` | Temas da matéria, com os vídeos |
| `GET` | `/api/disciplinas/{disciplina}/temas/{tema}/questoes` | Quiz de um tema (sem gabarito) |
| `POST` | `/api/questoes/{id}/resposta` | Corrigir uma resposta |
| `GET` | `/api/conta/opcoes` | O cadastro está aberto? |
| `POST` | `/api/conta/cadastro` | Criar conta (manda e-mail de confirmação) |
| `POST` | `/api/conta/confirmar-email` | Tela aberta pelo link do e-mail; já entra |
| `POST` | `/api/conta/reenviar-confirmacao` | "Não recebi o e-mail" |
| `POST` | `/api/conta/entrar` | Login |
| `POST` | `/api/conta/sair` | Logout |
| `GET` | `/api/conta/eu` | Quem está logado (401 se ninguém) |
| `POST` | `/api/conta/esqueci-senha` | Manda o link para criar senha nova |
| `POST` | `/api/conta/redefinir-senha` | Tela aberta pelo link; troca a senha e já entra |
| `POST` | `/api/conta/excluir` | Apagar a conta (pede a senha) |
| `GET` | `/health` | Saúde da API e do banco (não é para as telas) |

`{disciplina}` e `{tema}` são **slugs** (`matematica`, `porcentagem-e-proporcao`), que são
estáveis. Use os slugs nas rotas do front (`#/tema/matematica/equacoes`), não posições de lista
nem `id`. O `id` da questão só serve para o `POST`, e deve sempre vir da resposta da API.

---

## `GET /api/disciplinas`

Lista as disciplinas, em ordem alfabética do nome.

```json
[
  { "slug": "matematica", "nome": "Matemática", "icone": "percent", "nivel": "medio", "totalQuestoes": 2 }
]
```

| Campo | Tipo | Nota |
|---|---|---|
| `slug` | string | usar nas próximas chamadas |
| `nome` | string | para exibir |
| `icone` | string \| null | nome do ícone do front (`pen`, `percent`) |
| `nivel` | string | `"medio"` ou `"fundamental"`: a prova do Encceja. O front mostra só as da prova escolhida |
| `totalQuestoes` | number | só questões publicadas, somando todos os temas |

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
      { "id": 1, "titulo": "Porcentagem no dia a dia", "youtubeId": "AAAAAAAAAAA", "duracaoSegundos": 480 }
    ]
  }
]
```

| Campo | Tipo | Nota |
|---|---|---|
| `totalQuestoes` | number | pode ser `0`: tema só com vídeo. Esconder o botão de quiz nesse caso |
| `videos` | array | pode ser vazio |
| `videos[].youtubeId` | string | sempre 11 caracteres |
| `videos[].duracaoSegundos` | number \| null | `null` = não informado; não mostrar a duração |

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
    "prova": { "ano": 2024, "edicao": "Nacional", "nivel": "Ensino Médio", "numero": 2 }
  }
]
```

| Campo | Tipo | Nota |
|---|---|---|
| `id` | number | usar no `POST` de resposta |
| `textoBase` | string \| null | texto de apoio; mostrar antes do enunciado quando houver |
| `enunciado` | string | |
| `alternativas` | string[] | de 2 a 5. **Já vêm embaralhadas**, em ordem nova a cada pedido. **Exceção:** questão com `imagem` vem na ordem da prova, porque o recorte mostra as letras originais |
| `imagem` | objeto \| null | recorte da prova (figura, tabela, gráfico...): `{ "url": "conteudo/imagens/2022/x.webp", "descricao": "..." }`. `url` é relativa à raiz da API (o `GET /conteudo/imagens/{caminho}` lê da tabela `imagem`, com `ETag`; 404 se não existir); `descricao` é o texto alternativo (`alt` e leitura em voz alta) |
| `prova` | objeto \| null | origem da questão. Exibir como fonte: *"Encceja {ano}, {edicao}, questão {numero}"*. **`null` = questão autoral** (escrita pela equipe): exibir "Questão autoral Estudaê" |

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

| Campo | Tipo | Nota |
|---|---|---|
| `acertou` | boolean | |
| `respostaCorreta` | string | texto da alternativa certa, para destacar na tela |
| `resolucao` | string | explicação; pode ter fórmula (ver "Textos com fórmula") |

Erros: `400` se faltar `alternativa`, se ela não for uma das alternativas da questão ou se o
corpo não for JSON; `404` se a questão não existe (ou ainda é rascunho).

Exemplo com `fetch`:

```js
const r = await fetch(`${BASE}/api/questoes/${id}/resposta`, {
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
- **A API nunca diz se um e-mail tem conta.** Cadastro, reenviar e "esqueci a senha" respondem
  sempre `202`. Login com e-mail inexistente ou senha errada dá a mesma mensagem.

**Cadastro aberto ou fechado.** Sem o envio de e-mail de verdade (Resend), o cadastro fica
**fechado em produção**, e cadastro, reenviar e "esqueci a senha" respondem `503`. O front pergunta
uma vez, em `GET /api/conta/opcoes` → `{ "cadastroAberto": true }`, e esconde "Criar conta" e
"Esqueci minha senha" quando vier `false`. Em desenvolvimento ele está sempre aberto, e o e-mail
aparece no log da API (`docker compose logs api` ou o terminal do `dotnet run`), com o link.

**Links dos e-mails.** Os e-mails apontam para **telas do front**, que leem `u` e `t` da URL e
chamam a API:

| Link no e-mail | Tela do front | Chama |
|---|---|---|
| `/confirmar-email?u=<id>&t=<token>` | "Confirmando seu e-mail..." | `POST /api/conta/confirmar-email` |
| `/redefinir-senha?u=<id>&t=<token>` | campo de senha nova | `POST /api/conta/redefinir-senha` |
| `/login`, `/esqueci-senha` | (do e-mail "você já tem conta") | |

O link de confirmação vale **3 dias**; o de senha, **1 dia** e **uma vez só**.

### Corpos e respostas

Usuário logado (resposta de `confirmar-email`, `entrar`, `redefinir-senha` e `eu`):

```json
{ "nome": "Maria da Silva", "email": "maria@gmail.com" }
```

| Rota | Corpo | Sucesso | Erros |
|---|---|---|---|
| `cadastro` | `{ "nome", "email", "senha" }` | `202 { "mensagem" }` | `400` campo inválido, `503` fechado ou e-mail fora do ar |
| `confirmar-email` | `{ "usuarioId": u, "token": t }` | `200` usuário (já logado) | `400` link inválido ou vencido |
| `reenviar-confirmacao` | `{ "email" }` | `202 { "mensagem" }` | `400`, `503` |
| `entrar` | `{ "email", "senha" }` | `200` usuário | `401` e-mail ou senha incorretos, `403` falta confirmar, `429` bloqueado |
| `sair` | — | `204` | — |
| `eu` | — | `200` usuário | `401` |
| `esqueci-senha` | `{ "email" }` | `202 { "mensagem" }` | `400`, `503` |
| `redefinir-senha` | `{ "usuarioId": u, "token": t, "senha" }` | `200` usuário (já logado) | `400` link inválido ou senha curta |
| `excluir` | `{ "senha" }` | `204` (e desloga) | `401` sem login ou senha incorreta |

O `403` do login (senha certa, e-mail não confirmado) traz um **código**, para o front mostrar
"Reenviar e-mail" em vez de só a mensagem:

```json
{ "erro": "Falta confirmar seu e-mail. Abra o e-mail que enviamos e toque no botão.", "codigo": "email-nao-confirmado" }
```

```js
// Ao abrir o app: tem alguém logado?
const r = await fetch("/api/conta/eu");
const usuario = r.ok ? await r.json() : null; // 401 = visitante
```

## Erros

Todo erro tem o mesmo formato, com uma mensagem em português que pode ser mostrada ao usuário:

```json
{ "erro": "Tema \"nao-existe\" não encontrado em \"matematica\"." }
```

| Status | Quando |
|---|---|
| `400` | corpo inválido no `POST` |
| `401` | rota de conta sem login, ou e-mail/senha incorretos |
| `403` | e-mail ainda não confirmado (com `"codigo"`, ver Conta) |
| `404` | disciplina, tema ou questão não encontrados |
| `429` | conta bloqueada por senhas erradas (5 minutos) |
| `503` | cadastro fechado, ou o e-mail não pôde ser enviado |
| `500` | erro interno (`"Erro interno. Tente de novo em instantes."`) |

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

## O que o front precisa mudar (decisões do MVP)

- **Esconder Progresso e Perfil** da navegação. Visitante não grava nada, então
  `estudae:results` e `estudae:watched` deixam de ser escritos. `estudae:a11y` continua.
- **Quiz por tema** (não mais por disciplina), corrigido questão a questão pelo `POST`, que
  devolve a resolução logo após cada resposta.
- **Player de verdade** com o embed do YouTube, no lugar do player simulado.
- **Rotas por slug**. O `src/data.js` continua, mas preenchido pela API (sem conteúdo fixo).
- Login e cadastro de mentira (só no `localStorage`) saem: entram as rotas de [Conta](#conta-do-aluno).

## Fora do contrato por enquanto

Tentativas gravadas, aulas assistidas e progresso no servidor (próximo ticket). Quando
entrarem, serão rotas novas; as rotas acima não mudam.
