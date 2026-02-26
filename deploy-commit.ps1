#!/usr/bin/env pwsh
# Script de commit e push automático

Set-Location "c:\Users\User\Nova pasta (2)\desenrola"

Write-Host "🔍 Verificando status do git..." -ForegroundColor Cyan
git status --short

Write-Host "`n📦 Adicionando arquivos..." -ForegroundColor Cyan
git add .

Write-Host "`n💾 Fazendo commit..." -ForegroundColor Cyan
git commit -m "feat: sistema completo de camadas e melhorias nas ferramentas CAD

BREAKING CHANGES:
- Fix: seletor de polígonos busca nas layers corretas (lotes-fill, lotes-line)

Features:
- Nova ferramenta 'Selecionar' com edição interativa de vértices (drag & drop)
- Sistema completo de gerenciamento de camadas (criar, cores, opacidade, toggle)
- Highlight visual azul ao passar mouse em todas as ferramentas
- Mensagens melhoradas com emojis e instruções passo-a-passo
- Sistema de seleção persistente preparado (estado global + StatusBar)

UX Improvements:
- Vértices editáveis com feedback visual
- Color picker para cada camada
- Barra de seleção na StatusBar com contador
- Instruções claras: ESC salva, DEL cancela"

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n🚀 Fazendo push para origin main..." -ForegroundColor Cyan
    git push origin main
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n✅ Deploy concluído com sucesso!" -ForegroundColor Green
        Write-Host "Vercel vai detectar o push e fazer deploy automático (~2-3 min)" -ForegroundColor Yellow
    } else {
        Write-Host "`n❌ Erro no push!" -ForegroundColor Red
    }
} else {
    Write-Host "`n❌ Erro no commit!" -ForegroundColor Red
}

Write-Host "`nPressione qualquer tecla para sair..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
