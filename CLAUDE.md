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
- **Frontend (`src/`, `index.html`):** as telas originais, agora com o
  conteúdo vindo da API (contrato em `docs/api.md`), na branch
  `feat/front-api` (10/11/2026). Um patch alternativo, que redesenhava o front,
  foi descartado por mudar demais a estrutura (backup local em
  `backup/frontend-mvp-codex`).
- **Conteúdo:** `conteudo/portugues.json` e `matematica.json`, 4 temas, 4
  vídeos e 12 questões **autorais** cada. Questões do INEP em revisão em
  `conteudo/curadoria-inep.md`. Ainda não há ambiente de demonstração publicado.
- **Backend:** fases 1 a 5 concluídas, mais o primeiro ticket de conteúdo:
  tabelas de conteúdo, importador, endpoints de leitura e correção,
  Dockerfile, compose completo e CI. Fora do MVP: login e tentativas.
- PRs já mergeados em `main`: #1 (componentização do frontend), #2
  (Postgres de dev), #3 (modelo de dados) e #4 (walking skeleton). O MVP do
  backend está na branch `feat/dockerfile-compose`.

## Frontend — arquitetura

Sem build, sem dependências: **HTML + CSS + JS puro (ES Modules)**. Precisa
ser servido por HTTP (não abrir `index.html` via `file://`) — `python -m
http.server` ou `npx serve .`.

- **Roteamento:** `src/router.js` — SPA por hash (`#/rota`). Rotas públicas
  (`loading`, `boas-vindas`, `login`, `cadastro`) ficam em `PUBLIC`; qualquer
  outra rota exige `state.user`. Novas URLs entram em `src/core/urls.js`
  (mapa central) — não espalhar hashes hardcoded pelas telas.
- **Contrato de tela:** cada arquivo em `src/screens/` exporta uma função
  `(...params) => { cls, nav, html, after }`. `html` é a marcação (string),
  `after({ rerender })` roda pós-inserção no DOM (listeners, side effects).
  `src/core/mount.js` injeta isso em `#app`, monta a bottom-nav se `nav`
  estiver definido, e foca o `<h1>` da tela. Telas são registradas em
  `src/screens/index.js`.
- **Estado global:** `src/core/state.js` (`state`, `save.*`) — `user`, `a11y`,
  `results` (histórico de quizzes), `watched` (aulas concluídas), `quiz`
  (sessão em andamento, não persistida). Persistência em
  `src/core/store.js` via `localStorage` (prefixo `estudae:`).
- **Conteúdo (API):** `src/core/api.js` faz as chamadas (mesma origem ou
  `localStorage` `estudae:api` em dev). `src/data.js` mantém os nomes que as
  telas já usavam (`SUBJECTS`, `lessonsFor`), mas preenchidos pela API:
  `carregarCatalogo()` roda no início (o `router` só renderiza depois; se
  falhar, tela com "Tentar de novo"). `SUBJECTS` é indexado pelo **slug** da
  disciplina; `#/video/{slug}/{tema}/{aula}` e `#/quiz/{slug}/{tema}` usam a
  posição do tema (e da aula). A **lição é por tema** (`src/screens/quiz.js`,
  até `TAMANHO_LICAO` = 5 questões sorteadas de `carregarQuestoes(id, ti)`):
  marcar → "Conferir" (`POST` com o texto da alternativa) → correção na hora
  (certa/errada em texto e cor, resolução) → "Continuar". O resultado guarda
  enunciado, resposta certa e resolução (gabarito nunca fica no front). `fonte()` mostra a origem ou "Questão
  autoral Estudaê". Todo texto da API passa por `esc()`.
- **Vídeo-aula:** iframe do `youtube-nocookie.com` no layout original.
  "Legendas" recarrega o player com `cc_load_policy`; "Velocidade calma"
  manda `setPlaybackRate` pela API de iframe (`enablejsapi=1`).
