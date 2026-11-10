# Entrega: questões do Encceja 2022 prontas para o banco oficial

Este guia é para quem vai carregar as questões no banco do ambiente oficial (demonstração ou
produção).

**O conteúdo não está mais no repositório** (10/11/2026): questões, vídeos e imagens moram no
banco, e chegam ao banco oficial por um **dump** (`.dump`, gerado pelo `exportar`). Peça o
arquivo mais recente a quem mantém o banco de conteúdo; ele não vai no git (`backups/` está no `.gitignore`).

## O que está no dump

| Disciplina (`slug`) | Prova | Temas | Questões | Com imagem |
|---|---|---|---|---|
| `matematica` | Ensino Médio | 9 | 72 (60 oficiais + 12 autorais) | 30 |
| `linguagens` | Ensino Médio | 10 | 72 (60 oficiais + 12 autorais) | 18 |
| `matematica-fundamental` | Ensino Fundamental | 8 | 60 oficiais | 21 |
| `linguagens-fundamental` | Ensino Fundamental | 10 | 60 oficiais | 20 |
| tabela `imagem` | recortes das provas (WebP, ~14 MB) | | 240 imagens (89 usadas) | |

- **240 questões oficiais de 2022**: os 8 cadernos (Ensino Fundamental e Médio, Matemática e
  Linguagens, aplicação Nacional e Reaplicação/PPL), 30 questões cada.
- Cada questão foi **transcrita a partir da imagem da prova** (não da extração automática),
  com texto de apoio separado do enunciado, as 4 alternativas na ordem da prova, a resposta
  correta igual ao **gabarito oficial** do INEP, uma **resolução** em linguagem simples e o
  **tema**. As contas de Matemática foram refeitas: todas batem com o gabarito.
- Questões que dependem de figura, tabela, gráfico, tirinha ou foto têm imagem (o recorte
  da prova) com uma **descrição** para leitor de tela e leitura em voz alta.
- `Português` passou a se chamar **`Linguagens`** (slug `linguagens`), como no Encceja.

## Estrutura que o código precisa ter

- **Migration `NivelEImagem`**: `disciplina.nivel` e `questao.imagem_descricao`.
- **Migration `ImagensNoBanco`**: tabela `imagem` (`caminho` único, `tipo_mime`, `dados`
  bytea, `sha256`, `atualizada_em`). A API serve `/conteudo/imagens/{caminho}` dela, com ETag.
- As duas rodam sozinhas pelo serviço `migrate` do Compose (ou pelo `migrar` no Render). O
  `restaurar` também roda o `migrate` no fim.

## Antes de publicar no ambiente oficial

1. **Revisão humana.** Combinado do projeto: outra pessoa confere antes de publicar fora do
   ambiente local. Use [`revisao-2022.csv`](revisao-2022.csv) (uma linha por questão, com
   colunas `revisado_por` e `ok`). Prioridade:
   - as **pendências** abaixo;
   - uma **amostra** de cada caderno: compare texto, alternativas e gabarito com o PDF oficial
     (`2022/provas_originais/` e `2022/gabaritos_originais/` do pacote
     `Estudae_Questoes_Consolidadas_2017_2026_com_2022.zip`);
   - as **descrições de imagem** (não podem entregar a resposta).
2. **Termos de uso do INEP.** Ainda é decisão em aberto no `CLAUDE.md`. Cada questão leva a
   fonte completa (ano, aplicação, nível e número), mas a equipe precisa confirmar que o uso é
   permitido antes de publicar fora do ambiente local.

### Pendências registradas na revisão

