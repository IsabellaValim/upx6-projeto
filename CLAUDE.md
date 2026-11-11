# Estudaê — guia do projeto

Plataforma web para ajudar pessoas (foco em idosos) a estudar para o
**Encceja** (exame de certificação de ensino fundamental/médio do Brasil).
Projeto acadêmico (UPX). Repositório: `IsabellaValim/upx6-projeto`.

Acessibilidade é requisito central, não um extra: textos grandes, poucos
cliques, alto contraste, leitura em voz alta. Qualquer mudança de UI deve
preservar isso.

## Combinados de trabalho

Projeto de estudante, feito principalmente para aprender — em especial
Docker, deploy e CI/CD. Ao trabalhar aqui:

- **Explicar o conceito antes de usá-lo.**
- **Mostrar os comandos antes de rodá-los.**
- **Uma fase por vez**, e esperar o "pode seguir" entre uma fase e outra.
- **Decisões de modelagem e design:** a pessoa rascunha a própria versão
  primeiro; depois comparamos com a minha.

## Estado atual do repositório

- **Meta:** MVP até 09/11/2026 (segunda à noite). Deploy na segunda à
  tarde: plano A é uma VM com compose + Caddy, e o plano B é o Render a partir do
  Dockerfile. A decisão é da pessoa, na segunda.
- **Frontend (`frontend/`):** rescrito em **React 19 + TypeScript + Vite**
  na branch `feat/front-react` (11/11/2026), com paridade de telas e
  acessibilidade + KaTeX nas fórmulas. O front antigo (HTML/CSS/JS puro em
  `src/` + `index.html` na raiz) foi removido no mesmo PR — o histórico do
  git preserva o original.
- **Conteúdo (10/11/2026, branch `feat/questoes-2022`):** 4 disciplinas —
  `matematica` e `linguagens` (Ensino Médio, 72 questões cada: 60 do Encceja
  2022 + 12 autorais) e `matematica-fundamental` e `linguagens-fundamental`
  (60 do Encceja 2022 cada). As 240 oficiais foram transcritas dos recortes
  da prova por subagentes, uma por caderno, com gabarito oficial, resolução,
  tema e imagem (89). "Português" virou **"Linguagens"**. Entrega para o banco
  oficial e checklist de revisão: `docs/conteudo/ENTREGA-QUESTOES-2022.md` e
  `docs/conteudo/revisao-2022.csv`. Ainda não há ambiente de demonstração publicado.
- **O conteúdo mora só no banco** (10/11/2026, branch `feat/conteudo-no-banco`,
  decisão da pessoa, risco aceito): os JSONs e as 240 imagens saíram do repo.
  Imagens na tabela `imagem` (bytea). Compartilhar = `exportar`/`restaurar`
  (`scripts/banco/`); o dump leva tudo (~17 MB). A única cópia viva é o volume
  Docker local: `down -v` apaga o conteúdo. Backups locais (fora do git) em
  `backups/`, inclusive `conteudo-<data>.zip` com os JSONs e imagens antigos.
  O PR #8 tinha sido mergeado na branch do #7 depois de ela entrar na `main`;
  essa branch traz os dois.
- **Backend:** fases 1 a 5 concluídas, mais o primeiro ticket de conteúdo:
  tabelas de conteúdo, importador, endpoints de leitura e correção,
  Dockerfile, compose completo e CI. Fora do MVP: login e tentativas.
- PRs já mergeados em `main`: #1 (componentização do frontend), #2
  (Postgres de dev), #3 (modelo de dados) e #4 (walking skeleton). O MVP do
  backend está na branch `feat/dockerfile-compose`.

## Frontend — arquitetura

**React 19 + TypeScript + Vite**, SPA em `frontend/` (`npm run dev` com proxy
de `/api` e `/conteudo` para `localhost:5151`). Zustand para o estado global,
React Router com **URLs limpas** e KaTeX para as fórmulas `\( \)`/`\[ \]` que
a API manda. O design é o mesmo dos seis arquivos CSS originais, copiados sem
mudança para `frontend/src/styles/` (base, layout, components, screens,
navigation, responsive); o app monta em `#app` e os SVGs da marca moram em
`frontend/public/branding/`.

- **Roteamento:** `src/App.tsx` — `<BrowserRouter>` com `<Routes>`. Públicas:
  `/boas-vindas`, `/login`, `/cadastro`. `RequireUser` guarda o resto;
  `RequireNivel` exige a prova escolhida (exceto `/nivel` e `/acessibilidade`,
  como antes). `/videos/:id` e `/quiz/:id` legados redirecionam para a área.
  Novas URLs entram em `src/core/urls.ts` (mapa central). A API devolve o
  `index.html` para qualquer URL limpa (`MapFallbackToFile`, ver Backend).
