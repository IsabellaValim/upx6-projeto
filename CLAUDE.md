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

- **Frontend (`src/`, `index.html`):** todas as telas da SPA existem e
  funcionam, mas com **conteúdo placeholder** (`src/data.js`). Sem backend
  real ainda.
- **Backend:** sem código de aplicação ainda. Fase 1 (Postgres em Docker) e
  fase 2 (modelagem) concluídas. `backend/` só tem a documentação do modelo
  de dados (`backend/DatabaseDocs/`).
- PRs já mergeados em `main`: #1 (componentização do frontend) e #2
  (Postgres de desenvolvimento via docker-compose).

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
- **Conteúdo placeholder:** `src/data.js` — `SUBJECTS` (pt/mat, tópicos,
  vídeo-aulas, questões com gabarito e explicação) e `LESSON_KINDS`. As telas
  foram feitas com conteúdo de exemplo, então **`data.js` não é
  especificação**: a estrutura dele (rótulos de "area", tipos de vídeo etc.)
  só indica a experiência pretendida. O modelo real é o de
  `backend/DatabaseDocs/ModelodeDados.md`.
- **O que fica no `localStorage` hoje:** tudo existe só no navegador, sem
  conta real por trás, então **não há progresso para migrar** para o banco.
  - `estudae:user`: visitante ou um usuário de mentira do login/cadastro.
  - `estudae:a11y`: preferências de acessibilidade (fonte, contraste etc.).
    Não é progresso — **continua no navegador para todo mundo**, inclusive
    visitante.
  - `estudae:results`: **uma entrada por quiz inteiro** (`subject`, `date`,
    `correct`, `total`, `weakTopic`), com as respostas aninhadas em `items`
    (`q`, `chosen`, `ok`). `chosen` é a *posição* da alternativa, não o
    texto. Versão inicial de `Tentativa`, mas o banco guarda uma tentativa
    por questão; sessão de quiz está fora do escopo por enquanto.
  - `estudae:watched`: mapa `"materia/tema/aula"` → timestamp. É um
    liga/desliga (desmarcar apaga a chave), ou seja, uma marca por aula,
    como o `AulaAssistida` atual.
- **Pendência futura no frontend:** hoje o visitante grava progresso
  (`results`, `watched`) no `localStorage`. A decisão é que **visitante não
  grava nada** — mudar isso quando o frontend for ligado à API, não agora.
- **Componentes reutilizáveis:** `src/components/` — `nav.js` (bottom-nav +
  botão voltar), `sheet.js` (bottom-sheet de escolha rápida), `progress.js`
  (barras de aproveitamento + histórico, usados em Progresso e Perfil).
- **Utilitários:** `src/core/utils.js` (puro, sem DOM/estado: `esc`, `go`,
  `pct`, `shuffle`, etc.), `src/core/stats.js` (métricas derivadas: streak,
  score por matéria, aulas assistidas), `src/core/speech.js` (Web Speech API),
  `src/core/toast.js`, `src/core/dom.js` (refs de `#app`/`#sheet-root`/`#toast`).
- **Estilos:** `src/styles/` dividido por responsabilidade — `base.css`
  (tokens/reset), `layout.css`, `components.css`, `screens.css`,
  `navigation.css`, `responsive.css`.
- **Convenções:** comentários e nomes de tela/arquivo em pt-BR; sem
  TypeScript, sem framework, sem bundler.

## Backend — planejado

Ainda não implementado (nenhum código de aplicação em `backend/` ainda). Plano:

### Stack decidida
- **Backend:** ASP.NET Core Web API (.NET 8 LTS), EF Core + Npgsql
- **Banco de dados:** PostgreSQL rodando em Docker
- **Frontend:** as telas vanilla JS já existentes. *Onde* elas são servidas
  (`wwwroot` da API ou container nginx separado) ainda está em aberto — ver
  "Decisões em aberto".
- **Auth:** ASP.NET Identity com autenticação por cookie (login e cadastro
  fazem parte do escopo desde o início). Dois papéis, via roles do Identity:
  **Administrador** (gerencia conteúdo; a área admin é um ticket próprio,
  mais adiante) e **Aluno**. Visitante usa o site sem conta e não grava nada
  — não existe no banco.
