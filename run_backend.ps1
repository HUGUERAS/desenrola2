
# Script para iniciar o Backend do Desenrola
# Garante o uso do venv e PYTHONPATH correto

Write-Host "🚀 Iniciando Backend Desenrola..." -ForegroundColor Green
$env:PYTHONPATH = "$PSScriptRoot\apps\api;$PSScriptRoot"
& ".\.venv\Scripts\python.exe" -m uvicorn apps.api.main:app --reload --port 8010