- **O que fica no `localStorage` hoje:** tudo existe só no navegador, sem
  conta real por trás, então **não há progresso para migrar** para o banco.
  - `estudae:user`: visitante ou um usuário de mentira do login/cadastro.
  - `estudae:a11y`: preferências de acessibilidade (fonte, contraste etc.).
    Não é progresso — **continua no navegador para todo mundo**, inclusive
    visitante.
  - `estudae:results`: **uma entrada por quiz inteiro** (`v: 2`, `subject`,
    `date`, `correct`, `total`, `weakTopic`), com as respostas em `items`
    (`ask`, `options`, `chosen`, `answer`, `why`, `topic`, `ok`). `chosen` e
    `answer` são *posições* em `options`. Entradas sem `v: 2` (do conteúdo de
    exemplo antigo) são ignoradas ao carregar. Versão inicial de `Tentativa`, mas o banco guarda uma tentativa
    por questão; sessão de quiz está fora do escopo por enquanto.
  - `estudae:watched`: mapa `"materia/tema/aula"` → timestamp. É um
    liga/desliga (desmarcar apaga a chave), ou seja, uma marca por aula,
    como o `AulaAssistida` atual.
- **Decisão do MVP para o frontend (revista em 10/11/2026):** manter as telas
  e o visual originais (login, progresso e perfil continuam só no
  `localStorage`). Fluxo sem redundância, em até 3 toques: Início (só os
  cartões de matéria + "Continuar") → Área (lista de temas; cada cartão tem
  "Assistir aula" e "Praticar") → vídeo ou lição. Saíram a tela "Escolha como
  deseja estudar", a lista separada de vídeo-aulas e a folha "qual matéria?";
  `#/videos/{m}` e `#/quiz/{m}` antigos redirecionam para a área.
  `estudae:results` com `v: 3` = lição por tema (tem `topic`).
- **Cores de texto de acerto/erro:** `--ok-text` e `--bad-text` (base.css),
  mais escuras que `--ok`/`--bad`, para passar de 4.5:1 sobre os fundos claros.
- **Componentes reutilizáveis:** `src/components/` — `nav.js` (bottom-nav +
  botão voltar) e `progress.js` (barras de aproveitamento + histórico, usados
  em Progresso e Perfil). O `sheet.js` (folha "qual matéria?") saiu junto com
  os atalhos redundantes do início; o CSS dele e o `#sheet-root` ficaram, sem uso.
- **Utilitários:** `src/core/utils.js` (puro, sem DOM/estado: `esc`, `go`,
  `pct`, `shuffle`, etc.), `src/core/stats.js` (métricas derivadas: streak,
  score por matéria, aulas assistidas), `src/core/speech.js` (Web Speech API),
  `src/core/toast.js`, `src/core/dom.js` (refs de `#app`/`#sheet-root`/`#toast`).
- **Estilos:** `src/styles/` dividido por responsabilidade — `base.css`
  (tokens/reset), `layout.css`, `components.css`, `screens.css`,
  `navigation.css`, `responsive.css`.
- **Convenções:** comentários e nomes de tela/arquivo em pt-BR; sem
  TypeScript, sem framework, sem bundler.

## Backend

Fases 1 a 5 prontas, mais o conteúdo do MVP; o resto do plano segue abaixo.

### Stack decidida
- **Backend:** ASP.NET Core (.NET 10 LTS, suporte até nov/2028), EF Core 10
  + Npgsql. O .NET 8 estava no plano original, mas o suporte dele termina em
  nov/2026; a troca foi feita antes de existir código. `backend/global.json`
  fixa o SDK em 10.0.x.
