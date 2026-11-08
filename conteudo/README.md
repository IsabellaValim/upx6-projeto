# Conteúdo do Estudaê

Aqui ficam as questões e os vídeos do site, **um arquivo JSON por disciplina**
(`portugues.json`, `matematica.json`). O importador lê esses arquivos, confere tudo e
grava no banco. Os exemplos em `exemplos/` mostram o formato e os erros que ele pega.

O modelo de dados por trás disso está em `backend/DatabaseDocs/ModelodeDados.md`.

## Escopo do MVP

- Ensino Médio, provas do INEP, só **Português** e **Matemática**.
- **Sem questões com figura, tabela ou gráfico.**
- Quatro temas por disciplina (para mudar, basta editar o JSON):

  | Disciplina (`slug`) | Temas (`slug`) |
  |---|---|
  | `portugues` | `interpretacao-de-texto`, `generos-textuais`, `variacao-linguistica`, `gramatica` |
  | `matematica` | `porcentagem-e-proporcao`, `equacoes`, `geometria-plana`, `estatistica-basica` |

## Formato

```jsonc
{
  "disciplina": { "slug": "matematica", "nome": "Matemática", "icone": "percent" },
  "temas": [
    {
      "slug": "porcentagem-e-proporcao",
      "titulo": "Porcentagem e proporção",
      "sobre": "Texto curto de apresentação do tema.",
      "videos": [
        { "youtube": "https://www.youtube.com/watch?v=XXXXXXXXXXX", "titulo": "...", "duracao_segundos": 480 }
      ],
      "questoes": [
        {
          "codigo": "mat-porcentagem-001",
          "texto_base": "Texto de apoio (opcional).",
          "enunciado": "A pergunta.",
          "alternativas": ["texto 1", "texto 2", "texto 3", "texto 4"],
          "resposta_correta": "texto 2",
          "resolucao": "Explicação passo a passo.",
          "prova_ano": 2019,
          "prova_edicao": "Nacional",
          "prova_nivel": "Ensino Médio",
          "prova_numero": 12
        }
      ]
    }
  ]
}
```

| Campo | Obrigatório | Regra |
|---|---|---|
| `disciplina.slug` | sim | minúsculas sem acento, números e hífen (`matematica`) |
| `disciplina.nome` | sim | até 100 caracteres |
| `disciplina.icone` | não | nome do ícone usado no front (`pen`, `percent`) |
| `tema.slug` | sim | como o da disciplina; único no arquivo |
| `tema.titulo`, `tema.sobre` | sim | título até 150 caracteres |
| `videos[].youtube` | sim | **link completo do YouTube ou só o ID** (11 caracteres); o importador extrai o ID |
| `videos[].titulo` | sim | até 200 caracteres |
| `videos[].duracao_segundos` | não | maior que zero |
| `questoes[].codigo` | sim | único no arquivo **e no banco**; formato `mat-porcentagem-001` |
| `texto_base` | não | |
| `enunciado`, `resolucao` | sim | |
| `alternativas` | sim | de 2 a 5, sem repetição (maiúscula/minúscula não conta como diferença) |
| `resposta_correta` | sim | **exatamente igual** ao texto de uma das alternativas |
| `prova_ano` | sim | de 2002 até o ano atual |
| `prova_edicao`, `prova_nivel` | sim | texto, até 40 caracteres |
| `prova_numero` | sim | número da questão na prova original, maior que zero |

Detalhes importantes:

