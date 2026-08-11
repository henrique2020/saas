# 3) Desenvolvimento

## Setup rápido para desenvolvimento

### Backend

```bash
cd server
npm install
npx prisma generate
npx prisma db push
npm run dev
```

### Frontend

```bash
cd client
npm install
npm run dev
```

## Variáveis de ambiente (`server/.env`)

```env
# Banco de dados
DATABASE_URL="mysql://user:password@localhost:3306/stock_saas"

# JWT
JWT_SECRET="sua-chave-secreta"
JWT_REFRESH_SECRET="sua-chave-refresh"

# Alpha Vantage (obrigatória para cotações e dividendos)
ALPHA_VANTAGE_KEY="sua-chave-alpha-vantage"

# CRON - Sincronização de preços
PRICE_SYNC_CRON="15 22 * * 1-5"
PRICE_SYNC_TIMEZONE="America/Sao_Paulo"
PRICE_SYNC_STARTUP="true"

# CRON - Sincronização de dividendos
DIVIDEND_SYNC_CRON="0 10 * * 1-5"
DIVIDEND_SYNC_TIMEZONE="America/Sao_Paulo"
DIVIDEND_SYNC_STARTUP="false"
```

## Arquitetura de serviços

### Market Data Provider (`server/src/services/marketData.ts`)

Provider unificado com fallback automático:

```
Alpha Vantage (primary, 25 calls/day free)
        ↓ quota atingida ou erro
Yahoo Finance (fallback, sem API key)
```

Funções exportadas:

- `getQuote(ticker, market)` — cotação atual
- `getDailySeries(ticker, market)` — série de preços diários
- `getDividends(ticker, market)` — anúncios de dividendos
- `detectMarket(ticker)` — BR ou US
- `getAlphaUsageStats()` — uso diário da API

O contador interno limita a 24 chamadas/dia (para preservar margem do free tier de 25).

### Jobs (CRONs)

| Job           | Arquivo                             | Horário padrão  | Descrição                                   |
| ------------- | ----------------------------------- | ----------------- | --------------------------------------------- |
| Price Sync    | `server/src/jobs/priceSync.ts`    | `15 22 * * 1-5` | Sincroniza cotação de fechamento dos ativos |
| Dividend Sync | `server/src/jobs/dividendSync.ts` | `0 23 * * 1-5`  | Busca anúncios de dividendos e insere novos  |

Ambos os jobs usam `marketData.ts` e se beneficiam do fallback Yahoo Finance.
Ambos registram execução nos **logs de auditoria** (userId=null, ação do sistema).

### Sync mensal manual (Admin)

Endpoint `POST /api/stocks/admin/sync-month` (botão "Sync Cotações" no menu lateral):
- Usa `getYahooMonthlySeries()` (range `1mo`) direto no Yahoo Finance.
- Throttle de 2.5s entre tickers.
- Registra nos logs de auditoria com userId do admin que disparou.

### Middleware

| Middleware | Arquivo                                | Descrição                                       |
| ---------- | -------------------------------------- | ------------------------------------------------- |
| Auth       | `server/src/middleware/auth.ts`      | Verifica JWT + revogação `tokenVersion` + userId/role |
| Rate Limit | `server/src/middleware/rateLimit.ts` | 50/15min (auth) + 300/min (geral), skip localhost |
| Route Logger | `server/src/middleware/routeLogger.ts` | Registra acessos HTTP em `routes.log` e na tabela `route_logs` |

### Utilitários

| Utilitário    | Arquivo                               | Descrição                                       |
| -------------- | ------------------------------------- | ------------------------------------------------- |
| Stock Category | `server/src/utils/stockCategory.ts` | Detecta ACAO/FII/ETF/BDR por ticker               |
| Audit Log      | `server/src/utils/auditLog.ts`      | Registra ações administrativas no banco         |
| Share Helpers  | `server/src/utils/share.ts`         | Geração de token/código para compartilhamentos |
| Fixed Income   | `server/src/utils/fixedIncome.ts`   | Motor de cálculo de renda fixa: capitalização por vigência de taxa, IPCA mensal → anual, IR regressivo (corrente e projetado) e accrual limitado ao encerramento |

