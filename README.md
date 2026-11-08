# Estudaê

Aplicativo web para estudar para o **Encceja** (Exame Nacional para Certificação de
Competências de Jovens e Adultos), pensado principalmente para pessoas idosas: telas simples,
textos grandes, alto contraste, poucos cliques e leitura em voz alta.

Projeto acadêmico desenvolvido para a UPX.

## O que o MVP faz

- **Português e Matemática** do Ensino Médio, com questões de provas anteriores do INEP
  (cada questão mostra a fonte: ano, edição e número na prova).
- **Temas** em cada disciplina, cada um com **vídeo-aulas** (embeds do YouTube) e um **quiz**.
- **Quiz por tema:** alternativas embaralhadas e correção logo após cada resposta, com a
  explicação de como chegar à resposta certa.
- **Acessibilidade:** três tamanhos de fonte, alto contraste, redução de animações e
  leitura em voz alta.
- Uso **sem conta**, como visitante. Nada é gravado: login e histórico de progresso ficam
  para depois do MVP.

> Estado em 08/11/2026: o backend (API, banco, importador, CI) está pronto. As telas ainda
> usam o conteúdo de exemplo de `src/data.js` e estão sendo ligadas à API (contrato em
> [`docs/api.md`](docs/api.md)).

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
  src/Estudae.Api/      endpoints, /health, subcomandos importar e migrar
  tests/Estudae.Tests/  testes de unidade e de integração
  DatabaseDocs/         modelo de dados
conteudo/               questões e vídeos em JSON (um arquivo por disciplina)
docs/api.md             contrato da API para o frontend
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
docker compose down -v            # ATENÇÃO: apaga os dados também
```

Para carregar conteúdo (os JSONs de `conteudo/` vão dentro da imagem):

```bash
docker compose run --rm api importar conteudo/matematica.json --publicar
```

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

## Conteúdo

Questões e vídeos são cadastrados em JSON e entram no banco pelo importador, que confere
tudo antes de gravar. Formato, regras, fluxo de revisão e um prompt para extrair questões
com IA: [`conteudo/README.md`](conteudo/README.md).

## Documentação

- [`docs/api.md`](docs/api.md): contrato da API
- [`backend/DatabaseDocs/ModelodeDados.md`](backend/DatabaseDocs/ModelodeDados.md): modelo de dados
- [`conteudo/README.md`](conteudo/README.md): como cadastrar conteúdo
- [`CLAUDE.md`](CLAUDE.md): guia técnico do projeto e decisões

## Próximos passos

- [ ] Ligar as telas à API e publicar o site
- [ ] Contas de aluno (login) e histórico de progresso
- [ ] Mais áreas do exame (Ciências, História, Geografia)
- [ ] Questões com figura e tabela
- [ ] Explicação de palavras ao passar o mouse
