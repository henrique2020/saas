#!/usr/bin/env bash
set -e

echo "=========================================="
echo "  Executando Validação Geral do Projeto   "
echo "=========================================="

echo ""
echo "--- 1. Validando Frontend (client) ---"
cd client
echo "[client] Executando Lint (ESLint)..."
npm run lint
echo "[client] Executando Type-check e Build (tsc + vite)..."
npm run build
cd ..

echo ""
echo "--- 2. Validando Backend (server) ---"
cd server
echo "[server] Executando Type-check e Build (tsc)..."
npm run build
echo "[server] Executando Testes Unitários (vitest)..."
npm run test
cd ..

echo ""
echo "=========================================="
echo "  Validação concluída com SUCESSO!        "
echo "=========================================="