### Contextos (Frontend)

| Contexto     | Arquivo                                 | Descrição                     |
| ------------ | --------------------------------------- | ------------------------------- |
| AuthContext  | `client/src/context/AuthContext.tsx`  | Sessão JWT + refresh token     |
| ThemeContext | `client/src/context/ThemeContext.tsx` | Dark/light mode + persistência |

### Páginas (Frontend)

| Página              | Arquivo                                        | Descrição                                        |
| ------------------- | ---------------------------------------------- | -------------------------------------------------- |
| Dashboard           | `client/src/pages/Dashboard.tsx`             | Home com blocos ancorados de RV (`#renda-variavel`) e RF (`#renda-fixa`), 3 gráficos de distribuição |
| StockDetail         | `client/src/pages/StockDetail.tsx`           | Detalhe por ação + edição/exclusão inline       |
| NewTransaction      | `client/src/pages/NewTransaction.tsx`        | Formulários e CSV de movimentação, dividendos, renda fixa e taxas |
| FixedIncome         | `client/src/pages/FixedIncome.tsx`           | Gestão de renda fixa (aportes, encerramento, valores líquidos) |
| AdminRates          | `client/src/pages/AdminRates.tsx`            | Cadastro de taxas Selic/IPCA (admin)             |
| Settings            | `client/src/pages/Settings.tsx`              | Configurações do usuário (nome, email, senha)   |
| ClosedPositions     | `client/src/pages/ClosedPositions.tsx`       | Posições fechadas com P/L realizado              |
| PnLOverview         | `client/src/pages/PnLOverview.tsx`           | Lucro/Perda geral e por ação                     |
| AdminDividends      | `client/src/pages/AdminDividends.tsx`        | Gestão de dividendos automáticos (admin)         |
| SharedDashboard     | `client/src/pages/SharedDashboard.tsx`       | Visualização compartilhada (read-only)           |
| SharedStockDetail   | `client/src/pages/SharedStockDetail.tsx`     | Detalhe compartilhado (read-only)                |
| ShareConfirm        | `client/src/pages/ShareConfirm.tsx`          | Confirmação de acesso compartilhado              |
| AuditLogs           | `client/src/pages/AuditLogs.tsx`             | Logs de auditoria (admin)                         |
| Login               | `client/src/pages/Login.tsx`                 | Login                                              |
| Register            | `client/src/pages/Register.tsx`              | Registro                                           |

### Componentes (Frontend)

| Componente    | Arquivo                                        | Descrição                              |
| ------------- | ---------------------------------------------- | ---------------------------------------- |
| AppLayout     | `client/src/components/AppLayout.tsx`        | Layout global (header/nav + sidebar)    |
| Sidebar       | `client/src/components/Sidebar.tsx`          | Menu lateral expansível + SidebarToggle |

## Execução das CRONs

Ambas as CRONs iniciam automaticamente junto com o backend:

- **Price Sync**: Roda no horário configurado. Com `PRICE_SYNC_STARTUP=true`, executa imediatamente ao iniciar.
- **Dividend Sync**: Roda no horário configurado. Com `DIVIDEND_SYNC_STARTUP=true`, executa imediatamente ao iniciar (desabilitado por padrão para evitar consumo de API em dev).

Troubleshooting:

```bash
cd server
npm install
# Se erro de módulo:
npm install node-cron
```

## Como expandir uma funcionalidade já existente

Exemplo: ampliar `transactions/import-csv` com nova coluna.

1. Ajuste parsing/validação em `server/src/routes/transactions.ts`.
2. Atualize o payload persistido (`prisma.transaction.create`).
3. Alinhe a UI de importação em `client/src/pages/NewTransaction.tsx`.
4. Atualize tipos em `client/src/types/index.ts` (se necessário).
5. Atualize documentação de formato (template CSV e docs).

Exemplo: adicionar novo ETF brasileiro à lista.

