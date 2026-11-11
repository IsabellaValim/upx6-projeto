# Estudaê

![CI](https://github.com/IsabellaValim/upx6-projeto/actions/workflows/ci.yml/badge.svg)

**Estude para o Encceja no seu ritmo, pelo celular.**

O **Estudaê** é uma plataforma web de preparação para o Exame Nacional para Certificação de Competências de Jovens e Adultos (Encceja), desenvolvida como projeto acadêmico de UPX. Seu foco é tornar o estudo acessível, especialmente para pessoas idosas e estudantes que retomam a escolarização: navegação simples, textos legíveis, alto contraste, atividades curtas e apoio de leitura em voz alta.

A experiência foi pensada primeiro para **celulares**. Em telas de computador, a interface é apresentada em uma moldura central com proporções de celular.

> **Estado do projeto:** MVP funcional em desenvolvimento. O conteúdo atual abrange Matemática e Linguagens nos ensinos Fundamental e Médio. Conta de usuário e progresso persistido em servidor ainda não fazem parte desta versão.

## O que já existe

### Estudar

1. Na primeira visita, o estudante escolhe **Ensino Fundamental** ou **Ensino Médio**. A seleção pode ser alterada no Perfil.
2. Na tela inicial, acessa uma matéria e escolhe um tema.
3. Em cada tema, pode **ver uma videoaula** incorporada do YouTube ou **praticar** em uma lição curta de até cinco questões, com correção imediata.
4. O atalho **Continuar estudando** retoma a próxima atividade pendente.

As videoaulas dependem da disponibilidade dos vídeos no YouTube. Legendas e velocidades alternativas dependem dos recursos oferecidos por cada vídeo/player.

### Fazer simulados

O simulado seleciona questões de diferentes temas da mesma matéria. Há cronômetro; as respostas são corrigidas **após a entrega**, diferentemente das lições de prática.

### Acompanhar o progresso

A seção **Progresso** apresenta atividades concluídas, dias de sequência de estudos e histórico de acertos. Nesta versão, a escolha de prova, as preferências e o progresso são guardados **localmente no navegador** (`localStorage`). Isso significa que os dados podem desaparecer se o armazenamento for apagado e **não são sincronizados entre aparelhos**.

### Orientação adaptativa — motor local com superfície simples

A classificação pedagógica é separada do conteúdo oficial. O novo histórico usa
IndexedDB transacional (`estudae-aprendizagem`), sem substituir o legado em
`localStorage`. A captura está ativa para as quatro disciplinas
(`CONFIG_APRENDIZAGEM`); as evidências só contam onde a curadoria pedagógica
aprovada da matriz (`/disciplinas/{d}/pedagogia`) confirma a questão — o resto
continua no fluxo tradicional. O código não aprova conteúdo.

O motor é puro e seus parâmetros experimentais ficam em `PARAMETROS_DOMINIO`,
`PARAMETROS_RECOMENDACAO` e `PARAMETROS_PREPARACAO`. Repetições, soluções já
vistas e registros incertos não criam evidências independentes. Omissões de
simulado não são tentativas fictícias. O Perfil oferece exclusão confirmada do
progresso de ambos os níveis, preservando identidade, prova escolhida e
acessibilidade. Falha parcial não é anunciada como sucesso.

Na interface, o adaptativo aparece só onde a curadoria validou a matriz: o
Início mostra **"Sugestão de hoje"** e a Área mostra **sugestão do tema**,
**estágio por tema** (Para começar → Em progresso, com a contagem de boas
práticas → Indo bem → Consolidado) e a frase de preparo. A evolução é visível
desde a primeira lição; só "Consolidado" exige a confirmação temporal
(uma segunda sessão boa em outro dia). Nada de pontos, rankings ou
probabilidades: o motor decide nos bastidores (dificuldade recorrente,
revisão vencida, habilidade essencial nova, continuar) e a indicação de
preparo (`sem-dados`, `em-progresso`, `boa-preparacao`) nunca promete
aprovação.

Para demonstrar a avaliação por **iterações, sem esperar horas**, execute em `frontend/`:

```sh
npx vitest run src/core/aprendizagem/dominio.test.ts --testNamePattern="demonstração por iterações"
```

Essa demonstração isolada exercita três iterações de exemplo; não altera o histórico,
não concede domínio nem comprova retenção. Os testes de IndexedDB usam
`fake-indexeddb` apenas em desenvolvimento; quotas, ciclo de vida e múltiplas
abas em celulares reais ainda precisam de verificação. Dados locais não são
certificados, não têm backup garantido e podem ser perdidos ao limpar o
navegador. O backend não recebe progresso anônimo.

### Ajustar a acessibilidade

- Três tamanhos de fonte, com **Grande** como padrão.
- Modo de alto contraste.
- Opção para reduzir animações.
- Leitura em voz alta dos conteúdos compatíveis.
- Recortes visuais das questões que contêm figuras, acompanhados de descrições para tecnologias assistivas.

Essas funcionalidades fazem parte do projeto, mas ainda precisam de validação prática com usuários e testes de acessibilidade antes de serem anunciadas como conformidade com um padrão.

## Conteúdo disponível

| Nível              | Matéria                            |  Temas | Videoaulas no banco de referência |                               Questões |
| ------------------ | ---------------------------------- | -----: | --------------------------------: | -------------------------------------: |
| Ensino Médio       | Linguagens                         |     10 |                                 4 | 72 (60 oficiais de 2022 + 12 autorais) |
| Ensino Médio       | Matemática                         |      9 |                                 4 | 72 (60 oficiais de 2022 + 12 autorais) |
| Ensino Fundamental | Linguagens                         |     10 |                                 0 |                    60 oficiais de 2022 |
| Ensino Fundamental | Matemática                         |      8 |                                 0 |                    60 oficiais de 2022 |
| **Total**          | **4 combinações de nível/matéria** | **37** |                             **8** |                                **264** |

**Importante:** os números acima descrevem a base informada no levantamento do projeto, **antes da importação dos novos arquivos de videoaulas**. Os quatro arquivos JSON de curadoria entregues separadamente propõem **duas videoaulas por tema (74 vínculos no total)**; isso só será refletido no aplicativo **depois da validação e importação**.

As questões oficiais identificam a prova e o ano de origem. As criadas pela equipe exibem **Questão autoral Estudaê**. As questões com imagens utilizam recortes das provas armazenados no banco de dados.

O Encceja oficial abrange mais áreas do que a versão atual do Estudaê. **Ciências da Natureza/Ciências Naturais** e **Ciências Humanas/História e Geografia**, além de uma jornada completa de redação, permanecem como trabalho futuro.

## Tecnologias

| Camada         | Tecnologia                                                      |
| -------------- | --------------------------------------------------------------- |
| Frontend       | React 19 + TypeScript + Vite (SPA, URLs limpas), Zustand, KaTeX |
| Backend        | ASP.NET Core / .NET 10                                          |
| Persistência   | Entity Framework Core 10 + Npgsql                               |
| Banco de dados | PostgreSQL 16                                                   |
| Execução local | Docker e Docker Compose                                         |
| Automação      | GitHub Actions (build, testes e smoke test)                     |

A própria API entrega os arquivos do frontend pela pasta `wwwroot` (o `dist` do build do Vite, gerado num estágio Node do Dockerfile). Em uma instalação integrada, frontend e API usam **a mesma origem**, dispensando CORS em produção. Como o React Router usa URLs limpas (`/home`, `/area/matematica`...), a API devolve o `index.html` para qualquer caminho que não seja arquivo nem `/api` — e `/api` desconhecida responde 404 de verdade.

## Executar localmente com Docker

**Pré-requisito:** Docker Desktop ou Docker Engine com Compose v2. No Windows, recomenda-se Docker Desktop com integração WSL habilitada.

```bash
# Na raiz do repositório
cp .env.example .env
# Abra o .env e defina uma senha segura em POSTGRES_PASSWORD

docker compose up -d --build --wait
```

Acesse **http://localhost:8080** (ou a porta definida em `API_PORT`). O Compose inicia o banco, executa o serviço de migrações e depois sobe a API.

Comandos úteis:

```bash
docker compose ps
docker compose logs -f api
docker compose down             # Encerra os serviços; preserva o volume
docker compose down -v          # ATENÇÃO: remove o volume e seus dados
```

Se as portas `5432` ou `8080` estiverem ocupadas, ajuste `DB_PORT` ou `API_PORT` no `.env`. As portas da configuração local são publicadas somente em `127.0.0.1`.

> **Banco vazio:** o projeto não inclui um banco populado no repositório. Se as matérias não aparecerem, restaure um backup `.dump` ou importe conteúdo pelo processo descrito abaixo.

## Desenvolver o backend sem iniciar a API no Compose

**Pré-requisito:** .NET 10 SDK, observando `backend/global.json`.

```bash
docker compose up -d --wait db
cd backend
dotnet tool restore

dotnet user-secrets set ConnectionStrings:Estudae \
  "Host=localhost;Port=<DB_PORT>;Database=estudae;Username=estudae;Password=<POSTGRES_PASSWORD>" \
  --project src/Estudae.Api

dotnet ef database update \
  --project src/Estudae.Infra \
  --startup-project src/Estudae.Api

dotnet run --project src/Estudae.Api
```

A API de desenvolvimento fica disponível em **http://localhost:5151**, conforme a configuração atual. Para rodar os testes:

```bash
dotnet test
```

Os testes de integração podem depender de uma instância de banco ativa.

## Trabalhar apenas no frontend

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

Progresso, preferências e escolha de prova continuam no `localStorage` do
navegador (chaves `estudae:*`), sem conta real por trás.

## Conteúdo e importação

**O PostgreSQL é a fonte de verdade do conteúdo**: disciplinas, temas, videoaulas, questões e imagens. Dados de conteúdo não são versionados diretamente no repositório.

Documentação: [`docs/conteudo/README.md`](docs/conteudo/README.md). Antes de importar um novo catálogo, preserve os `slug`, `nome`, `icone`, `nivel`, `titulo`, `sobre` e a ordem dos temas existentes, conforme as regras do importador.

### Adicionar videoaulas

Os quatro arquivos de videoaulas são separados por nível e matéria:

```text
novo/
  linguagens.json
  linguagens-fundamental.json
  matematica.json
  matematica-fundamental.json
```

A pasta `novo/` está no `.gitignore`, segundo o fluxo de trabalho atual. Copie os JSONs de curadoria para essa pasta e faça **primeiro a validação sem gravar**:

```bash
docker compose run --rm -v "$PWD/novo:/novo:ro" api \
  importar /novo/linguagens-fundamental.json --validar
```

Após revisar os resultados:

```bash
docker compose run --rm -v "$PWD/novo:/novo:ro" api \
  importar /novo/linguagens-fundamental.json --publicar
```

Repita para os demais arquivos. O importador descrito pela equipe é transacional e associa vídeos por `(tema, youtube_id)`, evitando duplicação ao reimportar. **A importação pode atualizar metadados dos temas**: por isso os arquivos de curadoria preservam títulos, descrições e a ordem dos temas originais.

> Os links de vídeo foram selecionados em fontes públicas. Antes da publicação para alunos, reproduza cada aula no aplicativo, confirme disponibilidade para incorporação, clareza do áudio e legendas. Não presuma que todos os vídeos permitem incorporação ou oferecem legendas.

## Banco de dados: backup e restauração

O banco local é armazenado no volume Docker `upx6-projeto_pgdata`. Reiniciar ou recriar os containers normalmente preserva esse volume; `docker compose down -v` **remove os dados**.

Conexão a partir de DBeaver, pgAdmin ou outro cliente:

```text
Host: localhost
Porta: DB_PORT (.env)
Banco: estudae
Usuário: estudae
Senha: POSTGRES_PASSWORD (.env)
```

Para acessar o `psql` sem instalar PostgreSQL no computador:

```bash
docker compose exec db psql -U estudae -d estudae
```

### Exportar

```powershell
# Windows (PowerShell)
powershell -ExecutionPolicy Bypass -File scripts/banco/exportar.ps1
```

```bash
# Linux, macOS ou Git Bash
sh scripts/banco/exportar.sh
```

O backup é salvo em `backups/estudae-<data>.dump`. Como o arquivo também contém imagens, seu tamanho pode ser considerável. **A pasta `backups/` não é versionada**: mantenha uma cópia externa e protegida, com teste periódico de restauração.

### Restaurar

```powershell
powershell -ExecutionPolicy Bypass -File scripts/banco/restaurar.ps1 -Arquivo backups/estudae-<data>.dump
```

```bash
sh scripts/banco/restaurar.sh backups/estudae-<data>.dump
```

Segundo o fluxo documentado do projeto, a restauração faz uma cópia preventiva da base atual, substitui o conteúdo e aplica as migrações pendentes. Teste esse procedimento em uma base descartável antes de usá-lo no ambiente de demonstração.

### Restaurar em PostgreSQL hospedado

Um `.dump` pode ser restaurado em uma instância compatível de PostgreSQL. Exemplo, ajustando o nome do arquivo, as credenciais e as exigências de TLS do provedor:

```bash
docker run --rm -v "$PWD/backups:/b" postgres:16 \
  pg_restore --no-owner --no-privileges --clean --if-exists \
  -d "postgresql://USUARIO:SENHA@HOST:5432/BANCO" /b/estudae-<data>.dump
```

Configure a aplicação com `ConnectionStrings__Estudae` via variável de ambiente ou gerenciador de segredos. **Não versione senhas nem exponha o banco publicamente sem controles de acesso.**

## Estrutura do projeto

```text
frontend/                   app React + TS + Vite (src/, testes; ver CLAUDE.md)
backend/
  src/Estudae.Domain/       Entidades e regras de domínio
  src/Estudae.Infra/        EF Core, migrations e importador
  src/Estudae.Api/          API, arquivos estáticos, saúde e comandos
  tests/Estudae.Tests/      Testes unitários e de integração
  DatabaseDocs/             Modelo de dados
scripts/banco/              Backup e restauração
docs/api.md                 Contrato dos endpoints
docs/conteudo/              Importação e revisão pedagógica
.github/workflows/          Integração contínua
docker-compose.yml          Banco, migrações e API
CLAUDE.md                   Contexto técnico e decisões do projeto
```

## Documentação complementar

- [`docs/api.md`](docs/api.md): contrato da API.
- [`backend/DatabaseDocs/ModelodeDados.md`](backend/DatabaseDocs/ModelodeDados.md): modelo do banco.
- [`docs/conteudo/README.md`](docs/conteudo/README.md): formato e regras do importador.
- [`docs/conteudo/ENTREGA-QUESTOES-2022.md`](docs/conteudo/ENTREGA-QUESTOES-2022.md): questões de 2022.
- `docs/conteudo/curadoria-inep.md`: pendências de revisão do conteúdo.
- [`CLAUDE.md`](CLAUDE.md): convenções técnicas e decisões de arquitetura.

## O que falta para concluir

O próximo trabalho está dividido em duas metas: **entrega acadêmica demonstrável** e **produto completo cobrindo o exame**. A ordem, os critérios de aceite e as verificações estão detalhados em **`PLANO_FINALIZACAO.md`**, entregue junto com esta revisão.

Entre as prioridades estão: validar a importação das videoaulas, revisar questões e acessibilidade, testar o fluxo inteiro em celulares reais, publicar uma demonstração estável, testar backups e documentar o trabalho para a apresentação da UPX. Contas reais, sincronização de progresso e ampliação para todas as áreas do Encceja entram na etapa de evolução do produto.

## Contexto acadêmico

Projeto de UPX, com foco em estudantes que desejam se preparar para o Encceja pelo próprio celular. O Estudaê **não é um sistema oficial do Inep**; provas e gabaritos oficiais devem ter origem identificada, e os conteúdos criados pela equipe devem ser claramente diferenciados.

Fontes oficiais: [Sobre o Encceja (Inep)](https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/encceja) · [Provas e gabaritos](https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/encceja/provas-e-gabaritos) · [Matrizes de referência e documentos](https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/encceja/outros-documentos).

### Aba Preparo: evolução imediata, sem simulação

A aba **Preparo** usa atividades realmente concluídas no navegador. Após uma
lição curta, mostra resultados recentes por matéria e mensagens como **Indo
bem nas atividades**. Esse indicador imediato não equivale a domínio confirmado.
A confirmação pedagógica exige questões classificadas e revisões posteriores.

Por enquanto a mensagem **Estou pronto(a) para o Encceja?** responde
**Ainda não dá para saber**: o projeto cobre somente Matemática e
Linguagens, sem avaliar todas as áreas nem a redação. O critério antigo de
"boa preparação" baseado apenas em três temas foi desativado. Não existe
modo de demonstração ou nota simulada para a apresentação acadêmica.
