# Estudaê

Aplicativo web para estudar para o **Encceja** (Exame Nacional para Certificação de
Competências de Jovens e Adultos), pensado principalmente para pessoas idosas: telas simples,
textos grandes, alto contraste, poucos cliques e leitura em voz alta.

Projeto acadêmico desenvolvido para a UPX.

## O que o MVP faz

- **Linguagens e Matemática**, do Ensino Fundamental e do Ensino Médio, com o conteúdo vindo da API (contrato em
  [`docs/api.md`](docs/api.md)).
- **Fluxo simples:** Início (escolhe a matéria) → Área (temas) → em cada tema, **Praticar**
  ou **Ver aula**. Os temas abrem um por vez, com uma frase de descrição.
- **Progresso:** cada matéria mostra "X de Y atividades" (aulas vistas e questões acertadas),
  e o botão **Continuar estudando** leva direto à próxima atividade pendente.
- **Vídeo-aulas** por tema: YouTube incorporado, com legenda e velocidade calma opcionais.
  Logo abaixo, "Terminei a aula, quero praticar" marca a aula como vista e abre a lição.
- **Simulado:** questões de todos os temas da matéria, com tempo e correção só no fim, como
  no dia da prova. Enquanto não houver questões oficiais suficientes, é um "simulado de
  treino" com as autorais. O tamanho e o tempo ficam em `SIMULADO`, em
  `src/screens/simulado.js`.
- **Lição curta por tema:** até 5 questões sorteadas. Cada resposta é conferida na hora pela
  API, com a resposta certa destacada e a explicação; no fim, um resumo da lição.
- **Origem da questão:** questões de provas anteriores mostram a fonte (ano, edição, número);
  as escritas pela equipe aparecem como "Questão autoral Estudaê".
- **Acessibilidade:** três tamanhos de fonte (a "Grande" é o padrão), alto contraste,
  redução de animações e leitura em voz alta.
- Login, cadastro, progresso e perfil ainda são **só do navegador** (`localStorage`), sem
  conta de verdade no servidor. Contas reais ficam para depois do MVP.

### Conteúdo disponível hoje

| Matéria | Temas | Vídeo-aulas | Questões |
|---|---|---|---|
| Linguagens · Ensino Médio | 10 | 4 | 72 (60 do Encceja 2022 + 12 autorais) |
| Matemática · Ensino Médio | 9 | 4 | 72 (60 do Encceja 2022 + 12 autorais) |
| Linguagens · Ensino Fundamental | 10 | 0 | 60 do Encceja 2022 |
| Matemática · Ensino Fundamental | 8 | 0 | 60 do Encceja 2022 |

No primeiro acesso a pessoa escolhe a prova (Ensino Fundamental ou Médio), e dá para trocar
no Perfil. Questões com figura, tabela ou gráfico mostram o recorte da prova, com descrição
para leitor de tela.

**Todo o conteúdo (questões, vídeos e as 240 imagens) mora no banco, não no repositório.** Num
banco novo o site mostra "Ainda não há matérias disponíveis": peça o `.dump` mais recente a quem
mantém o conteúdo e use o `restaurar` (abaixo). Para carregar num banco oficial:
[`docs/conteudo/ENTREGA-QUESTOES-2022.md`](docs/conteudo/ENTREGA-QUESTOES-2022.md). Questões de
provas anteriores escolhidas para cada tema aguardam revisão em
[`docs/conteudo/curadoria-inep.md`](docs/conteudo/curadoria-inep.md).

## Tecnologias

| Parte | Tecnologia |
|---|---|
| Frontend | HTML + CSS + JavaScript puro (ES Modules), sem build e sem dependências |
| Backend | ASP.NET Core (.NET 10), EF Core 10 + Npgsql |
| Banco | PostgreSQL 16, em container |
| Empacotamento | Docker (Dockerfile multi-stage) + Docker Compose |
| CI | GitHub Actions |

