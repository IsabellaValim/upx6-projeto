# Estudaê

![CI](https://github.com/IsabellaValim/upx6-projeto/actions/workflows/ci.yml/badge.svg)

Plataforma web para estudar para o **Encceja** (Exame Nacional para Certificação
de Competências de Jovens e Adultos), pensada principalmente para pessoas idosas:
telas simples, textos grandes, alto contraste, poucos cliques e leitura em voz
alta. Projeto acadêmico (UPX).

Feita para o celular — no computador, o app aparece dentro de uma moldura de
celular no centro da tela.

## O que o app faz

- **Duas provas, quatro matérias**: Linguagens e Matemática do Ensino Fundamental
  e do Ensino Médio. A prova é escolhida no primeiro acesso e trocada no Perfil.
- **Fluxo curto**: Início → Área da matéria → tema → **Ver aula** (YouTube
  incorporado, com legenda e velocidade calma) ou **Praticar** (lição de até 5
  questões com correção na hora).
- **Simulado**: questões de todos os temas da matéria, com relógio e correção só
  na entrega — como no dia da prova.
- **Progresso**: "Continuar estudando" leva direto à próxima atividade pendente;
  a aba Progresso resume atividades concluídas, dias de ofensiva e acertos.
- **Acessibilidade**: três tamanhos de fonte ("Grande" é o padrão), alto
  contraste, redução de animações e leitura em voz alta.
- **Origem da questão**: oficiais mostram a fonte (prova e ano); as da equipe,
  "Questão autoral Estudaê". Questões com figura exibem o recorte da prova, com
  descrição para leitor de tela.

Login, progresso e perfil ainda vivem **só no navegador** (`localStorage`) —
contas reais ficam para depois do MVP.

## Conteúdo

**Todo o conteúdo mora no banco, não no repositório** — inclusive as 240 imagens
das questões. Num banco novo, o site mostra "Ainda não há matérias disponíveis":
restaure um `.dump` (ver [Banco de dados](#banco-de-dados)) ou importe um JSON
novo ([`docs/conteudo/README.md`](docs/conteudo/README.md)).

| Matéria                         | Temas | Vídeo-aulas | Questões                              |
| ------------------------------- | ----- | ----------- | ------------------------------------- |
| Linguagens · Ensino Médio       | 10    | 4           | 72 (60 do Encceja 2022 + 12 autorais) |
| Matemática · Ensino Médio       | 9     | 4           | 72 (60 do Encceja 2022 + 12 autorais) |
| Linguagens · Ensino Fundamental | 10    | 0           | 60 do Encceja 2022                    |
| Matemática · Ensino Fundamental | 8     | 0           | 60 do Encceja 2022                    |

## Stack

| Parte         | Tecnologia                                                         |
| ------------- | ------------------------------------------------------------------ |
| Frontend      | React 19 + TypeScript + Vite (SPA, URLs limpas), Zustand, KaTeX    |
| Backend       | ASP.NET Core (.NET 10), EF Core 10 + Npgsql                        |
| Banco         | PostgreSQL 16, em container                                        |
| Empacotamento | Dockerfile multi-stage + Docker Compose (`db` → `migrate` → `api`) |
| CI            | GitHub Actions: build + testes + smoke test do compose             |

A própria API serve as telas no `wwwroot` (o `dist` do build do Vite): mesma
origem, um container só, sem CORS em produção. As URLs são limpas (`/home`,
`/area/matematica`...): a API devolve o `index.html` para qualquer caminho
que não seja arquivo nem `/api`, e o React Router resolve a tela.

## Como rodar

### Tudo junto (recomendado)

Pré-requisito: **Docker com Compose v2** — no Windows, o Docker Desktop com a
integração do WSL habilitada (`docker compose version`, com espaço, confere).

```bash
cp .env.example .env        # e defina POSTGRES_PASSWORD
docker compose up -d --build --wait
```

Abra `http://localhost:8080`. O Compose sobe o banco, aplica as migrations
(serviço `migrate`, que roda uma vez e termina) e depois a API.

```bash
docker compose ps                 # estado dos serviços
docker compose logs -f api        # logs da API
docker compose down               # para tudo (mantém os dados)
docker compose down -v            # ATENÇÃO: apaga os dados, inclusive todo o conteúdo
```

Se a 5432 (Postgres) ou a 8080 (site) já estiverem ocupadas, mude `DB_PORT` ou
`API_PORT` no `.env`. As portas só são publicadas em `127.0.0.1`.

### Backend em desenvolvimento (`dotnet run`)

Pré-requisito: **.NET 10 SDK** (a versão exata está em `backend/global.json`).

```bash
docker compose up -d --wait db    # só o banco
cd backend
dotnet tool restore
dotnet user-secrets set ConnectionStrings:Estudae \
  "Host=localhost;Port=<DB_PORT>;Database=estudae;Username=estudae;Password=<POSTGRES_PASSWORD>" \
  --project src/Estudae.Api       # uma vez por máquina
dotnet ef database update --project src/Estudae.Infra --startup-project src/Estudae.Api
dotnet run --project src/Estudae.Api    # API em http://localhost:5151
dotnet test                           # precisa do banco de pé
```

### Só o frontend (desenvolvimento)

O app React mora em `frontend/` e roda com o dev server do Vite, que já faz
proxy de `/api` e `/conteudo` para `http://localhost:5151` (a API do
`dotnet run` — suba o banco e a API como na seção acima):

```bash
cd frontend
npm ci          # primeira vez
npm run dev     # http://localhost:5173
npm test        # testes (Vitest)
npm run lint    # oxlint
npm run build   # gera frontend/dist (o que vai para o wwwroot na imagem)
```

Progresso e preferências continuam no `localStorage` do navegador (chaves
`estudae:*`), sem conta real por trás.

## Banco de dados

Os dados ficam no volume `upx6-projeto_pgdata`, no seu computador: rebuilds,
reinícios e `docker compose down` não apagam — só `down -v` apaga. O banco é a
**única fonte** do conteúdo (não há cópia no repositório): exporte depois de cada
mudança e guarde o `.dump` fora do computador.

Para abrir num cliente (DBeaver, pgAdmin, `psql`): host `localhost`, porta
`DB_PORT` do `.env`, banco e usuário `estudae`, senha `POSTGRES_PASSWORD`. Sem
instalar nada: `docker compose exec db psql -U estudae -d estudae`.

### Exportar

```bash
powershell -ExecutionPolicy Bypass -File scripts/banco/exportar.ps1   # Windows
sh scripts/banco/exportar.sh                                          # Linux, Mac, Git Bash
```

Gera `backups/estudae-<data>.dump` com o banco inteiro — ~17 MB porque leva
também as imagens. A pasta `backups/` fica fora do git: mande o arquivo por
outro meio (Drive, e-mail).

### Restaurar

```bash
powershell -ExecutionPolicy Bypass -File scripts/banco/restaurar.ps1 -Arquivo backups/estudae-<data>.dump
sh scripts/banco/restaurar.sh backups/estudae-<data>.dump
```

**Substitui** o conteúdo local pelo do arquivo. Antes, o script guarda o banco
atual em `backups/antes-de-restaurar-<data>.dump`, para voltar atrás. É tudo ou
nada (em erro, o banco fica como estava) e no fim aplica as migrations que
faltarem. Funciona num banco vazio: é assim que outra pessoa sincroniza com
você.

### Subir para um banco online

O `.dump` restaura em qualquer PostgreSQL 16 (VM, Render, Neon, Supabase...),
sem instalar o Postgres na máquina — usando a própria imagem do Docker:

```bash
docker run --rm -v "$PWD/backups:/b" postgres:16 \
  pg_restore --no-owner --no-privileges --clean --if-exists \
  -d "postgresql://USUARIO:SENHA@HOST:5432/BANCO" /b/estudae-<data>.dump
```

Depois, aponte a API online para esse banco (`ConnectionStrings__Estudae`).
Não deixe a senha em arquivo versionado.

## Estrutura

```text
frontend/               app React + TS + Vite (src/, testes; detalhes no CLAUDE.md)
backend/
  src/Estudae.Domain/   entidades (sem dependências)
  src/Estudae.Infra/    EF Core, migrations, importador de conteúdo
  src/Estudae.Api/      endpoints, /health, subcomandos migrar/importar/importar-imagens
  tests/Estudae.Tests/  testes de unidade e de integração
  DatabaseDocs/         modelo de dados
docs/api.md             contrato da API para o frontend
docs/conteudo/          formato de importação, exemplos e revisão das questões
scripts/banco/          exportar e restaurar o banco (é assim que o conteúdo circula)
.github/workflows/      CI
docker-compose.yml      db → migrate → api
```

## Documentação

- [`docs/api.md`](docs/api.md) — contrato da API
- [`backend/DatabaseDocs/ModelodeDados.md`](backend/DatabaseDocs/ModelodeDados.md) — modelo de dados
- [`docs/conteudo/README.md`](docs/conteudo/README.md) — como cadastrar conteúdo
- [`docs/conteudo/ENTREGA-QUESTOES-2022.md`](docs/conteudo/ENTREGA-QUESTOES-2022.md) — entrega das 240 questões para o banco oficial
- [`CLAUDE.md`](CLAUDE.md) — guia técnico do projeto e decisões

## Próximos passos

- [x] Ligar as telas à API de conteúdo
- [x] Questões com figura e tabela (recortes da prova, guardados no banco)
- [ ] Publicar o site num ambiente de demonstração (VM + Caddy ou Render)
- [ ] Revisar e incluir as questões de `docs/conteudo/curadoria-inep.md`
- [ ] Contas de aluno (login real) e progresso no banco
- [ ] Mais áreas do exame (Ciências, História, Geografia)
- [ ] Explicação de palavras ao passar o mouse