1. Edite `server/src/utils/stockCategory.ts`.
2. Adicione o ticker ao `Set` `BR_ETFS`.
3. Reinicie o backend (a `syncStockCategories()` recategorizará automaticamente).

Exemplo: evoluir compartilhamento de perfil.

1. Ajuste schema Prisma (`ProfileShare`) se houver novos estados/atributos.
2. Atualize regras em `server/src/routes/shares.ts` (autorização, expiração, confirmação).
3. Reaproveite helpers em `server/src/utils/share.ts`.
4. Atualize telas:
   - `client/src/pages/Dashboard.tsx` (menus de gestão),
   - `client/src/pages/ShareConfirm.tsx`,
   - páginas `/shared/*` read-only.
5. Atualize tipos em `client/src/types/index.ts`.

## Como desenvolver e integrar novas funcionalidades

Fluxo recomendado:

1. **Definir contrato da API**
   - Endpoint, método, input/output, regras e erros.
2. **Implementar no backend**
   - Nova rota em `server/src/routes`.
   - Registrar rota em `server/src/index.ts` se for módulo novo.
   - Persistir via Prisma (e atualizar schema se necessário).
3. **Integrar no frontend**
   - Chamada com `client/src/services/api.ts`.
   - Tela/componente em `client/src/pages` ou componentes compartilhados.
   - Ajustar tipos em `client/src/types`.
4. **Garantir consistência funcional**
   - Mensagens de erro/sucesso.
   - Estado de loading.
   - Compatibilidade com telas existentes (dashboard/ticker).
   - Testar em dark e light mode.
5. **Documentar**
   - Atualizar README e docs em `docs/`.

## Convenções úteis do projeto

- Rotas autenticadas usam `authMiddleware`.
- Sempre filtrar dados por `req.userId` quando o dado for do usuário.
- Operações administrativas devem checar `req.userRole === 'ADMIN'`.
- Tickers em uppercase.
- Campos monetários enviados/armazenados como numéricos (com `Number(...)` no backend).
- Gráficos Recharts: usar valores do `useTheme()` para cores em dark mode.
- CSS dark mode: variáveis em `.dark` aplicadas ao `<html>`, definidas em `client/src/index.css`.
- **IDs UUID**: As tabelas Transaction, StockDividend, UserDividend e ProfileShare usam `String @id @default(uuid()) @db.VarChar(36)`. Nas rotas, usar `String(id)` (sem `Number()`).
- **Layout mobile-first**: escreva as classes para o celular primeiro e use `sm:`/`md:`/`lg:`
  para telas maiores. Ao criar uma tela nova, siga o padrão da tabela de responsividade em
  `docs/02-funcionamento-expandido.md`:
  - container `px-3 sm:px-6 py-4 sm:py-8`;
  - cards `p-4 sm:p-6`, grids começando em 1–2 colunas;
  - toda `<table>` dentro de `overflow-x-auto` **e** com `min-w-[...]` própria;
  - modais em *bottom sheet* no celular (`items-end sm:items-center`, `rounded-t-2xl sm:rounded-xl`, `max-h-[90vh] overflow-y-auto`);
  - abas/filtros em faixa rolável (`overflow-x-auto` + `whitespace-nowrap shrink-0`);
  - gráficos com wrapper de altura + `ResponsiveContainer height="100%"`;
  - botões de ícone com no mínimo `p-2` (alvo de toque).

## Migração UUID

As seguintes tabelas utilizam UUID como chave primária:

| Tabela         | Campo | Formato             |
| -------------- | ----- | ------------------- |
| Transaction    | id    | UUID v4 (VarChar 36) |
| StockDividend  | id    | UUID v4 (VarChar 36) |
| UserDividend   | id    | UUID v4 (VarChar 36) |
| ProfileShare   | id    | UUID v4 (VarChar 36) |

As demais tabelas (User, Stock, Portfolio, StockPrice, AuditLog) continuam com `Int @id @default(autoincrement())`.