- **Containerização:** Docker (Dockerfile multi-stage) + docker-compose
- **CI/CD:** GitHub Actions
- **Hospedagem:** Azure, usando os US$100 de crédito gratuito

### Banco de dados de desenvolvimento (fase 1 — funcionando)

O `docker-compose.yml` da raiz sobe o Postgres de desenvolvimento:

```bash
docker compose up -d --wait              # sobe e espera ficar healthy
docker compose exec db psql -U estudae -d estudae
docker compose down                      # mantém os dados
docker compose down -v                   # APAGA os dados
```

- **Host/porta:** `localhost:${DB_PORT}`, publicada só em `127.0.0.1`. A
  porta do host vem de `DB_PORT` no `.env` (não comitado; ver
  `.env.example`) e cai para 5432 se não estiver definida. Nesta máquina o
  `.env` define `DB_PORT=5433`, porque a 5432 já está ocupada por um Postgres
  nativo do Windows. Dentro do container o Postgres continua sempre na 5432.
  Importante: `ss`/`netstat` dentro do WSL **não** mostram listeners do
  Windows, então conflito de porta só aparece na hora do bind.
- **Banco / usuário / senha:** `estudae` / `estudae` / `estudae_dev` — só
  desenvolvimento local; vai para um `.env` na fase de secrets.
- **Volume:** `upx6-projeto_pgdata` (o Compose prefixa nomes de volume com o
  nome do projeto, que por padrão é o nome da pasta).
- **A connection string depende de onde a API roda:** na fase 3 ela roda no
  host e usa `Host=localhost;Port=<DB_PORT>` (5433 nesta máquina); na fase 4,
  dentro do Compose, usa
  `Host=db;Port=5432` — nome do serviço e porta interna. Dentro de um
  container, `localhost` é o próprio container, não o banco.
- O healthcheck usa `pg_isready -h 127.0.0.1` de propósito: pelo socket unix
  ele pode responder "pronto" enquanto o servidor temporário do `initdb` ainda
  está no ar. Na fase 4 isso permite `depends_on: condition: service_healthy`.
- As variáveis `POSTGRES_*` só valem na **primeira** inicialização do volume.
  Mudar a senha no compose não altera nada num banco que já existe — é preciso
  `down -v` (que apaga tudo) ou um `ALTER ROLE`.

### Modelo de dados (fase 2 — concluída)

**Fonte da verdade: `backend/DatabaseDocs/ModelodeDados.md`** (com o diagrama
em `.png`/`.svg` ao lado). Aqui fica só o resumo; qualquer mudança vai para
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
- **Convenções:** tabelas e colunas em português sem acento; `snake_case` no
  banco (via `EFCore.NamingConventions`) e `PascalCase` no C#. Chaves `int` no
  conteúdo, `bigint` em `Tentativa`, padrão do Identity no usuário. Datas em
  UTC. O importador de conteúdo referencia disciplina e tema por **slug**,
  nunca por id, para o mesmo arquivo servir em qualquer ambiente.

### Estrutura de solução proposta
```
estudae/
├─ src/Estudae.Api/      (controllers, wwwroot com o frontend)
├─ src/Estudae.Domain/   (entidades)
├─ src/Estudae.Infra/    (EF Core, migrations)
├─ docker-compose.yml
└─ Dockerfile
```

**Convenção de nomes:** tudo que criamos leva o nome do produto, *Estudaê*
(container `estudae-db`, banco `estudae`, projetos `Estudae.*`). *Encceja* é o
nome do **exame**, não do produto — usar só para conceitos de domínio e texto
voltado ao usuário (ex.: a coluna `prova_ano`, o conteúdo das questões).

### Ordem de trabalho (fases)
1. **Postgres em Docker** — ✅ **concluída**: `docker-compose.yml` na raiz,
   volume nomeado e healthcheck com `pg_isready` (detalhes acima)
2. **Análise de features e modelagem de dados** — ✅ **concluída**: modelo
   em `backend/DatabaseDocs/ModelodeDados.md`. Nenhuma tabela foi criada.
3. **Walking skeleton** — ⏭️ **próxima fase** (ver "Próxima tarefa"):
   estrutura de solução, API com `/health`, EF Core conectado ao Postgres,
   primeira migration só com as tabelas do Identity (nenhuma tabela de
   conteúdo ainda)
