#!/bin/sh
# Restaura um .dump no banco local do docker compose. SUBSTITUI o conteúdo atual
# (antes, guarda uma cópia em backups/antes-de-restaurar-<data>.dump).
# Mesmo comportamento de restaurar.ps1 (ver comentários lá).
#
# Uso (na raiz do repositório):
#   sh scripts/banco/restaurar.sh backups/estudae-20261110-1500.dump
set -e
# Git Bash (Windows) converte /tmp/... em caminho do Windows antes de chamar o docker; isto desliga.
export MSYS_NO_PATHCONV=1
cd "$(dirname "$0")/../.."
ARQUIVO="$1"
[ -n "$ARQUIVO" ] || { echo "Uso: sh scripts/banco/restaurar.sh <arquivo.dump>" >&2; exit 2; }
[ -f "$ARQUIVO" ] || { echo "Arquivo não encontrado: $ARQUIVO" >&2; exit 1; }

docker compose up -d --wait db >/dev/null
SEGURANCA="backups/antes-de-restaurar-$(date +%Y%m%d-%H%M%S).dump"
echo "Guardando o banco atual em $SEGURANCA ..."
sh scripts/banco/exportar.sh "$SEGURANCA" >/dev/null

docker compose stop api >/dev/null
docker cp -q "$ARQUIVO" "$(docker compose ps -q db):/tmp/restaurar.dump"
if docker compose exec -T db pg_restore -U estudae -d estudae --clean --if-exists --no-owner --no-privileges --single-transaction /tmp/restaurar.dump; then
  docker compose exec -T db rm -f /tmp/restaurar.dump
else
  docker compose exec -T db rm -f /tmp/restaurar.dump
  echo "A restauração falhou e foi desfeita; o banco ficou como estava." >&2
  docker compose start api >/dev/null
  exit 1
fi

docker compose run --rm migrate >/dev/null   # migrations que faltarem, se o arquivo for de versão antiga
docker compose up -d --wait api >/dev/null
echo "Banco restaurado a partir de $ARQUIVO."
docker compose exec -T db psql -U estudae -d estudae -c \
  "SELECT d.slug AS disciplina, count(q.id) AS questoes FROM disciplina d LEFT JOIN tema t ON t.disciplina_id = d.id
   LEFT JOIN questao q ON q.tema_id = t.id GROUP BY d.slug ORDER BY d.slug;"
