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

## Roadmap

Planejado para próximas versões:

- [ ] Banco de dados (contas reais e progresso sincronizado entre dispositivos)
- [ ] Acessibilidade ao passar o mouse sobre palavras (leitura/explicação)
- [ ] Vincular conteúdo oficial do Encceja/gov à aplicação
- [ ] Mais áreas do exame (Ciências, História, Geografia)
- [ ] Envio real de código de verificação (SMS/e-mail)