- **A ordem** dos temas e dos vídeos é a ordem em que aparecem no arquivo.
- **As alternativas são guardadas como texto** e o site embaralha a ordem. Por isso uma
  alternativa **não pode citar outra pela posição** ("A e B estão corretas", "Todas as
  anteriores"). O importador recusa esses casos.
- **Campo com nome errado é erro.** `resposta_corecta` não é ignorado: o arquivo inteiro é recusado.
- **Matemática:** usar o mínimo de LaTeX. `5²`, `×`, `÷` e `R$ 10,00` em texto puro bastam na
  maioria das questões (e a leitura em voz alta lê texto puro direito). Quando precisar de
  fórmula, use `\( ... \)` na linha ou `\[ ... \]` em bloco. **Nunca `$`** como delimitador
  (`R$` e `US$` são permitidos). No JSON, a barra invertida é escrita dobrada: `"\\( x^2 \\)"`.
- Espaços nas pontas e quebras de linha do Windows são limpos automaticamente.

## Como importar

Dentro de `backend/`, com o Postgres do compose de pé:

```bash
# Só confere o arquivo (não precisa de banco). Use antes de abrir o PR.
dotnet run --project src/Estudae.Api -- importar "$PWD/../conteudo/matematica.json" --validar

# Grava como RASCUNHO (não aparece no site).
dotnet run --project src/Estudae.Api -- importar "$PWD/../conteudo/matematica.json"

# Grava como PUBLICADA (aparece no site). Só depois da revisão no PR.
dotnet run --project src/Estudae.Api -- importar "$PWD/../conteudo/matematica.json" --publicar
```

> O caminho precisa ser **absoluto** (`"$PWD/..."`): o `dotnet run` executa a partir da pasta
> do projeto, então `../conteudo` não funcionaria.

- **Se houver qualquer erro, nada é gravado.** A saída lista todos os erros, com a questão e o
  campo de cada um.
- **Reimportar é seguro:** questão com o mesmo `codigo` é **atualizada**, não duplicada (o
  mesmo vale para tema por `slug` e vídeo por ID).
- **Nada é apagado.** Tema ou vídeo que está no banco mas saiu do arquivo continua lá, e o
  importador avisa no resumo.
- **Cuidado:** importar **sem** `--publicar` volta para rascunho até as questões que já estavam
  publicadas, e elas somem do site. O resumo avisa quando isso acontece.

## Fluxo de trabalho

1. Pegar a questão no PDF da prova (ver "Extrair com IA" abaixo).
2. Colocar no JSON da disciplina, no tema certo, e rodar com `--validar`.
3. Abrir um PR. **Outra pessoa revisa** (checklist abaixo).
4. Depois do merge, importar com `--publicar`.

### Checklist de revisão

- [ ] O texto confere com o PDF original, palavra por palavra (inclusive o texto-base).
- [ ] A resposta correta confere com o **gabarito oficial** do INEP.
- [ ] **Matemática: resolvi a questão de novo.** A IA erra conta.
- [ ] A resolução explica o raciocínio, não só a resposta.
- [ ] `prova_ano`, `prova_edicao`, `prova_nivel` e `prova_numero` conferem com o PDF.
- [ ] A questão não depende de figura, tabela ou gráfico.
- [ ] O vídeo (se houver) permite incorporação: abrir
      `https://www.youtube.com/oembed?url=<link do vídeo>` deve mostrar dados do vídeo, não um erro.
      Tem legenda em português, menos de 15 minutos e ritmo calmo.

### Extrair com IA (no chat)

Colar o texto da questão copiado do PDF depois deste prompt:

```text
Converta a questão abaixo para JSON, exatamente neste formato, sem nenhum outro texto:
{"codigo": "", "texto_base": "", "enunciado": "", "alternativas": [], "resposta_correta": "",
 "resolucao": "", "prova_ano": 0, "prova_edicao": "", "prova_nivel": "Ensino Médio", "prova_numero": 0}
Regras:
- Copie o texto-base, o enunciado e as alternativas sem mudar nenhuma palavra.
- Não coloque a letra (A, B, C, D) no texto das alternativas.
- "resposta_correta" é o texto completo da alternativa correta, igual ao da lista.
- "resolucao": explique passo a passo, em linguagem simples, para uma pessoa idosa.
- Matemática em texto puro sempre que possível (5², ×, ÷, R$ 10,00). Se precisar de
  fórmula, use \( ... \), nunca $.
- Deixe "codigo" vazio; eu preencho.
Gabarito oficial: <letra>. Prova: Encceja <ano>, <edição>, questão <número>.
```

## Exemplos

| Arquivo | O que mostra |
|---|---|
| `exemplos/exemplo-valido.json` | 2 questões válidas (uma com o link completo do vídeo, outra só com o ID) |
| `exemplos/exemplo-invalido.json` | 13 erros de validação de uma vez, um tipo por questão |
| `exemplos/exemplo-campo-desconhecido.json` | campo escrito errado (`resposta_corecta`), recusado na leitura |

As questões de exemplo são **inventadas** (não são do INEP) e os IDs de vídeo são falsos. Os
testes automáticos (`backend/tests/`) usam esses arquivos: se mudar um exemplo, rode `dotnet test`.
