# Executa migrações via Supabase CLI
# Requer: projeto linkado com supabase link --project-ref <seu-project-id>

param(
    [Parameter()]
    [ValidateSet("push", "status", "link")]
    [string]$Action = "push"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root

Write-Host "Supabase CLI — $Action" -ForegroundColor Cyan

switch ($Action) {
    "push" {
        Write-Host "Enviando migrações para o projeto Supabase..." -ForegroundColor Yellow
        npx supabase db push
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Migrações aplicadas com sucesso." -ForegroundColor Green
        } else {
            Write-Host "Erro. Verifique se o projeto está linkado: npx supabase link --project-ref SEU_PROJECT_ID" -ForegroundColor Red
        }
    }
    "status" {
        npx supabase migration list
    }
    "link" {
        Write-Host "Para vincular o projeto:" -ForegroundColor Yellow
        Write-Host "  npx supabase login" -ForegroundColor White
        Write-Host "  npx supabase link --project-ref SEU_PROJECT_ID" -ForegroundColor White
        Write-Host ""
        Write-Host "O project-id está na URL do Dashboard: https://supabase.com/dashboard/project/SEU_PROJECT_ID" -ForegroundColor Gray
    }
}