- **Contrato de tela:** cada arquivo em `src/screens/` exporta um componente.
  `<Screen>` (`src/components/Screen.tsx`) equivale ao antigo mount: `<main
class="screen ...">`, monta a bottom-nav se `nav` definido, rola ao topo,
  para a leitura em voz alta, foca o `<h1>` e ajusta o `document.title`.
- **Estado global:** `src/core/store.ts` (`useApp`, zustand) — `user`, `a11y`,
  `results`, `watched`, `quiz`/`simulado` (sessões em andamento, não
  persistidas) e `subjects`/`catalogoStatus`. Persiste nas **mesmas chaves**
  `estudae:*` do front antigo, gravadas na hora em cada ação (sem middleware):
  quem já usou o site não perde nada.
- **Conteúdo (API):** `src/core/api.ts` (fetch tipado, mesma origem; o proxy
  do Vite cobre o dev — a chave `estudae:api` deixou de existir).
  `src/core/catalogo.ts` tem `carregarCatalogo()` (dedup em voo + early-return
  em `ready`; o `CatalogoGate` do App segura a renderização até `ready`, com
  erro + "Tentar de novo"), `carregarQuestoes()`, `NIVEIS`, `materiasDoNivel()`
  e `fonte()`. `subjects` é indexado pelo **slug** da disciplina; as rotas de
  vídeo/quiz usam a **posição** do tema (e da aula). A **lição é por tema**
  (`src/screens/Quiz.tsx`, até 5 questões sorteadas): marcar → "Conferir"
  (`POST` com o texto da alternativa) → correção na hora → "Continuar". O
  resultado guarda enunciado, resposta certa e resolução (gabarito nunca fica
  no front). Textos da API renderizam como texto puro ou via `<Tex>` (só a
  saída do KaTeX vira HTML); `esc()` deixou de existir porque o JSX escapa.
- **Vídeo-aula** (`src/screens/Video.tsx`, refeita em 10/11/2026): topo com o
  nome do tema, iframe do `youtube-nocookie.com`, o título da aula como `<h1>`
  (o canal entre parênteses no título vira a linha de baixo), descrição e
  **uma ação principal**: "Terminei a aula, quero praticar" (marca a aula
  como vista e abre a lição). Secundária: "Marcar como vista e voltar".
  "Opções do vídeo" são interruptores com "Ligado/Desligado" escrito:
  Legendas (recarrega o player com `cc_load_policy`) e Velocidade calma
  (`setPlaybackRate` pela API de iframe, `enablejsapi=1`). O YouTube em outra
  aba ficou como link pequeno de plano B. O "Voz alta" da descrição saiu.
- **O que fica no `localStorage` hoje:** tudo existe só no navegador, sem
  conta real por trás, então **não há progresso para migrar** para o banco.
  - `estudae:user`: visitante ou um usuário de mentira do login/cadastro.
  - `estudae:a11y`: preferências de acessibilidade (fonte, contraste etc.).
    Não é progresso — **continua no navegador para todo mundo**, inclusive
    visitante.
  - `estudae:results`: **uma entrada por quiz inteiro** (`v: 2`, `subject`,
    `date`, `correct`, `total`, `weakTopic`), com as respostas em `items`
    (`ask`, `options`, `chosen`, `answer`, `why`, `topic`, `ok`). `chosen` e
    `answer` são _posições_ em `options`. Entradas sem `v: 2` (do conteúdo de
    exemplo antigo) são ignoradas ao carregar. Versão inicial de `Tentativa`, mas o banco guarda uma tentativa
    por questão; sessão de quiz está fora do escopo por enquanto.
  - `estudae:watched`: mapa `"materia/tema/aula"` → timestamp. É um
    liga/desliga (desmarcar apaga a chave), ou seja, uma marca por aula,
    como o `AulaAssistida` atual.