4. **Dockerfile multi-stage** (SDK builda, runtime executa) + compose
   completo (API + Postgres conversando pelo nome do serviço)
5. **CI com GitHub Actions:** build + dois testes pequenos — o endpoint
   `/health` via `WebApplicationFactory`, e aplicar todas as migrations num
   Postgres vazio subido como *service container* do job
6. **Primeiro deploy do skeleton no Azure** — manual primeiro
   (Container Registry, Container Apps, Postgres gerenciado criados à mão),
   depois automatizado com CD (pipeline builda, publica no registry e
   atualiza o Container App), com uma chamada a `/health` depois do deploy
   como *smoke test*
7. **Primeiro ticket real** (uma feature de produto), já com testes,
   passando pelo pipeline
8. Próximos tickets e manutenção

Por que essa ordem:
- O primeiro deploy é do *skeleton*, não de uma feature: o objetivo é
  provar que o caminho do código até produção funciona com o mínimo de
  código possível — assim, se algo quebrar, é claramente infraestrutura e
  não lógica de negócio.
- CI/CD vem antes do primeiro ticket real: toda feature já nasce com testes
  e pipeline, em vez de ganhá-los depois de já existir sem nenhum dos dois.
- O modelo de dados completo é desenhado com antecedência (fase 2), mas as
  tabelas só são criadas quando um ticket realmente precisa delas, uma
  migration por vez — é assim que o schema cresce em projetos reais.

### Notas sobre Azure e custo
- Azure Container Apps (escala a zero) + Azure Container Registry (tier
  Basic)
- PostgreSQL Flexible Server (Burstable) é o item mais caro — estimar pela
  calculadora de preços da Azure. Um container de Postgres com volume é mais
  barato, mas os backups passam a ser manuais.
- Configurar um alerta de orçamento desde o primeiro dia e apagar recursos
  quando não estiverem em uso.

### Requisitos e restrições
- **Acessibilidade é prioridade:** fontes grandes, alto contraste, fluxo
  simples, poucos cliques (público-alvo são pessoas idosas)
- **Conteúdo:** verificar os termos de uso do INEP para provas anteriores;
  vídeos são embeds do YouTube, nunca hospedados por nós
- **O maior gargalo é conteúdo, não código:** cadastrar questões e
  resoluções. É preciso um mecanismo de import em massa (JSON/CSV).

### Próxima tarefa: walking skeleton (fase 3)

Só começa com o "pode seguir". Objetivo: o mínimo de código que prova que
API + EF Core + Postgres funcionam juntos.

- Criar a solução com `src/Estudae.Api`, `src/Estudae.Domain` e
  `src/Estudae.Infra` (estrutura acima).
- `GET /health` na API.
- EF Core + Npgsql + `EFCore.NamingConventions` (snake_case) no
  `Estudae.Infra`, conectado ao Postgres do compose
  (`Host=localhost;Port=<DB_PORT>`).
- ASP.NET Identity com cookie configurado, e a primeira migration contendo
  **só as tabelas do Identity**. Disciplina, Tema etc. entram depois, cada
  uma com o ticket que precisar dela.
- Pronto quando: `dotnet run` sobe, `/health` responde, e
  `dotnet ef database update` cria as tabelas do Identity no banco.

### Decisões em aberto
- Frontend em `wwwroot` (mesma origem, mais simples) ou num container nginx
  separado (mais aprendizado: multi-container, CORS, JWT)
- `videoaula.tipo` é mesmo necessário?
- `aula_assistida`: uma marca só por aluno e vídeo, ou manter histórico?
- As questões terão imagens (`imagem_url`)?
- Formato de `prova_edicao` (texto ou número)
- Termos de uso do INEP para reaproveitar provas anteriores, e a fonte e o
  formato de importação das questões

## Pontos de atenção para quem for continuar o projeto

- O conteúdo do frontend é placeholder (`src/data.js`) — poucas questões por
  matéria. Qualquer feature que dependa de volume de conteúdo real vai expor
  isso.
- Não há testes automatizados nem linter configurado ainda.
- Não há `package.json` na raiz (frontend não tem dependências de build).
- `.gitignore` já cobre padrões de Node/JS e também artefatos de build do
  .NET (`bin/`, `obj/`, `.vs/`, `*.user`) para quando o backend entrar.
