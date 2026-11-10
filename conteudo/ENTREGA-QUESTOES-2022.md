# Entrega: questões do Encceja 2022 prontas para o banco oficial

Este guia é para quem vai carregar as questões no banco do ambiente oficial (demonstração ou
produção). Tudo o que você precisa está no repositório. Não há passo manual de banco além dos
comandos abaixo.

## O que está pronto

| Arquivo | Prova | Temas | Questões | Com imagem |
|---|---|---|---|---|
| `matematica.json` | Ensino Médio | 9 | 72 (60 oficiais + 12 autorais) | 30 |
| `linguagens.json` | Ensino Médio | 10 | 72 (60 oficiais + 12 autorais) | 18 |
| `matematica-fundamental.json` | Ensino Fundamental | 8 | 60 oficiais | 21 |
| `linguagens-fundamental.json` | Ensino Fundamental | 10 | 60 oficiais | 20 |
| `imagens/2022/` | recortes das provas (WebP, 14,5 MB) | | 240 arquivos | |

- **240 questões oficiais de 2022**: os 8 cadernos (Ensino Fundamental e Médio, Matemática e
  Linguagens, aplicação Nacional e Reaplicação/PPL), 30 questões cada.
- Cada questão foi **transcrita a partir da imagem da prova** (não da extração automática),
  com texto de apoio separado do enunciado, as 4 alternativas na ordem da prova, a resposta
  correta igual ao **gabarito oficial** do INEP, uma **resolução** em linguagem simples e o
  **tema**. As contas de Matemática foram refeitas: todas batem com o gabarito.
- Questões que dependem de figura, tabela, gráfico, tirinha ou foto têm `imagem` (o recorte
  da prova) com uma **descrição** para leitor de tela e leitura em voz alta.
- `Português` passou a se chamar **`Linguagens`** (slug `linguagens`), como no Encceja: inclui
  também língua inglesa, espanhola, arte e educação física.

Validação: os 4 arquivos passam no importador (`--validar`), inclusive a conferência de que
cada imagem existe. Carregados num banco local novo: 264 questões publicadas, sem erro.

## O que mudou na estrutura (vai junto no mesmo PR)

- **Migration `NivelEImagem`**: `disciplina.nivel` (`fundamental`/`medio`, padrão `medio`) e
  `questao.imagem_descricao`. A coluna `questao.imagem_url` já existia e passou a ser usada.
  Roda sozinha pelo serviço `migrate` do Compose (ou pelo `migrar` no Render).
- **Importador**: campos novos `disciplina.nivel` e `questao.imagem` (`arquivo` + `descricao`).
- **API**: `GET /api/disciplinas` devolve `nivel`; as questões devolvem `imagem`
  (`{ url, descricao }` ou `null`). Questão com imagem mantém a ordem das alternativas da
  prova (o recorte mostra as letras originais); as demais continuam embaralhadas.
- **Imagens**: servidas pela própria API em `/conteudo/imagens/...`, a partir da pasta
  `conteudo/imagens/` que já vai dentro da imagem Docker.
- **App**: a pessoa escolhe a prova (Fundamental ou Médio) no primeiro acesso, e pode trocar
  no Perfil.

## Antes de publicar no ambiente oficial

1. **Revisão humana.** Combinado do projeto (`conteudo/README.md`): outra pessoa confere antes
   de publicar fora do ambiente local. Use `conteudo/revisao-2022.csv` (uma linha por questão,
   com colunas `revisado_por` e `ok`). Prioridade:
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
- [ ] `encceja-em-nacional-2022-mat-042` (matematica.json, `geometria-plana`): localização em quadriculado com pontos cardeais; não há tema de localização, ficou em geometria plana.
- [ ] `encceja-em-nacional-2022-mat-048` (matematica.json, `geometria-plana`): trigonometria no triângulo retângulo (seno de 30º), sem tema próprio.
- [ ] `encceja-em-nacional-2022-mat-056` (matematica.json, `funcoes`): as alternativas da prova são gráficos; viraram descrições em texto de cada reta, com a imagem dos quatro gráficos mantida.
- [ ] `encceja-em-ppl-2022-ling-014` (linguagens.json, `variacao-linguistica`): na prova a letra do samba traz “vortermo”, a alternativa correta cita “Nós vortemo” e o enunciado grafa “Adoniram”; transcrito como está na prova.
- [ ] `encceja-em-ppl-2022-ling-001` (linguagens.json, `comunicacao-e-midias`): o texto é o próprio cartaz; transcritos título e legenda, imagem mantida.
- [ ] `encceja-em-nacional-2022-ling-015` (linguagens.json, `lingua-inglesa`): no cartaz aparece “$60,000”; ficou “US$ 60,000” porque o validador recusa “$” isolado (regra contra LaTeX). Decidir se mantém.
- [ ] `encceja-em-ppl-2022-ling-027` (linguagens.json, `lingua-inglesa`): palavras em negrito na prova; indicadas numa linha entre parênteses no fim do texto de apoio.
- [ ] `encceja-em-ppl-2022-ling-003` (linguagens.json, `arte`): as alternativas da prova são quatro fotografias; viraram descrições em texto. Conferir se a redação não facilita a resposta.
- [ ] `encceja-ef-nacional-2022-mat-037` (matematica-fundamental.json, `fracoes-e-decimais`): número misto “um inteiro e um meio” escrito como “1½”.
- [ ] `encceja-ef-nacional-2022-mat-036` (matematica-fundamental.json, `geometria`): localização em quadriculado; ficou em geometria.
- [ ] `encceja-ef-nacional-2022-ling-012` (linguagens-fundamental.json, `interpretacao-de-texto`): o Texto I é só uma fotografia; marcador “[Fotografia]” no texto de apoio e os cartazes na descrição da imagem.
- [ ] `encceja-ef-ppl-2022-ling-028` (linguagens-fundamental.json, `comunicacao-e-midias`): a prova grafa o autor “WALTTERSON” (correto: Watterson); mantido como na prova.
- [ ] `encceja-ef-ppl-2022-ling-020` (linguagens-fundamental.json, `lingua-espanhola`): o trecho não diz explicitamente que Irene e o narrador são irmãos; a resolução infere.
- [ ] `encceja-ef-nacional-2022-ling-007` (linguagens-fundamental.json, `arte`): o gabarito oficial (“estimula a imaginação do público”) não está explícito no texto; resolução faz a inferência. **Revisar.**
- [ ] `encceja-ef-nacional-2022-ling-027` (linguagens-fundamental.json, `arte`): a resposta mais evidente pelo texto seria outra; o gabarito oficial foi mantido. **Revisar.**