<!-- geradas a partir dos relatórios de cada caderno -->
- [ ] `encceja-em-nacional-2022-mat-042` (`matematica`, `geometria-plana`): localização em quadriculado com pontos cardeais; não há tema de localização, ficou em geometria plana.
- [ ] `encceja-em-nacional-2022-mat-048` (`matematica`, `geometria-plana`): trigonometria no triângulo retângulo (seno de 30º), sem tema próprio.
- [ ] `encceja-em-nacional-2022-mat-056` (`matematica`, `funcoes`): as alternativas da prova são gráficos; viraram descrições em texto de cada reta, com a imagem dos quatro gráficos mantida.
- [ ] `encceja-em-ppl-2022-ling-014` (`linguagens`, `variacao-linguistica`): na prova a letra do samba traz “vortermo”, a alternativa correta cita “Nós vortemo” e o enunciado grafa “Adoniram”; transcrito como está na prova.
- [ ] `encceja-em-ppl-2022-ling-001` (`linguagens`, `comunicacao-e-midias`): o texto é o próprio cartaz; transcritos título e legenda, imagem mantida.
- [ ] `encceja-em-nacional-2022-ling-015` (`linguagens`, `lingua-inglesa`): no cartaz aparece “$60,000”; ficou “US$ 60,000” porque o validador recusa “$” isolado (regra contra LaTeX). Decidir se mantém.
- [ ] `encceja-em-ppl-2022-ling-027` (`linguagens`, `lingua-inglesa`): palavras em negrito na prova; indicadas numa linha entre parênteses no fim do texto de apoio.
- [ ] `encceja-em-ppl-2022-ling-003` (`linguagens`, `arte`): as alternativas da prova são quatro fotografias; viraram descrições em texto. Conferir se a redação não facilita a resposta.
- [ ] `encceja-ef-nacional-2022-mat-037` (`matematica-fundamental`, `fracoes-e-decimais`): número misto “um inteiro e um meio” escrito como “1½”.
- [ ] `encceja-ef-nacional-2022-mat-036` (`matematica-fundamental`, `geometria`): localização em quadriculado; ficou em geometria.
- [ ] `encceja-ef-nacional-2022-ling-012` (`linguagens-fundamental`, `interpretacao-de-texto`): o Texto I é só uma fotografia; marcador “[Fotografia]” no texto de apoio e os cartazes na descrição da imagem.
- [ ] `encceja-ef-ppl-2022-ling-028` (`linguagens-fundamental`, `comunicacao-e-midias`): a prova grafa o autor “WALTTERSON” (correto: Watterson); mantido como na prova.
- [ ] `encceja-ef-ppl-2022-ling-020` (`linguagens-fundamental`, `lingua-espanhola`): o trecho não diz explicitamente que Irene e o narrador são irmãos; a resolução infere.
- [ ] `encceja-ef-nacional-2022-ling-007` (`linguagens-fundamental`, `arte`): o gabarito oficial (“estimula a imaginação do público”) não está explícito no texto; resolução faz a inferência. **Revisar.**
- [ ] `encceja-ef-nacional-2022-ling-027` (`linguagens-fundamental`, `arte`): a resposta mais evidente pelo texto seria outra; o gabarito oficial foi mantido. **Revisar.**

Já resolvidas: `encceja-ef-nacional-2022-mat-059` e `encceja-ef-ppl-2022-mat-045` ganharam o
tema `probabilidade-e-contagem` no Fundamental; `encceja-ef-ppl-2022-ling-016` ganhou a imagem
do anúncio (as faixas pretas são da própria prova).

Para corrigir uma questão no banco: pegue o JSON dela (com quem mantém o conteúdo, ou o
`.zip` de backup da pasta antiga), corrija, rode `--validar` e reimporte (ver
[`README.md`](README.md)). O `codigo` é a chave: reimportar **atualiza**, não duplica.

## Como carregar no banco oficial

> **Atenção:** o `restaurar` **substitui o banco inteiro** pelo do dump (faz um backup do atual
> antes). Hoje o banco oficial só teria conteúdo (não há login nem tentativas no MVP), então
> isso é o que se quer. Quando houver contas de alunos, passa a ser preciso outro caminho
> (importar só o conteúdo).

### VM com Docker Compose (plano A)

```bash
git pull                                    # código com as migrations
docker compose up -d --build --wait         # sobe; o migrate cria as tabelas
# copie o .dump para backups/ na VM (scp, por exemplo) e:
sh scripts/banco/restaurar.sh backups/estudae-AAAAMMDD-HHMM.dump
curl https://<endereço>/api/disciplinas     # 4 disciplinas: 72, 72, 60 e 60 questões
```

### Render (plano B)

O banco gerenciado aceita `pg_restore` direto de uma máquina com o Postgres client, usando a
"External Database URL" do painel:

```bash
pg_restore --clean --if-exists --no-owner --single-transaction -d "<External Database URL>" estudae-AAAAMMDD-HHMM.dump
```

Depois, reinicie o serviço (o `migrar` roda antes do start e completa o que faltar).

### Voltar atrás

- Tirar questões do site sem apagar: reimporte o JSON delas **sem** `--publicar` (voltam a
  rascunho), ou `UPDATE questao SET status = 'rascunho' WHERE codigo = '...'`.
- Voltar o banco inteiro: `restaurar` com o backup que ele mesmo gerou antes de restaurar.

## Onde está cada coisa

- Formato e regras do importador: [`README.md`](README.md).
- Contrato da API: `docs/api.md`.
- Exportar e restaurar: `scripts/banco/` e o README da raiz.
- Planilha de revisão: [`revisao-2022.csv`](revisao-2022.csv) (separador `;`, UTF-8).
- Fontes originais (PDFs de prova e gabarito): pacote
  `Estudae_Questoes_Consolidadas_2017_2026_com_2022.zip` (fora do repositório).
- As 480 referências de outros anos (sem texto) continuam fora: precisam dos cadernos.
