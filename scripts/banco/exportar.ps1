<#
  Exporta o banco do Estudaê (o PostgreSQL do docker compose) para um arquivo .dump.

  O .dump tem TUDO o que está no banco: estrutura (tabelas, migrations aplicadas) e dados
  (disciplinas, temas, vídeos, questões...). Serve para:
    - mandar para outra pessoa, que restaura com scripts/banco/restaurar.ps1;
    - subir para um banco online (pg_restore direto no servidor, ver README).

  Uso (na raiz do repositório, com o compose de pé):
    powershell -ExecutionPolicy Bypass -File scripts/banco/exportar.ps1
    powershell -ExecutionPolicy Bypass -File scripts/banco/exportar.ps1 -Arquivo backups/antes-da-revisao.dump

  O .dump leva TODO o conteúdo, inclusive as imagens das questões (tabela imagem): o
  conteúdo não fica mais no repositório, então este arquivo é a cópia para compartilhar.
#>
param(
  [string]$Arquivo = ("backups/estudae-" + (Get-Date -Format "yyyyMMdd-HHmm") + ".dump")
)
$ErrorActionPreference = "Stop"
Set-Location (Resolve-Path "$PSScriptRoot/../..")

# O banco precisa estar de pé (o pg_dump roda dentro do container do banco).
$estado = docker compose ps --status running --services 2>$null
if (-not ($estado -contains "db")) {
  Write-Host "O banco não está rodando. Suba com:  docker compose up -d --wait db" -ForegroundColor Red
  exit 1
}

New-Item -ItemType Directory -Force (Split-Path $Arquivo -Parent) | Out-Null

# -Fc = formato "custom" do PostgreSQL: compactado, e o pg_restore consegue restaurar só
#       partes dele se precisar. --no-owner/--no-privileges: o arquivo não fica preso ao
#       usuário "estudae", e restaura em qualquer banco (inclusive online).
# O dump é gerado DENTRO do container e copiado depois: redirecionar binário pelo
# PowerShell (">") corrompe o arquivo.
docker compose exec -T db pg_dump -U estudae -d estudae -Fc --no-owner --no-privileges -f /tmp/estudae.dump
if ($LASTEXITCODE -ne 0) { Write-Host "pg_dump falhou." -ForegroundColor Red; exit 1 }
docker cp -q "$(docker compose ps -q db):/tmp/estudae.dump" $Arquivo
docker compose exec -T db rm -f /tmp/estudae.dump

# Resumo do que foi exportado, para conferir do outro lado.
$resumo = @"
SELECT d.slug AS disciplina, count(q.id) AS questoes,
       count(*) FILTER (WHERE q.status = 'publicada') AS publicadas
FROM disciplina d LEFT JOIN tema t ON t.disciplina_id = d.id LEFT JOIN questao q ON q.tema_id = t.id
GROUP BY d.slug ORDER BY d.slug;
"@
$tamanho = "{0:N1} KB" -f ((Get-Item $Arquivo).Length / 1KB)
Write-Host "Banco exportado para $Arquivo ($tamanho)." -ForegroundColor Green
# Resumo só se o banco já tem as tabelas do Estudaê (banco recém-criado não tem).
$tem = (docker compose exec -T db psql -U estudae -d estudae -tAc "SELECT to_regclass('public.disciplina') IS NOT NULL;")
if ("$tem".Trim() -eq "t") { $resumo | docker compose exec -T db psql -U estudae -d estudae }
else { Write-Host "(banco ainda sem as tabelas do Estudaê)" }
