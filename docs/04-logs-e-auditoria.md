# 04) Sistema de Logs, Auditoria e Registros de Rota

O **StockSaaS** possui dois mecanismos complementares de rastreamento e auditoria:

## 1. Log de Acesso a Rotas (`routeLogger.ts`)

Todas as requisições enviadas à API sob o prefixo `/api` passam pelo middleware `routeLogger.ts`.

### Destinos do Log:
1. **Arquivo de Log (`server/logs/routes.log`)**:
   - Cada requisição gera uma linha com timestamp, método HTTP, rota, código de status, tempo de execução (ms), IP de origem e ID do usuário autenticado (ou `guest`).
   - Exemplo: `[2026-08-08T14:00:00.000Z] GET /api/dashboard/summary 200 45ms - IP: ::1 - User: 1`
2. **Tabela do Banco de Dados (`route_logs`)**:
   - Schema Prisma:
     ```prisma
     model RouteLog {
       id        Int      @id @default(autoincrement())
       userId    Int?     @map("user_id")
       method    String   @db.VarChar(10)
       path      String   @db.VarChar(255)
       status    Int
       duration  Int      // milissegundos
       ip        String?  @db.VarChar(45)
       userAgent String?  @map("user_agent") @db.VarChar(255)
       createdAt DateTime @default(now()) @map("created_at")

       @@index([userId])
       @@index([createdAt])
       @@map("route_logs")
     }
     ```

---

## 2. Logs de Auditoria de Ações (`audit_logs`)

Diferente do log de tráfego HTTP, os logs de auditoria registram ações administrativas e execuções de tarefas do sistema.

### Ações Auditadas:
- Cadastro, edição e remoção de dividendos centrais.
- Cadastro, edição e remoção de taxas de referência (Selic/IPCA).
- Cadastro, atualização, encerramento e aporte em investimentos de Renda Fixa.
- Importações em lote via CSV.
- Execução de tarefas CRON de preço (`CRON_PRICE_SYNC`) e dividendos (`CRON_DIVIDEND_SYNC`).

Os administradores podem consultar este histórico na tela **/admin/audit-logs**.
