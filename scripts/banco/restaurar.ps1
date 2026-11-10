<#
  Restaura um arquivo .dump (gerado por scripts/banco/exportar.ps1) no banco local do docker compose.

  ATENÇÃO: SUBSTITUI o conteúdo do banco local pelo do arquivo. Antes de restaurar, este
  script exporta o banco atual para backups/antes-de-restaurar-<data>.dump, para você
  poder voltar atrás.

  Uso (na raiz do repositório):
    powershell -ExecutionPolicy Bypass -File scripts/banco/restaurar.ps1 -Arquivo backups/estudae-20261110-1500.dump
#>
param(
  [Parameter(Mandatory = $true)][string]$Arquivo,
  [switch]$SemBackup
)
$ErrorActionPreference = "Stop"
Set-Location (Resolve-Path "$PSScriptRoot/../..")

if (-not (Test-Path $Arquivo)) { Write-Host "Arquivo não encontrado: $Arquivo" -ForegroundColor Red; exit 1 }

# Garante o banco de pé.
docker compose up -d --wait db | Out-Null

if (-not $SemBackup) {
  $seguranca = "backups/antes-de-restaurar-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".dump"
  Write-Host "Guardando o banco atual em $seguranca ..."
  & "$PSScriptRoot/exportar.ps1" -Arquivo $seguranca | Out-Null
}

# A API fica parada durante a restauração, para ninguém ler o banco pela metade.
docker compose stop api | Out-Null

docker cp -q $Arquivo "$(docker compose ps -q db):/tmp/restaurar.dump"
# --clean --if-exists: apaga as tabelas do banco local antes de recriar a partir do arquivo.
# --no-owner: os objetos ficam do usuário local ("estudae"), seja quem for que exportou.
# --single-transaction: ou restaura tudo, ou nada (se der erro, o banco fica como estava).
docker compose exec -T db pg_restore -U estudae -d estudae --clean --if-exists --no-owner --no-privileges --single-transaction /tmp/restaurar.dump
$ok = $LASTEXITCODE -eq 0
docker compose exec -T db rm -f /tmp/restaurar.dump

if (-not $ok) {
  Write-Host "A restauração falhou e foi desfeita; o banco ficou como estava." -ForegroundColor Red
  docker compose start api | Out-Null
  exit 1
}

# Se o arquivo veio de uma versão mais antiga do app, aplica as migrations que faltarem.
docker compose run --rm migrate | Out-Null
docker compose up -d --wait api | Out-Null

Write-Host "Banco restaurado a partir de $Arquivo." -ForegroundColor Green
"SELECT d.slug AS disciplina, count(q.id) AS questoes FROM disciplina d LEFT JOIN tema t ON t.disciplina_id = d.id LEFT JOIN questao q ON q.tema_id = t.id GROUP BY d.slug ORDER BY d.slug;" | docker compose exec -T db psql -U estudae -d estudae
