# Estudaê — guia do projeto

Plataforma web para ajudar pessoas (foco em idosos) a estudar para o
**Encceja** (exame de certificação de ensino fundamental/médio do Brasil).
Projeto acadêmico (UPX). Repositório: `IsabellaValim/upx6-projeto`.

Acessibilidade é requisito central, não um extra: textos grandes, poucos
cliques, alto contraste, leitura em voz alta. Qualquer mudança de UI deve
preservar isso.

## Estado atual do repositório

- **Frontend (`src/`, `index.html`):** pronto e funcional — todas as telas da
  SPA existem e funcionam com dados mockados em memória/`localStorage`. Sem
  backend real ainda.
- **Backend:** sem código de aplicação ainda. A **fase 1 (Postgres em Docker)
  está concluída** — o `docker-compose.yml` da raiz sobe o banco de
  desenvolvimento. A pasta `backend/` segue vazia até a fase 3.
- Branch única até agora: `main`. Histórico mostra um PR de refactor
  (componentização) já mergeado.

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
- **Dados mockados:** `src/data.js` — `SUBJECTS` (pt/mat, tópicos, vídeo-aulas,
  questões com gabarito e explicação) e `LESSON_KINDS`. É aqui que entraria a
  integração com um backend real (hoje é só um objeto estático).
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

Ainda não implementado (nenhum código em `backend/` ainda). Plano:

### Stack decidida
- **Backend:** ASP.NET Core Web API (.NET 8 LTS), EF Core + Npgsql
- **Banco de dados:** PostgreSQL rodando em Docker
- **Frontend:** as telas vanilla JS já existentes, servidas pelo `wwwroot` da
  própria API (mesma origem — sem necessidade de CORS). Ou seja, os arquivos
  de `src/`/`index.html` deste repo devem acabar migrando para dentro do
  projeto da API.
- **Auth:** ASP.NET Identity com autenticação por cookie (login e cadastro
  fazem parte do escopo desde o início)
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

- **Host/porta:** `localhost:5433`. É 5433 porque a 5432 já está ocupada por
  um Postgres nativo do Windows nesta máquina; dentro do container o Postgres
  continua na 5432. Importante: `ss`/`netstat` dentro do WSL **não** mostram
  listeners do Windows, então conflito de porta só aparece na hora do bind.
- **Banco / usuário / senha:** `estudae` / `estudae` / `estudae_dev` — só
  desenvolvimento local; vai para um `.env` na fase de secrets.
- **Volume:** `upx6-projeto_pgdata` (o Compose prefixa nomes de volume com o
  nome do projeto, que por padrão é o nome da pasta).
- **A connection string depende de onde a API roda:** na fase 3 ela roda no
  host e usa `Host=localhost;Port=5433`; na fase 4, dentro do Compose, usa
  `Host=db;Port=5432` — nome do serviço e porta interna. Dentro de um
  container, `localhost` é o próprio container, não o banco.
- O healthcheck usa `pg_isready -h 127.0.0.1` de propósito: pelo socket unix
  ele pode responder "pronto" enquanto o servidor temporário do `initdb` ainda
  está no ar. Na fase 4 isso permite `depends_on: condition: service_healthy`.
- As variáveis `POSTGRES_*` só valem na **primeira** inicialização do volume.
  Mudar a senha no compose não altera nada num banco que já existe — é preciso
  `down -v` (que apaga tudo) ou um `ALTER ROLE`.

### Modelo de dados inicial
- `Area` (Linguagens, Matemática, Humanas, Ciências da Natureza)
- `Prova` (ano, edição, nível de ensino: fundamental/médio)
- `Questao` (enunciado, alternativas, resposta correta, área, tema, ano)
- `Resolucao` (texto de resolução, link do YouTube)
- `Usuario` (via ASP.NET Identity)
- `Tentativa` (usuário, questão, resposta escolhida, se acertou, data) — usada
  para histórico de desempenho e "revisar erros"

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
voltado ao usuário (ex.: a entidade `Prova`, o conteúdo das questões).

### Ordem de trabalho (fases)
1. **Postgres em Docker** — ✅ **concluída**: `docker-compose.yml` na raiz,
   volume nomeado e healthcheck com `pg_isready` (detalhes abaixo)
2. **Análise de features e modelagem de dados**, feita em paralelo/fora do
   código — nenhuma tabela é criada nesta fase — **fase atual**
3. **Walking skeleton:** estrutura de solução, API com endpoint `/health`,
   EF Core conectado ao Postgres, primeira migration com o mínimo possível
   (ex.: só as tabelas do Identity)
4. **Dockerfile multi-stage** (SDK builda, runtime executa) + compose
   completo (API + Postgres conversando pelo nome do serviço)
5. **CI com GitHub Actions:** build + pelo menos um teste simples em cada
   push
6. **Primeiro deploy do skeleton no Azure** — manual primeiro
   (Container Registry, Container Apps, Postgres gerenciado criados à mão),
   depois automatizado com CD (pipeline builda, publica no registry eash
   atualiza o Container App)
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

### Decisões em aberto
- Manter o frontend em `wwwroot` (mais simples) ou mover para um container
  nginx separado (mais aprendizado: multi-container, CORS, JWT)
- Fonte das questões de prova e como vai funcionar o import

## Pontos de atenção para quem for continuar o projeto

- Dados são 100% mockados em `src/data.js` — poucas questões por matéria.
  Qualquer feature que dependa de volume de conteúdo real vai expor isso.
- Não há testes automatizados nem linter configurado ainda.
- Não há `package.json` na raiz (frontend não tem dependências de build).
- `.gitignore` já cobre padrões de Node/JS e também artefatos de build do
  .NET (`bin/`, `obj/`, `.vs/`, `*.user`) para quando o backend entrar.