⚠️ **Atenção**: Ao aplicar `prisma db push` pela primeira vez após a migração UUID, as tabelas afetadas serão recriadas (perda de dados nessas tabelas). Faça backup antes em produção.

## Como realizar casos de teste

## 1. Testes técnicos mínimos (a cada alteração)

```bash
# backend
cd server
npm test
npx tsc --noEmit

# frontend
cd client
npx tsc --noEmit
npm run build
```

### Suíte automatizada atual

- Runner: **Vitest** (`server`).
- Arquivos:
  - `server/src/utils/share.test.ts` — geração/validação de token e código.
  - `server/src/utils/fixedIncome.test.ts` — motor de renda fixa: tabela regressiva de IR,
    vigência de taxas, CDI derivado da Selic, IPCA mensal → anual (`monthlyToAnnual`),
    acumulado 12 meses (`accumulatedIpca`), IPCA+ multiplicativo, deflação,
    valor corrente líquido, accrual travado no encerramento e `settlementDiff`.
- Scripts:
  - `npm test`
  - `npm run test:watch`

## 2. Casos de teste funcionais essenciais

### Autenticação

- Registro com email novo.
- Registro com email duplicado.
- Login com senha inválida e válida.
- Refresh token válido/inválido.
- Rate limit em login (50 tentativas / 15 min).

### Movimentações

- Criar compra e venda.
- Conferir impacto em quantidade, PM e PT.
- Editar e excluir movimentação própria.
- Garantir que usuário não altera dados de outro usuário.
- Categorização automática do stock criado (FII/ETF/BDR/ACAO).
- Excluir movimentação via botão na tabela (confirma antes de deletar).

### Dividendos

- Cadastrar dividendo central com admin.
- Validar bloqueio (`403`) para usuário comum no dividendo central.
- Validar regra automática `data-ex = data-com + 1 dia`.
- Cadastrar dividendo manual.
- **Editar** dividendo central (admin) e manual (próprio usuário).
- **Excluir** dividendo via botão inline (manual: próprio usuário; auto: apenas admin).
- Confirmar cálculo consolidado no dashboard e no detalhe da ação.
- Conferir gráfico de dividendos agrupado (dia/mês/ano).
- Validar que CRON de dividendos não duplica registros existentes.

### Importação CSV

- Arquivo 100% válido.
- Arquivo com linhas parcialmente inválidas.
- Data inválida, operação inválida, formato inválido.
- Conferir quantidade de registros importados e mensagens de erro.
- Cobrir ambos os fluxos:
  - movimentações (`/transactions/import-csv`)
  - dividendos centrais (`/dividends/stock-dividends/import-csv`)

### Dark Mode

- Toggle persiste após refresh da página.
- Gráficos (Dashboard e StockDetail) respeitam cores do tema.
- Tooltip e eixos legíveis em ambos os modos.

### Responsividade / Mobile

Testar em pelo menos 320px, 360px e 768px de largura:

- Nenhuma página deve gerar **scroll horizontal** (`document.documentElement.scrollWidth`
  precisa ser igual a `window.innerWidth`). Tabelas largas devem rolar apenas dentro do
  próprio container `overflow-x-auto`.
- Header: em telas pequenas os botões viram ícones e nada estoura ou quebra a linha.
- Menu lateral: abre em overlay, ocupa no máximo `18rem`, rola internamente quando há
  muitos itens e **trava a rolagem do body** enquanto está aberto.
- Modais (editar movimentação, editar dividendo, encerrar renda fixa, aportes): aparecem
  como *bottom sheet*, não ultrapassam a altura da tela e rolam internamente.
- Formulários: nenhum input estoura a largura; ao focar um campo o iOS não deve dar zoom.
- Abas de "Nova Movimentação" e filtros: roláveis horizontalmente, sem quebra feia.
- Gráficos: pizza mostra o percentual dentro da fatia + legenda; barras cabem na largura.
- Alvos de toque (ícones de editar/excluir) confortáveis, sem cliques acidentais.

### Blocos expansíveis da Home

