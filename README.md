# Estudaê

Aplicativo web de estudos para o **Encceja** (Exame Nacional para Certificação
de Competências de Jovens e Adultos). Questões no estilo da prova, quizzes com
ordem aleatória e vídeo-aulas organizadas por tema — com telas simples, textos
grandes e foco em acessibilidade.

Projeto acadêmico desenvolvido para a UPX.

## Funcionalidades

- **Landing page** — criar conta, login facilitado ou entrar sem conta
  (visitante). Cadastro por telefone ou e-mail com código de verificação e
  opção de vincular uma pessoa responsável.
- **Home** — seleção das áreas Português e Matemática; cada uma leva a uma
  tela com opções de questões e vídeo-aulas.
- **Quiz** — questões embaralhadas a cada tentativa, navegação por teclado e
  leitura em voz alta do enunciado. Ao final, o resultado mostra acertos,
  correção comentada e um link para a vídeo-aula do tema com mais erros.
- **Vídeo-aulas** — conteúdos por tema com progresso de aulas concluídas e
  link externo para a plataforma de vídeos de cada conteúdo.
- **Progresso e perfil** — histórico de quizzes, aproveitamento por área,
  ofensiva (dias seguidos) e nível.
- **Acessibilidade** — três tamanhos de fonte, alto contraste, redução de
  animações, legendas grandes, velocidade calma do player e leitura de
  questões em voz alta.

## Tecnologias

- HTML + CSS + JavaScript puro (ES Modules) — sem build e sem dependências
- `localStorage` para persistência (usuário, preferências, progresso)
- Web Speech API para leitura em voz alta

## Estrutura

```
index.html            — shell da SPA (#app, #sheet-root, #toast)
src/
  main.js             — ponto de entrada
  router.js           — roteador por hash (#/rota) + proteção de rotas
  data.js             — áreas, temas, aulas e questões do Encceja
  icons.js            — ícones SVG inline
  core/               — dom, store (localStorage), state, utils,
                        toast, speech, stats
  components/         — nav (bottom-nav + voltar), sheet (bottom-sheet),
                        progress (barras + histórico)
  screens/            — um arquivo por tela + index.js (registro de rotas)
  styles/             — base, layout, components, screens, navigation,
                        responsive
```

## Pré-requisitos

| Para quê | O que instalar |
|---|---|
| Rodar o frontend | Python 3 **ou** Node — qualquer servidor HTTP estático |
| Rodar o banco de dados | Docker + Docker Compose v2 |
| Backend | .NET 8 SDK — **ainda não necessário** (entra na fase 3) |

Não é preciso instalar o PostgreSQL nem o `psql` na máquina: o banco roda em
container e o cliente usado é o de dentro dele
(`docker compose exec db psql`).

No Windows, o caminho mais simples é o **Docker Desktop** com a integração do
WSL habilitada (Settings → Resources → WSL integration). No Linux, basta o
`docker-ce` com o plugin `docker-compose-v2`. Para conferir:

```bash
docker --version
docker compose version   # precisa ser v2 — comando com espaço, não docker-compose
```

## Como executar

O app usa módulos ES, então precisa ser servido por HTTP (abrir o
`index.html` direto pelo `file://` não funciona).

```bash
# Python
python -m http.server 8000

# ou Node
npx serve .
```

Depois acesse `http://localhost:8000`. Também funciona com a extensão
**Live Server** do VS Code.

## Banco de dados (desenvolvimento)

O backend ainda não existe, mas o Postgres de desenvolvimento já está
definido no `docker-compose.yml` da raiz. Precisa de Docker instalado.

```bash
docker compose up -d --wait   # sobe e espera ficar healthy
docker compose ps             # STATUS deve mostrar (healthy)
docker compose down           # para e remove o container (mantém os dados)
docker compose down -v        # ATENÇÃO: apaga os dados também
```

Para abrir um `psql` dentro do container:

```bash
docker compose exec db psql -U estudae -d estudae
```

Dados de conexão (só desenvolvimento local):

| | |
|---|---|
| Host / porta | `localhost:5432` (padrão — veja abaixo) |
| Banco / usuário | `estudae` |
| Senha | `estudae_dev` |

**Se a porta 5432 já estiver ocupada** na sua máquina (é o caso de quem tem o
PostgreSQL instalado nativamente), copie o `.env.example` e escolha outra:

```bash
cp .env.example .env
# edite DB_PORT=5433
```

O `.env` não é comitado, então cada pessoa usa a porta que quiser sem mexer
em arquivo versionado. Dentro do container o Postgres está sempre na 5432 —
o que muda é só a porta publicada no host.

## Roadmap

Planejado para próximas versões:

- [ ] Banco de dados (contas reais e progresso sincronizado entre dispositivos)
- [ ] Acessibilidade ao passar o mouse sobre palavras (leitura/explicação)
- [ ] Vincular conteúdo oficial do Encceja/gov à aplicação
- [ ] Mais áreas do exame (Ciências, História, Geografia)
- [ ] Envio real de código de verificação (SMS/e-mail)