Já resolvidas: `encceja-ef-nacional-2022-mat-059` e `encceja-ef-ppl-2022-mat-045` ganharam o
tema `probabilidade-e-contagem` no Fundamental; `encceja-ef-ppl-2022-ling-016` ganhou a imagem
do anúncio (as faixas pretas são da própria prova).

Para corrigir uma questão: edite o JSON, rode `--validar` e reimporte. O `codigo` é a chave:
reimportar **atualiza** a questão, não duplica.

## Como carregar no banco oficial

Pré-requisito: o ambiente rodando a versão desta branch (com a migration `NivelEImagem`).

### VM com Docker Compose (plano A)

```bash
git pull                                    # a versão com os JSONs, as imagens e a migration
docker compose up -d --build --wait         # reconstrói a imagem; o serviço migrate aplica a migration
for f in matematica linguagens matematica-fundamental linguagens-fundamental; do
  docker compose run --rm api importar conteudo/$f.json --validar
done
for f in matematica linguagens matematica-fundamental linguagens-fundamental; do
  docker compose run --rm api importar conteudo/$f.json --publicar
done
curl https://<endereço>/api/disciplinas     # 4 disciplinas: 72, 72, 60 e 60 questões
```

### Render (plano B)

A imagem Docker já leva `conteudo/` e as imagens. Depois do deploy (o `migrar` roda antes do
start), rode o mesmo `importar ... --publicar` pelo Shell do serviço:
`dotnet Estudae.Api.dll importar conteudo/matematica.json --publicar` (e os outros três).

### Banco que já tinha a disciplina `portugues`

O importador **nunca apaga**. Num banco onde já foi importado o `portugues.json` antigo, a
disciplina `portugues` continua lá e apareceria ao lado de `linguagens` (com as mesmas 12
questões autorais, que o importador **move** para `linguagens` pelo `codigo`). Depois de
importar `linguagens.json`, remova o que sobrou da antiga, numa transação:

```sql
BEGIN;
DELETE FROM videoaula WHERE tema_id IN (SELECT t.id FROM tema t JOIN disciplina d ON d.id = t.disciplina_id WHERE d.slug = 'portugues');
DELETE FROM questao   WHERE tema_id IN (SELECT t.id FROM tema t JOIN disciplina d ON d.id = t.disciplina_id WHERE d.slug = 'portugues');
DELETE FROM tema      WHERE disciplina_id = (SELECT id FROM disciplina WHERE slug = 'portugues');
DELETE FROM disciplina WHERE slug = 'portugues';
COMMIT;
```

(`docker compose exec db psql -U estudae -d estudae`.) Banco novo não precisa disso.

### Voltar atrás

- Tirar as questões do site sem apagar: reimporte o arquivo **sem** `--publicar` (voltam a
  rascunho).
- Desfazer a estrutura: a migration tem `Down` (remove `nivel` e `imagem_descricao`), mas só
  depois de voltar o código da API para a versão anterior.

## Onde está cada coisa

- Formato e regras do importador: `conteudo/README.md`.
- Contrato da API: `docs/api.md`.
- Planilha de revisão: `conteudo/revisao-2022.csv` (separador `;`, UTF-8).
- Fontes originais (PDFs de prova e gabarito): pacote
  `Estudae_Questoes_Consolidadas_2017_2026_com_2022.zip` (fora do repositório).
- As 480 referências de outros anos (sem texto) continuam fora: precisam dos cadernos.