A API também serve as telas (mesma origem, um container só).

## Estrutura

```
index.html, src/        frontend (SPA por hash; ver CLAUDE.md)
backend/                solução .NET
  src/Estudae.Domain/   entidades (sem dependências)
  src/Estudae.Infra/    EF Core, migrations, importador de conteúdo
  src/Estudae.Api/      endpoints, /health, subcomandos importar, importar-imagens e migrar
  tests/Estudae.Tests/  testes de unidade e de integração
  DatabaseDocs/         modelo de dados
docs/api.md             contrato da API para o frontend
docs/conteudo/          formato de importação, exemplos (de teste) e revisão das questões
scripts/banco/          exportar e restaurar o banco (é assim que o conteúdo é compartilhado)
docker-compose.yml      db + migrate + api
.github/workflows/      CI
```

## Pré-requisitos

| Para quê | O que instalar |
|---|---|
| Rodar o site completo | Docker + Docker Compose v2 |
| Desenvolver o backend | .NET 10 SDK (a versão exata está em `backend/global.json`) |
| Só mexer nas telas | Python 3 **ou** Node, como servidor estático |

Não é preciso instalar o PostgreSQL nem o `psql`: o banco roda em container
(`docker compose exec db psql -U estudae -d estudae`).

No Windows, o caminho mais simples é o **Docker Desktop** com a integração do WSL
habilitada. Para conferir: `docker compose version` (precisa ser v2, com espaço).

## Como executar

### Tudo junto (site + API + banco)

```bash
cp .env.example .env        # e defina POSTGRES_PASSWORD
docker compose up -d --build --wait
```

Abra `http://localhost:8080`. Na ordem, o Compose sobe o banco, aplica as migrations (serviço
`migrate`, que roda uma vez e termina) e depois a API.

```bash
docker compose ps                 # estado dos serviços
docker compose logs -f api        # logs da API
docker compose down               # para tudo (mantém os dados)
docker compose down -v            # ATENÇÃO: apaga os dados também, inclusive todo o conteúdo
```

Para ter o conteúdo, restaure um `.dump` (ver "Restaurar" abaixo). Para cadastrar conteúdo
novo a partir de um JSON: [`docs/conteudo/README.md`](docs/conteudo/README.md).

### Backend em desenvolvimento (`dotnet run`)

```bash
docker compose up -d --wait db    # só o banco
cd backend
dotnet tool restore
dotnet user-secrets set ConnectionStrings:Estudae \
  "Host=localhost;Port=<DB_PORT>;Database=estudae;Username=estudae;Password=<POSTGRES_PASSWORD>" \
  --project src/Estudae.Api       # uma vez por máquina
dotnet ef database update --project src/Estudae.Infra --startup-project src/Estudae.Api
dotnet run --project src/Estudae.Api    # API em http://localhost:5151
dotnet test                             # precisa do banco de pé
```

### Só as telas

O app usa módulos ES, então precisa ser servido por HTTP (abrir o `index.html` pelo
`file://` não funciona):

```bash
python -m http.server 8000   # ou: npx serve .
```

Em desenvolvimento, a API (`dotnet run`) aceita chamadas de qualquer `http://localhost:<porta>`.
Veja [`docs/api.md`](docs/api.md).

### Porta ocupada

Se a 5432 (Postgres) ou a 8080 (site) já estiverem em uso na sua máquina, mude `DB_PORT` ou
`API_PORT` no `.env`. As portas só são publicadas em `127.0.0.1`.

## Banco de dados: onde fica, exportar e sincronizar

**Onde os dados ficam.** No PostgreSQL do Docker, dentro do volume `upx6-projeto_pgdata`, no seu
computador e **fora do app**. Reconstruir a imagem, reiniciar ou apagar os containers não apaga
os dados; só `docker compose down -v` apaga. O app acessa o banco pela rede interna do Compose.
O banco é a **única fonte** do conteúdo (não há cópia no repositório): exporte depois de cada
mudança e guarde o `.dump` fora do computador.