- Clicar no cabeçalho "Renda Variável" / "Renda Fixa" recolhe e expande o bloco.
- O estado sobrevive a um refresh (persistido em `localStorage` → `dashboard:sections`).
- Com o bloco recolhido, clicar no card "Renda Variável"/"Renda Fixa" do topo ou no item
  correspondente do menu lateral **reabre** o bloco e rola até ele.
- O link "gerenciar" da Renda Fixa continua navegando para `/renda-fixa` (não recolhe o bloco).
- Valores altos (milhões/bilhões) permanecem dentro do cartão, sem quebrar no meio do número.

### Rate Limiting

- Validar que localhost não é bloqueado.
- Validar que IPs externos são limitados após exceder threshold.

### UI/UX

- Ordenações (home e histórico de ticker).
- Títulos de aba (`Home`, ticker no `<title>`).
- Bug de data D-1 não regressou na listagem.
- Badges de categoria visíveis na tabela de posições.
- Sidebar expansível funciona em mobile e desktop.
- Navegação entre: Home, Posições Fechadas, Lucro/Perda, Configurações.
- Fluxo de compartilhamento:
  - geração de link + código,
  - confirmação com token/código,
  - visualização read-only do portfólio compartilhado (sem chamadas de API externas),
  - revogação/remoção de compartilhamento.

### Configurações do Usuário

- Alterar nome com sucesso.
- Alterar e-mail (validar unicidade — rejeitar se já existir).
- Alterar senha (requer senha atual correta, mín. 6 chars).
- Rejeitar alteração de senha com senha atual incorreta.

### Posições Fechadas

- Exibir apenas ativos com quantidade ≤ 0.
- P/L realizado calculado corretamente (totalSold - totalBought).
- Dividendos totais recebidos enquanto ativo estava na carteira.

### Lucro/Perda (P/L Overview)

- Visão geral: soma de não-realizado + realizado + dividendos **dentro de cada classe**.
- Visão por ação: breakdown individual.
- P/L não-realizado = (preço atual × qtd) - total investido.
- P/L realizado = total vendido - custo médio das cotas vendidas.
- **Renda fixa aparece em bloco próprio** e o seu resultado não é somado ao de renda variável.

### Renda Fixa

- Cadastro por formulário e por CSV (`Nome;Tipo;Indexador;Taxa;Valor;Data-aporte;Vencimento;Isento`);
  linhas com mesmo Nome + Vencimento devem virar aportes do mesmo investimento.
- Prefixado de 1 ano a 10% sobre R$ 1.000 → bruto R$ 1.100.
- Valor atual exibido deve ser o **líquido** (IR pela faixa do prazo decorrido);
  IR do vencimento aparece separado na projeção.
- Investimento encerrado **não pode continuar rendendo** após a data de encerramento.
- Coluna "Estimado" deve mostrar a diferença entre o recebido e o esperado no encerramento.
- Item isento não deve descontar IR em nenhum dos dois cálculos.

### Taxas de referência (Admin)

- Selic cadastrada em **% ao ano**; IPCA cadastrado como **variação do mês**
  (1º dia do mês de referência), aceitando valores negativos.
- CDI não pode ser cadastrado — deve ser sempre derivado como `Selic - 0,10 p.p.`.
- Importação CSV (`Tipo;Data-inicio;Taxa;Observacao`) faz upsert por (tipo, data).
- `GET /rates/current` deve retornar o IPCA do mês, o anualizado e o acumulado 12 meses.

### Home (RF × RV)

- Blocos de Renda Variável e Renda Fixa visíveis simultaneamente, sem abas.
- Itens "Renda Variável" e "Renda Fixa" do menu levam ao bloco correspondente.
- Três gráficos renderizam: RV por tipo, RF por tipo e total RF × RV.
- Patrimônio total consolida as duas classes; lucro/perda **não**.

## Checklist para PR/entrega

- Typecheck backend e frontend sem erros.
- Build do frontend concluído.
- Fluxos principais validados manualmente.
- Testes em dark mode e light mode.
- Documentação atualizada para a mudança.
