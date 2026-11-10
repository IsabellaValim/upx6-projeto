#!/bin/sh
# Exporta o banco do Estudaê (o PostgreSQL do docker compose) para um arquivo .dump.
# Mesmo comportamento de exportar.ps1 (ver comentários lá).
#
# Uso (na raiz do repositório, com o compose de pé):
#   sh scripts/banco/exportar.sh                       # backups/estudae-AAAAMMDD-HHMM.dump
#   sh scripts/banco/exportar.sh backups/meu.dump
set -e
# Git Bash (Windows) converte /tmp/... em caminho do Windows antes de chamar o docker; isto desliga.
export MSYS_NO_PATHCONV=1
cd "$(dirname "$0")/../.."
ARQUIVO="${1:-backups/estudae-$(date +%Y%m%d-%H%M).dump}"

if ! docker compose ps --status running --services | grep -qx db; then
  echo "O banco não está rodando. Suba com:  docker compose up -d --wait db" >&2
  exit 1
fi
mkdir -p "$(dirname "$ARQUIVO")"

docker compose exec -T db pg_dump -U estudae -d estudae -Fc --no-owner --no-privileges -f /tmp/estudae.dump
docker cp -q "$(docker compose ps -q db):/tmp/estudae.dump" "$ARQUIVO"
docker compose exec -T db rm -f /tmp/estudae.dump

echo "Banco exportado para $ARQUIVO ($(du -h "$ARQUIVO" | cut -f1))."
# Resumo só se o banco já tem as tabelas do Estudaê (banco recém-criado não tem).
TEM=$(docker compose exec -T db psql -U estudae -d estudae -tAc "SELECT to_regclass('public.disciplina') IS NOT NULL;")
[ "$TEM" = "t" ] || { echo "(banco ainda sem as tabelas do Estudaê)"; exit 0; }
docker compose exec -T db psql -U estudae -d estudae -c \
  "SELECT d.slug AS disciplina, count(q.id) AS questoes, count(*) FILTER (WHERE q.status = 'publicada') AS publicadas
   FROM disciplina d LEFT JOIN tema t ON t.disciplina_id = d.id LEFT JOIN questao q ON q.tema_id = t.id
   GROUP BY d.slug ORDER BY d.slug;"