**Abrir o banco numa ferramenta** (DBeaver, pgAdmin, `psql`): host `localhost`, porta `DB_PORT`
do `.env` (padrão 5432), banco e usuário `estudae`, senha `POSTGRES_PASSWORD` do `.env`. Ou, sem
instalar nada: `docker compose exec db psql -U estudae -d estudae`.

### Exportar (para mandar a alguém ou guardar)

```bash
# Windows (PowerShell), na raiz do repositório, com o compose de pé:
powershell -ExecutionPolicy Bypass -File scripts/banco/exportar.ps1
# Linux, Mac, VM ou Git Bash:
sh scripts/banco/exportar.sh
```

Gera `backups/estudae-AAAAMMDD-HHMM.dump` com **o banco inteiro**: estrutura, migrations aplicadas
e dados. A pasta `backups/` não vai para o git (pode conter dados): mande o arquivo por outro
meio (Drive, e-mail). O dump leva todo o conteúdo, **inclusive as imagens das questões** (tabela
`imagem`), por isso tem uns 17 MB.

### Restaurar (receber o banco de alguém)

```bash
# Windows:
powershell -ExecutionPolicy Bypass -File scripts/banco/restaurar.ps1 -Arquivo backups/estudae-20261110-1500.dump
# Linux, Mac, VM ou Git Bash:
sh scripts/banco/restaurar.sh backups/estudae-20261110-1500.dump
```

**Substitui** o conteúdo do seu banco local pelo do arquivo. Antes, o script guarda o banco atual
em `backups/antes-de-restaurar-<data>.dump`, para você poder voltar atrás. A restauração é
tudo ou nada (se der erro, o banco fica como estava), e no fim aplica as migrations que
faltarem, se o arquivo for de uma versão mais antiga do app. Funciona também num banco vazio,
recém-criado: é assim que outra pessoa sincroniza com você.

### Subir para um banco online

O `.dump` restaura em qualquer PostgreSQL 16 (VM, Render, Neon, Supabase...), sem instalar o
PostgreSQL na sua máquina, usando a própria imagem do Docker:

```bash
docker run --rm -v "$PWD/backups:/b" postgres:16 \
  pg_restore --no-owner --no-privileges --clean --if-exists \
  -d "postgresql://USUARIO:SENHA@HOST:5432/BANCO" /b/estudae-20261110-1500.dump
```

Depois, aponte a API online para esse banco (`ConnectionStrings__Estudae`). Não deixe a senha do
banco em arquivo versionado.

## Conteúdo

O conteúdo vive no banco. Conteúdo novo é escrito num JSON (fora do repositório) e entra
pelo importador, que confere tudo antes de gravar; as imagens ao lado do JSON vão para o
banco junto. Formato, regras, fluxo de revisão e um prompt para extrair questões com IA:
[`docs/conteudo/README.md`](docs/conteudo/README.md).

## Documentação

- [`docs/api.md`](docs/api.md): contrato da API
- [`backend/DatabaseDocs/ModelodeDados.md`](backend/DatabaseDocs/ModelodeDados.md): modelo de dados
- [`docs/conteudo/README.md`](docs/conteudo/README.md): como cadastrar conteúdo
- [`CLAUDE.md`](CLAUDE.md): guia técnico do projeto e decisões

## Próximos passos

- [x] Ligar as telas à API de conteúdo
- [ ] Publicar o site num ambiente de demonstração (VM + Caddy ou Render)
- [ ] Revisar e incluir as questões de `docs/conteudo/curadoria-inep.md`
- [ ] Contas de aluno (login) e histórico de progresso
- [ ] Mais áreas do exame (Ciências, História, Geografia)
- [x] Questões com figura e tabela (recortes da prova, guardados no banco)
- [ ] Explicação de palavras ao passar o mouse
