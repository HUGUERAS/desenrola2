# Executa a migração 001_carretel_integracao_campos.sql
# Requer: DATABASE_URL no ambiente ou .env, ou use Supabase SQL Editor

$migrationPath = Join-Path (Join-Path $PSScriptRoot "..") "docs\database\migrations\001_carretel_integracao_campos.sql"

if (-not (Test-Path $migrationPath)) {
    Write-Host "Erro: Arquivo de migração não encontrado em $migrationPath" -ForegroundColor Red
    exit 1
}

# Tentar carregar .env do apps/api
$envPath = Join-Path (Join-Path $PSScriptRoot "..") "apps\api\.env"
if (Test-Path $envPath) {
    Get-Content $envPath | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            [System.Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
        }
    }
}

$dbUrl = $env:DATABASE_URL
if (-not $dbUrl) {
    $dbUrl = $env:SUPABASE_DB_URL
}

if ($dbUrl) {
    Write-Host "Executando migração via psql..." -ForegroundColor Green
    try {
        $env:PGPASSWORD = ($dbUrl -split '@')[0] -replace '.*://[^:]+:', ''
        psql $dbUrl -f $migrationPath
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Migração concluída com sucesso." -ForegroundColor Green
        } else {
            Write-Host "Erro ao executar migração." -ForegroundColor Red
        }
    } catch {
        Write-Host "Erro: $_" -ForegroundColor Red
    }
} else {
    Write-Host "DATABASE_URL ou SUPABASE_DB_URL não configurado." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Para rodar a migração manualmente:" -ForegroundColor Cyan
    Write-Host "1. Abra o Supabase Dashboard > SQL Editor"
    Write-Host "2. Copie o conteúdo de: $migrationPath"
    Write-Host "3. Cole e execute"
    Write-Host ""
    Write-Host "Ou configure DATABASE_URL e execute novamente:" -ForegroundColor Cyan
    Write-Host '  $env:DATABASE_URL = "postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres"'
    Write-Host "  .\scripts\run-migration.ps1"
}