- **Banco de dados:** PostgreSQL rodando em Docker
- **Frontend:** as telas vanilla JS já existentes, servidas pelo `wwwroot` da
  própria API (mesma origem, um container só, sem CORS). Revisitar se surgir
  um time de frontend separado ou um app mobile. O front continua na raiz
  do repo; o **Dockerfile copia** `index.html` e `src/` para `/app/wwwroot`
  (só existe dentro da imagem). Servido com `Cache-Control: no-cache` (ETag),
  porque sem bundler não há nome de arquivo com hash.
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
docker compose run --rm api importar conteudo/matematica.json --publicar
docker compose exec db psql -U estudae -d estudae
docker compose down                      # mantém os dados
docker compose down -v                   # APAGA os dados
```

- **`migrate`:** a mesma imagem com `command: ["migrar"]` (subcomando da
  API, `Cli/MigrarComando.cs`). Roda uma vez; a `api` só sobe com
  `service_completed_successfully`. Escolhido no lugar do `efbundle` para
  não precisar do `dotnet-ef` no build.
- **Segredo:** `POSTGRES_PASSWORD` vem do `.env` e é obrigatória (`${...:?}`);
  a connection string da API é montada no compose (`Host=db;Port=5432`).
  `API_PORT` (padrão 8080) e `DB_PORT` também vêm do `.env`.
- **Imagem:** leva o front no `wwwroot` e `conteudo/*.json` em
  `/app/conteudo` (sem `conteudo/exemplos/`, barrado no `.dockerignore`).

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
- **Escopo:** só Ensino Médio, e só Português e Matemática por enquanto.
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

**Convenção de nomes:** tudo que criamos leva o nome do produto, *Estudaê*
(container `estudae-db`, banco `estudae`, projetos `Estudae.*`). *Encceja* é o
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

Formato, regras e comandos: **`conteudo/README.md`**. Resumo:
- Um JSON por disciplina em `conteudo/`; exemplos (válido e inválidos) em
  `conteudo/exemplos/`, usados também pelos testes.
- É um subcomando da API (vai junto na imagem):
  `dotnet run --project src/Estudae.Api -- importar "$PWD/../conteudo/x.json" [--publicar] [--validar]`.
  Caminho absoluto, porque o `dotnet run` roda a partir da pasta do projeto.
- Código: leitura/normalização/validação/gravação em `Estudae.Infra/Importacao/`;
  a linha de comando em `Estudae.Api/Cli/ImportarComando.cs`.
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
   job `backend` (build, testes com Postgres como *service container*,
   `--validar` de `conteudo/*.json`) e job `compose` (sobe o compose num
   banco vazio e faz smoke test de `/health`, `/` e `/api/disciplinas`)
6. **Primeiro deploy** — ⏭️ **segunda à tarde**. Plano A (VM + compose +
   Caddy) ou B (Render); a decisão é da pessoa. Smoke test `/health` depois do
   deploy. CD automatizado fica para depois do MVP
7. **Primeiro ticket real** — ✅ **adiantado para o MVP**: tabelas de
   conteúdo, importador e API de leitura/correção, com testes
8. Próximos tickets: integração do front, login, tentativas, manutenção

Por que essa ordem:
- (Plano original) o primeiro deploy seria do *skeleton*, para provar o
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
  `docker compose`). No host ela vem dos *user-secrets* (só no ambiente
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
- As questões terão imagens (`imagem_url`)? (No MVP, não.)
- Formato de `prova_edicao` (texto ou número)
- Termos de uso do INEP para reaproveitar provas anteriores, e a fonte e o
  formato de importação das questões

## Pontos de atenção para quem for continuar o projeto

- O catálogo ainda é pequeno (12 questões autorais por matéria, um vídeo por
  tema). Qualquer feature que dependa de volume de conteúdo vai expor isso.
- Os JSONs de `conteudo/` vão dentro da imagem: depois de editar, rebuild
  (`docker compose up -d --build --wait`) antes de importar.
- Esta máquina não tem o .NET SDK: build e testes do backend rodaram no
  container `mcr.microsoft.com/dotnet/sdk:10.0`.
- Testes: `backend/tests/Estudae.Tests` (xUnit, `dotnet test`). Os de
  integração (`Api/`) precisam de Postgres: o `ApiFixture` usa
  `ConnectionStrings__Estudae` ou os user-secrets da Api e cria/apaga um
  banco `estudae_teste_<guid>`. Sem linter.
- O SVG do modelo de dados ainda é o da v1 (o Mermaid do `.md` é o atual).
- A imagem loga `Cannot load library libgssapi_krb5.so.2`: é o Npgsql
  procurando Kerberos, e não afeta nada.
- Não há `package.json` na raiz (frontend não tem dependências de build).
- `.gitignore` cobre padrões de Node/JS e artefatos de build do .NET
  (`bin/`, `obj/`, `.vs/`, `*.user`), e também ignora
  `appsettings.Development.json`.