- **Decisão do MVP para o frontend (revista em 10/11/2026):** manter as telas
  e o visual originais (login, progresso e perfil continuam só no
  `localStorage`). Fluxo sem redundância: Início ("Continuar estudando" + os
  cartões de matéria com "X de Y atividades") → Área (título, "Continuar
  estudando", "Seu progresso" e os temas como lista que abre — `<details
name="temas">`, um aberto por vez, com uma frase de descrição, "Praticar"
  em destaque e "Ver aula") → vídeo ou lição. Desenho rascunhado pela pessoa
  em 10/11/2026; a tela própria de cada tema fica para quando houver assuntos
  com mais material.
- **Atividades** (`src/core/stats.ts`: `topicProgress`, `subjectProgress`,
  `nextActivity`): cada vídeo-aula conta quando marcada como concluída, e cada
  questão quando acertada ao menos uma vez (as lições guardam o `id` da
  questão). "Continuar estudando" = aula não vista do primeiro tema
  incompleto, senão a prática dele.
- **Fonte padrão:** "Grande" para quem ainda não escolheu (`store.ts`).
- **Início** (10/11/2026): logo, saudação, "Continuar estudando", "Estudar por
  matéria" (cartões largos com progresso) e "Testar o que aprendeu"
  (Simulado, com contorno, separado de estudar).
- **Simulado** (`src/screens/Simulado.tsx`, `/simulado` e
  `/simulado/{matéria}`): questões de todos os temas da matéria, sorteadas,
  sem correção até a entrega. Usa só as oficiais (`prova` preenchida) quando
  houver o suficiente; senão, as autorais, com o aviso "Simulado de treino".
  Relógio sempre visível; aviso nos minutos finais; ao zerar mostra "Tempo
  esgotado · +mm:ss" e **deixa terminar**. Anterior/Próxima, painel "Ver todas
  as questões" e confirmação na própria tela para sair ou entregar com questões
  em branco. Na entrega, cada questão vai no `POST` (as em branco também, só
  para trazer o gabarito; contam como erro). Resultado `kind: "simulado"`, com
  tempo usado e o tema com mais erros. **Tamanho e tempo:** objeto `SIMULADO`
  no topo do arquivo (hoje 30 questões no máximo e 3 min por questão), para
  ajustar ao edital do Encceja.
- **Marca:** SVGs em `frontend/public/branding/` (`logo-primary`, `logo-white`,
  `symbol-primary`, `symbol-white`, `symbol-purple`, `icon`) — o Vite copia
  `public/` para o `dist`. Uso: `logo-primary` no início,
  boas-vindas e login; `icon` no favicon e na tela de carregamento. O roxo da
  marca é o `--plum-dark` (`#4D3159`). Saíram a tela "Escolha como
  deseja estudar", a lista separada de vídeo-aulas e a folha "qual matéria?";
  `/videos/{m}` e `/quiz/{m}` antigos redirecionam para a área.
  `estudae:results` com `v: 3` = lição por tema (tem `topic`).
- **Cores de texto de acerto/erro:** `--ok-text` e `--bad-text` (base.css),
  mais escuras que `--ok`/`--bad`, para passar de 4.5:1 sobre os fundos claros.
- **Componentes reutilizáveis:** `src/components/` — `Icon.tsx` (SVGs),
  `Nav.tsx` (bottom-nav + voltar), `Screen.tsx`, `Toaster.tsx`,
  `Progress.tsx` (barras, histórico, "Continuar"), `Switch.tsx` (interruptores
  e links de ajuste), `Tex.tsx` (KaTeX), `Alternativas.tsx` (radiogroup com
  roving tabindex: setas movem E marcam), `Enunciado.tsx` + `ImageViewer.tsx`
  (imagem da questão em `<dialog>` com zoom).
- **Utilitários:** `src/core/utils.ts` (puro, sem DOM/estado: `pct`,
  `shuffle`, `initials`, `formatDay`, `LETTERS`), `src/core/stats.ts`
  (métricas derivadas: streak, progresso por matéria/tema, `nextActivity`),
  `src/core/speech.ts` (Web Speech API; `stripTex` tira o LaTeX antes de
  falar), `src/core/toast.ts`, `src/core/tex.ts` (`splitTex`/`stripTex`).
- **Testes:** Vitest + Testing Library em `frontend/src/**/*.test.ts(x)`
  (`npm test`) — core puro e integração do App (guardas, rotas, gate).
- **Convenções:** comentários e nomes de tela/arquivo em pt-BR; TS estrito;
  estilo do Prettier do `frontend/.prettierrc.json` (aspas simples, sem `;`).

## Backend

Fases 1 a 5 prontas, mais o conteúdo do MVP; o resto do plano segue abaixo.

### Stack decidida

- **Backend:** ASP.NET Core (.NET 10 LTS, suporte até nov/2028), EF Core 10
  - Npgsql. O .NET 8 estava no plano original, mas o suporte dele termina em
    nov/2026; a troca foi feita antes de existir código. `backend/global.json`
    fixa o SDK em 10.0.x.
- **Banco de dados:** PostgreSQL rodando em Docker
- **Frontend:** React 19 + TS + Vite em `frontend/`, servido pelo `wwwroot`
  da própria API (mesma origem, um container só, sem CORS). Revisitar se
  surgir um time de frontend separado ou um app mobile. O **Dockerfile** tem
  um estágio Node (`node:22-alpine`) que roda `npm ci` + `npm run build` e
  copia `frontend/dist` para `/app/wwwroot` (só existe dentro da imagem).
  `/assets/*` (nomes com hash do Vite): `Cache-Control: immutable`; o resto,
  `no-cache` (ETag). Como o React Router usa URLs limpas, a API devolve o
  `index.html` para todo caminho sem arquivo que não seja `/api`
  (`MapFallbackToFile` com `no-cache`), e `/api` desconhecida responde 404
  de verdade (`app.Map("/api/{**_}")`).
- **Auth:** ASP.NET Identity com autenticação por cookie HttpOnly, não JWT (login e cadastro
  fazem parte do escopo desde o início). Dois papéis, via roles do Identity:
  **Administrador** (gerencia conteúdo; a área admin é um ticket próprio,
  mais adiante) e **Aluno**. Visitante usa o site sem conta e não grava nada
  — não existe no banco.
- **Containerização:** Docker (Dockerfile multi-stage) + docker-compose
- **CI/CD:** GitHub Actions
- **Hospedagem:** **não** é mais Azure Container Apps. Plano A: VM com o
  mesmo compose + Caddy (HTTPS automático). Plano B: Render a partir do
  Dockerfile. Comparação e passo a passo na auditoria de 06/11.

### Docker Compose (fases 1 e 4)

O `docker-compose.yml` da raiz tem três serviços: `db` → `migrate` → `api`.

```bash
docker compose up -d --build --wait      # tudo: site + API em http://localhost:8080
docker compose up -d --wait db           # só o banco (para dotnet run / dotnet test)
docker compose run --rm -v "$PWD/novo:/novo:ro" api importar /novo/x.json --publicar
docker compose run --rm -v "$PWD/imagens:/imagens:ro" api importar-imagens /imagens
docker compose exec db psql -U estudae -d estudae
docker compose down                      # mantém os dados
docker compose down -v                   # APAGA os dados (e todo o conteúdo)
```

- **Exportar e sincronizar o banco** (10/11/2026): `scripts/banco/exportar.ps1|.sh`
  gera `backups/estudae-<data>.dump` (`pg_dump -Fc --no-owner`, feito dentro do
  container e copiado com `docker cp -q`, porque redirecionar binário no PowerShell
  corrompe); `scripts/banco/restaurar.ps1|.sh` faz backup do atual, `pg_restore
--clean --if-exists --single-transaction` e roda o `migrate`. `backups/` fica no
  `.gitignore`. Os `.sh` têm `MSYS_NO_PATHCONV=1` (Git Bash troca `/tmp/...` por
  caminho do Windows) e `.gitattributes` força LF. O dump leva também as imagens
  (tabela `imagem`): é a forma de compartilhar o conteúdo.

- **`migrate`:** a mesma imagem com `command: ["migrar"]` (subcomando da
  API, `Cli/MigrarComando.cs`). Roda uma vez; a `api` só sobe com
  `service_completed_successfully`. Escolhido no lugar do `efbundle` para
  não precisar do `dotnet-ef` no build.
- **Segredo:** `POSTGRES_PASSWORD` vem do `.env` e é obrigatória (`${...:?}`);
  a connection string da API é montada no compose (`Host=db;Port=5432`).
  `API_PORT` (padrão 8080) e `DB_PORT` também vêm do `.env`.
- **Imagem:** leva só a API e o front no `wwwroot`. Nenhum conteúdo: para
  importar, a pasta do JSON é montada com `-v`.

- **Host/porta:** `localhost:${DB_PORT}`, publicada só em `127.0.0.1`. A
  porta do host vem de `DB_PORT` no `.env` (não comitado; ver
  `.env.example`) e cai para 5432 se não estiver definida. Nesta máquina o
  `.env` define `DB_PORT=5434`, porque a 5432 e a 5433 já estão ocupadas por um Postgres
  nativo do Windows. Dentro do container o Postgres continua sempre na 5432.
  Importante: `ss`/`netstat` dentro do WSL **não** mostram listeners do
  Windows, então conflito de porta só aparece na hora do bind.
- **Banco / usuário:** `estudae` / `estudae`. Senha no `.env`
  (`POSTGRES_PASSWORD`); o volume de dev desta máquina foi criado com
  `estudae_dev`.
- **Volume:** `upx6-projeto_pgdata` (o Compose prefixa nomes de volume com o
  nome do projeto, que por padrão é o nome da pasta).
- **A connection string depende de onde a API roda:** no host (fase 3) usa
  `Host=localhost;Port=<DB_PORT>` (5434 nesta máquina); dentro do Compose
  usa `Host=db;Port=5432` — nome do serviço e porta interna. Dentro
  de um container, `localhost` é o próprio container, não o banco. Como ela
  chega na API: ver "Walking skeleton" abaixo.
- O healthcheck usa `pg_isready -h 127.0.0.1` de propósito: pelo socket unix
  ele pode responder "pronto" enquanto o servidor temporário do `initdb` ainda
  está no ar. É o que sustenta o `depends_on: condition: service_healthy`.
- As variáveis `POSTGRES_*` só valem na **primeira** inicialização do volume.
  Mudar a senha no compose não altera nada num banco que já existe — é preciso
  `down -v` (que apaga tudo) ou um `ALTER ROLE`.

### Modelo de dados (fase 2 — concluída)

**Fonte da verdade: `backend/DatabaseDocs/ModelodeDados.md`** (com o diagrama
em `ModelodeDados.svg` ao lado). Aqui fica só o resumo; qualquer mudança vai para
lá, no mesmo commit da migration.

- **Entidades:** `Disciplina` → `Tema` → `Videoaula` e `Questao`; `Tentativa`
  e `AulaAssistida` ligam o usuário (`usuario`, do Identity) ao conteúdo.
  As tabelas do Identity ganham nomes em português (`usuario`, `papel`,
  `usuario_papel`...), configurados na fase 3 antes da primeira migration.
- **Escopo:** Ensino Fundamental e Médio (`disciplina.nivel`), Linguagens e
  Matemática. Questões com figura/tabela/gráfico levam o recorte da prova
  (`imagem_url` + `imagem_descricao`); os bytes ficam na tabela `imagem`
  (chave `caminho` = `imagem_url`, sem FK), servidos pela API em
  `/conteudo/imagens/{caminho}` com ETag (`sha256`).
- **Decisões deliberadas:**
  - Sem tabela `Area` (área = disciplina) e sem tabela `Prova`:
    `prova_ano`, `prova_edicao` e `prova_nivel` são colunas opcionais em
    `Questao`, porque o aluno nunca vê a prova inteira, só a origem da questão.
  - Vídeo pertence só a um `Tema` (vídeo por questão é ideia para o futuro).
  - Alternativas são uma lista de textos dentro de `Questao`; a resposta
    correta e a alternativa escolhida também são guardadas como **texto**, para
    poder embaralhar a ordem na exibição.
  - Todas as tentativas são guardadas, e `acertou` é gravado na hora da
    resposta.
  - `Questao` tem `status` (`rascunho`/`publicada`; o site só mostra
    publicada), `prova_numero` (opcional) e `codigo` (texto único, chave
    natural do importador: reimportar o mesmo código atualiza, não duplica).
    `videoaula` é única por (`tema_id`, `youtube_id`).
- **Tabelas existentes:** Identity (migration `InicialIdentity`) e conteúdo
  — `disciplina`, `tema`, `videoaula`, `questao` (migration `Conteudo`).
  `tentativa` e `aula_assistida` ainda não existem (fora do MVP).
- **Convenções de conteúdo** (matemática em LaTeX renderizado com KaTeX,
  delimitadores `\( \)` e `\[ \]` em vez de `$`, tabelas como imagem,
  fluxo de importação com script Python fora da app): ver a seção
  "Convenções de conteúdo" em `ModelodeDados.md`.
- **Convenções:** tabelas e colunas em português sem acento; `snake_case` no
  banco (via `EFCore.NamingConventions`) e `PascalCase` no C#. Chaves `int` no
  conteúdo, `bigint` em `Tentativa`, padrão do Identity no usuário. Datas em
  UTC. O importador de conteúdo referencia disciplina e tema por **slug**,
  nunca por id, para o mesmo arquivo servir em qualquer ambiente.

### Estrutura da solução

O `src/` da raiz é o frontend, então o backend fica inteiro em `backend/`:

```
backend/
├─ Estudae.slnx            formato novo de solução (padrão no .NET 10)
├─ global.json             fixa o SDK em 10.0.x
├─ dotnet-tools.json       dotnet-ef como ferramenta local (versão fixa)
├─ Dockerfile            multi-stage; build context = raiz do repo
├─ src/
│  ├─ Estudae.Domain/      entidades de conteúdo (Conteudo/); não depende de nada
│  ├─ Estudae.Infra/       → Domain. Usuario, EstudaeDbContext, Configuracoes/,
│  │                         migrations, Importacao/, AddInfra()
│  └─ Estudae.Api/         → Infra. Program.cs, Endpoints/, Cli/ (importar, migrar)
└─ tests/
   └─ Estudae.Tests/       xUnit: unidade (importador) + integração (API, Postgres)
```

- **Domain não depende de nada** (nem EF Core, nem ASP.NET). Por isso
  `Usuario : IdentityUser` mora na Infra, e o Domain referencia o usuário só
  por `UsuarioId` (string).
- **Clean Architecture gradual:** sem projeto Application, MediatR, CQRS ou
  repositório genérico por enquanto. O plano era o Application entrar com o
  ticket de conteúdo, mas pelo prazo do MVP o importador ficou na Infra e os
  endpoints usam o `DbContext` direto. Revisitar depois do MVP.

**Convenção de nomes:** tudo que criamos leva o nome do produto, _Estudaê_
(container `estudae-db`, banco `estudae`, projetos `Estudae.*`). _Encceja_ é o
nome do **exame**, não do produto — usar só para conceitos de domínio e texto
voltado ao usuário (ex.: a coluna `prova_ano`, o conteúdo das questões).

### API de conteúdo (MVP)

Contrato completo para o front: **`docs/api.md`**. Código em
`Estudae.Api/Endpoints/` (minimal APIs, `DbContext` direto, sem camada
Application por enquanto).

- `GET /api/disciplinas`, `GET /api/disciplinas/{d}/temas`,
  `GET /api/disciplinas/{d}/temas/{t}/questoes`, `POST /api/questoes/{id}/resposta`.
- Só conteúdo publicado; os GETs projetam para DTOs sem gabarito/resolução.
  Alternativas embaralhadas no servidor. A correção normaliza o texto com
  `LeitorConteudo.NormalizarTexto` (a mesma regra do importador). Nada é gravado.
- Erros sempre `{ "erro": "..." }` (`Endpoints/Erros.cs`, com
  `ThrowOnBadRequest` para JSON malformado também cair lá).
- CORS só em Development, para origens `localhost`.

### Importador de conteúdo

Formato, regras e comandos: **`docs/conteudo/README.md`**. Resumo:

- O JSON (um por disciplina) é só o meio de entrada, **fora do repo**; as imagens
  em `imagens/` ao lado dele entram no banco na mesma transação, e as que não
  estiverem lá precisam já estar no banco. Exemplos inventados (válido e
  inválidos) em `docs/conteudo/exemplos/`, usados pelos testes.
- São subcomandos da API (vão junto na imagem):
  `importar <x.json> [--publicar] [--validar]` e `importar-imagens <pasta>`.
  No `dotnet run`, caminho absoluto, porque ele roda a partir da pasta do projeto.
- Código: leitura/normalização/validação/gravação em `Estudae.Infra/Importacao/`
  (`GravadorImagens` não salva sozinho, para entrar na transação das questões);
  a linha de comando em `Estudae.Api/Cli/`.
- Qualquer erro aborta tudo (lista todos, com questão e campo). Reimportar
  atualiza por chave natural (`codigo`, slug, `youtube_id`); nada é apagado.
  Sem `--publicar` grava como rascunho, inclusive o que já estava publicado.

### Ordem de trabalho (fases)

1. **Postgres em Docker** — ✅ **concluída**: `docker-compose.yml` na raiz,
   volume nomeado e healthcheck com `pg_isready` (detalhes acima)
2. **Análise de features e modelagem de dados** — ✅ **concluída**: modelo
   em `backend/DatabaseDocs/ModelodeDados.md`. Nenhuma tabela foi criada.
3. **Walking skeleton** — ✅ **concluída** (ver "Walking skeleton" abaixo):
   estrutura de solução, API com `/health`, EF Core conectado ao Postgres,
   primeira migration só com as tabelas do Identity
4. **Dockerfile multi-stage + compose completo** — ✅ **concluída**
   (`db` → `migrate` → `api`, front no `wwwroot`, senha no `.env`)
5. **CI com GitHub Actions** — ✅ **concluída** (`.github/workflows/ci.yml`):
   job `backend` (build, testes com Postgres como _service container_,
   `--validar` do exemplo de conteúdo) e job `compose` (sobe o compose num
   banco vazio e faz smoke test de `/health`, `/` e `/api/disciplinas`)
6. **Primeiro deploy** — ⏭️ **segunda à tarde**. Plano A (VM + compose +
   Caddy) ou B (Render); a decisão é da pessoa. Smoke test `/health` depois do
   deploy. CD automatizado fica para depois do MVP
7. **Primeiro ticket real** — ✅ **adiantado para o MVP**: tabelas de
   conteúdo, importador e API de leitura/correção, com testes
8. Próximos tickets: integração do front, login, tentativas, manutenção

Por que essa ordem:

- (Plano original) o primeiro deploy seria do _skeleton_, para provar o
  caminho até produção com o mínimo de código. Com o prazo do MVP, o deploy
  veio depois do conteúdo; o smoke test do compose no CI cobre parte desse risco.
- CI/CD vem antes do primeiro ticket real: toda feature já nasce com testes
  e pipeline, em vez de ganhá-los depois de já existir sem nenhum dos dois.
- O modelo de dados completo é desenhado com antecedência (fase 2), mas as
  tabelas só são criadas quando um ticket realmente precisa delas, uma
  migration por vez — é assim que o schema cresce em projetos reais.

### Notas sobre deploy e custo

- **Plano A (VM):** o mesmo compose de dev + um serviço Caddy nas portas
  80/443 (HTTPS automático; dá para usar `<ip>.sslip.io` sem domínio). O
  banco não publica porta. Backup é manual: cron com `pg_dump`, e testar uma
  restauração. Por ser uma VM só, a operação (atualizações, backup) fica com a gente.
- **Plano B (Render):** usa só o Dockerfile. O Postgres grátis expira em 30
  dias e o serviço grátis "dorme" sem tráfego. As migrations rodariam pelo
  `migrar` antes do start.
- Em qualquer caso: alerta de orçamento desde o primeiro dia.

### Requisitos e restrições

- **Acessibilidade é prioridade:** fontes grandes, alto contraste, fluxo
  simples, poucos cliques (público-alvo são pessoas idosas)
- **Conteúdo:** verificar os termos de uso do INEP para provas anteriores;
  vídeos são embeds do YouTube, nunca hospedados por nós
- **O maior gargalo é conteúdo, não código:** cadastrar questões e
  resoluções. É preciso um mecanismo de import em massa (JSON/CSV).

### Walking skeleton (fase 3 — concluída)

Comandos (rodar dentro de `backend/`, com o Postgres do compose de pé):

```bash
dotnet tool restore                      # instala o dotnet-ef local
dotnet user-secrets set ConnectionStrings:Estudae \
  "Host=localhost;Port=<DB_PORT>;Database=estudae;Username=estudae;Password=estudae_dev" \
  --project src/Estudae.Api              # uma vez por máquina
dotnet ef database update --project src/Estudae.Infra --startup-project src/Estudae.Api
dotnet run --project src/Estudae.Api     # GET /health → 200 Healthy / 503 Unhealthy
```

- **Connection string:** chave `ConnectionStrings:Estudae`, **nunca em
  arquivo versionado**. O `dotnet run` não lê o `.env` (quem lê é o
  `docker compose`). No host ela vem dos _user-secrets_ (só no ambiente
  Development, guardados em `~/.microsoft/usersecrets/`, fora do repo); em
  container virá da variável `ConnectionStrings__Estudae`. Sem ela, a API
  para na inicialização com uma mensagem dizendo o que configurar. A porta
  fica repetida no `.env` e nos user-secrets (custo aceito).
- **Migrations:** ficam em `Estudae.Infra/Persistence/Migrations`. O
  `--startup-project` é a Api porque é de lá que o `dotnet ef` lê a
  configuração. Nova migration:
  `dotnet ef migrations add <Nome> --project src/Estudae.Infra --startup-project src/Estudae.Api --output-dir Persistence/Migrations`.
- **`/health`:** `MapHealthChecks` + `AddDbContextCheck` (testa o banco pelo
  mesmo DbContext do app). Resposta só com `Healthy`/`Unhealthy`. No deploy,
  avaliar separar em `/health/live` (sem banco) e `/health/ready` (com banco), para
  uma queda do Postgres não fazer a plataforma reiniciar a API à toa.
- **Identity:** `AddIdentity<Usuario, IdentityRole>()` (cookie padrão).
  Precisa também de `AddAuthorization()`, que o `AddIdentity` não registra.
  Endpoints de login/cadastro e o comportamento 401 vs. redirecionamento
  ficam para o ticket de autenticação.

### Decisões em aberto

- Registrar em `docs/decisoes/` (ADRs) as decisões "frontend no `wwwroot`
  com cookie" e "Clean Architecture gradual". Formato combinado: Status /
  Data / Contexto / Decisão / Alternativas consideradas / Consequências / O
  que nos faria mudar de ideia. Preencher juntos.
- `videoaula.tipo` é mesmo necessário?
- `aula_assistida`: uma marca só por aluno e vídeo, ou manter histórico?
- ~~As questões terão imagens?~~ Sim (10/11/2026): recorte da prova + texto
  alternativo; ver `ModelodeDados.md`.
- Formato de `prova_edicao` (hoje texto: `"Nacional"` ou `"Reaplicação (PPL)"`)
- **Termos de uso do INEP** para reaproveitar provas anteriores: ainda em
  aberto. As 240 questões de 2022 estão publicadas só no banco local; publicar
  fora dele depende dessa conferência (registrado no guia de entrega).

## Pontos de atenção para quem for continuar o projeto

- Catálogo: 264 questões (só 2022 entre as oficiais). Os temas novos não têm
  vídeo; os do Fundamental, nenhum. As 480 referências de outros anos do pacote
  de questões não têm texto e ficaram de fora.
- **Tela da questão** (`src/components/questao.js`, usado pela lição e pelo
  simulado): "Ouvir questão" no topo → imagem em largura total ("Toque para
  ampliar") → texto de apoio em cartão próprio, com `white-space: pre-line`
  (versos e quadrinhos em linhas separadas) → pergunta → fonte. Botões da
  questão fixos no rodapé (`.quiz-nav--fixa`). O simulado esconde a barra de
  baixo. **Imagem em tela cheia:** `<dialog>` nativo (foco preso, Esc, voltar
  do celular fecha via `history.pushState`), zoom por pinça ou botões +/−
  (100–300%), área rolável focável pelo teclado. O texto alternativo fica no
  botão que abre a imagem. Com "reduzir movimento", o CSS do projeto dá
  transição de 0,01 ms a tudo: testes que medem largura precisam esperar.
- **Progresso** (`src/screens/Progresso.tsx`): resumo em atividades da prova
  escolhida (dias seguidos, lições, % de acertos), "Continuar estudando" pela
  matéria estudada por último, um cartão por matéria (aulas vistas e questões
  acertadas) e o histórico, tudo filtrado pelo `nivel` do store.
- **Escolha de prova no app:** `/nivel` (`src/screens/Nivel.tsx`), guardada em
  `estudae:nivel`; a guarda `RequireNivel` manda para lá quem ainda não
  escolheu. Início, simulado e Progresso filtram por `nivel` no store
  (`materiasDoNivel` em `core/catalogo.ts`). Na interface se chama "prova",
  porque "nível" já é a gamificação do Perfil.
- O conteúdo não está no repo: um clone novo sobe com o site vazio até
  restaurar um `.dump`. Exporte depois de mudar conteúdo.
- Esta máquina não tem o .NET SDK: build e testes do backend rodaram no
  container `mcr.microsoft.com/dotnet/sdk:10.0`.
- Testes: `backend/tests/Estudae.Tests` (xUnit, `dotnet test`). Os de
  integração (`Api/`) precisam de Postgres: o `ApiFixture` usa
  `ConnectionStrings__Estudae` ou os user-secrets da Api e cria/apaga um
  banco `estudae_teste_<guid>`. Sem linter.
- O SVG do modelo de dados ainda é o da v1 (o Mermaid do `.md` é o atual).
- A imagem loga `Cannot load library libgssapi_krb5.so.2`: é o Npgsql
  procurando Kerberos, e não afeta nada.
- Não há `package.json` na raiz; scripts e dependências React/Vite ficam em `frontend/`.
- Aprendizagem adaptativa (Fase 2): módulos puros e persistência em
  `frontend/src/core/aprendizagem/`, ponte das telas em `core/capturaAprendizagem.ts`.
  Flags desligadas e allowlist de temas vazia por padrão. Legado não é promovido a
  evidência. `fake-indexeddb` é apenas dependência de teste, não storage de produção.
  Para verificar: `npm test`, `npm run lint`, `npm run build` em `frontend/`.
- Demonstração por iterações sem relógio: `npx vitest run
src/core/aprendizagem/dominio.test.ts --testNamePattern="demonstração por iterações"`.
  Resultado demonstrativo isolado não concede domínio temporal nem grava conquistas.
  A UI adaptativa ainda depende da fase seguinte e da aprovação do piloto.
- Integração backend deve usar Postgres isolado sem montar o volume real. O fixture
  cria e apaga bancos `estudae_teste_<guid>`; confirmar autorização específica antes
  dessa execução. Escritores de conteúdo/curadoria precisam adquirir o lock comum
  de `EstudaeDbContext` antes de ler dados a alterar. UUID público de revisão não é
  a impressão SHA-256 interna exigida para aprovação pedagógica.
- `.gitignore` cobre padrões de Node/JS e artefatos de build do .NET
  (`bin/`, `obj/`, `.vs/`, `*.user`), e também ignora
  `appsettings.Development.json`.
