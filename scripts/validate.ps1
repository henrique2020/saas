$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Executando Validação Geral do Projeto   " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

Write-Host "`n--- 1. Validando Frontend (client) ---" -ForegroundColor Yellow
Push-Location client
try {
    Write-Host "[client] Executando Lint (ESLint)..." -ForegroundColor Gray
    npm run lint
} catch {
    Write-Host "[client] Lint falhou com avisos/erros pré-existentes." -ForegroundColor Red
}

try {
    Write-Host "[client] Executando Type-check e Build (tsc + vite)..." -ForegroundColor Gray
    npm run build
} catch {
    Write-Host "[client] Build falhou." -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location

Write-Host "`n--- 2. Validando Backend (server) ---" -ForegroundColor Yellow
Push-Location server
try {
    Write-Host "[server] Executando Type-check e Build (tsc)..." -ForegroundColor Gray
    npm run build
} catch {
    Write-Host "[server] Build falhou." -ForegroundColor Red
    Pop-Location
    exit 1
}

try {
    Write-Host "[server] Executando Testes Unitários (vitest)..." -ForegroundColor Gray
    npm run test
} catch {
    Write-Host "[server] Testes unitários falharam." -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location

Write-Host "`n==========================================" -ForegroundColor Green
Write-Host "  Validação concluída com SUCESSO!        " -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
