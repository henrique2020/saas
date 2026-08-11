# 1) Funcionamento resumido

## Tipo de arquitetura
- **Arquitetura web cliente-servidor (SPA + API REST)**.
- **Monorepo** com dois apps:
  - `client/` (React + Vite + TypeScript)
  - `server/` (Express + TypeScript + Prisma + MySQL)
- Autenticação stateless com **JWT** (access + refresh token).

## Padrão de projeto
- **Frontend**: organização modular por páginas (`src/pages`), custom hooks reutilizáveis (`src/hooks` — `useAuth`, `useDashboard`, `useTransactions`, `useFixedIncome`), componentes reutilizáveis (`src/components` — `SummaryCards`, `Sidebar`, `AppLayout`), contextos (`src/context` — Auth + Theme), cliente HTTP central (`src/services/api.ts`) e tipos compartilhados (`src/types`).
- **Backend**: arquitetura em camadas clara (Rotas → Controllers → Services → ORM/Banco):
  - **Controllers** (`src/controllers/`): `authController`, `dashboardController`, `dividendController`, `fixedIncomeController`, `transactionController`, `rateController`, `stockController`, `shareController`, `auditLogController`.
  - **Services** (`src/services/`): `portfolioService`, `dividendService`, `fixedIncomeService`, `marketData`.
  - **Middlewares** (`src/middleware/`): `auth` (autenticação JWT + revogação por `tokenVersion`), `rateLimit`, `routeLogger` (registro de acesso a rotas em arquivo e banco).
- **Serviço de dados de mercado**: provider unificado (`src/services/marketData.ts`) com Alpha Vantage como fonte primária e Yahoo Finance como fallback automático.
- **Persistência**: Prisma como ORM, schema central em `server/prisma/schema.prisma` com índices otimizados em `Transaction`, `FixedIncome` e `RouteLog`.
- **Modelo de cálculo**:
  - posição por ativo via **custo médio** (com proteção contra saldo negativo por vendas sem estoque);
  - dividendos automáticos por tabela central + dividendos manuais por usuário (normalizados com fuso UTC de início do dia);
  - renda fixa com juros compostos por período de vigência de taxa (`src/utils/fixedIncome.ts`);
  - **renda fixa e renda variável são calculadas e exibidas separadamente** — só o patrimônio é consolidado, o lucro/perda nunca se cruza.

## Tecnologias
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Recharts, React Router, Axios, Lucide Icons.
- **Backend**: Node.js, Express 5, TypeScript, Prisma 7, `@prisma/adapter-mariadb`, JWT, bcrypt, node-cron, express-rate-limit.
- **Banco**: MySQL.
- **Integrações externas**:
  - **Alpha Vantage** (primária): cotações, séries diárias e dividendos (BR `.SA` + US).
  - **Yahoo Finance** (fallback automático): cotações, séries diárias e dividendos quando Alpha Vantage atinge o limite diário ou falha.

## Principais funcionalidades
- Cadastro/login com JWT.
- Controle de perfil com **role** (`ADMIN`/`USER`) embutida no token.
- **Área de configurações do usuário**: alteração de nome, e-mail (com validação de unicidade) e senha (requer senha atual).
- **Dark mode** completo com persistência (toggle no header, respeita preferência do sistema, overrides CSS globais para alertas, badges e inputs).
- **Interface responsiva (mobile-first)**: header compacto com ações em ícones, menu lateral em overlay com trava de rolagem do corpo, cards que reorganizam de 1–2 colunas no celular até 4 no desktop, tabelas com rolagem horizontal própria, modais em formato *bottom sheet* no celular e gráficos com altura adaptativa. Validado sem estouro horizontal em 320px, 360px e 768px.
- **Sidebar expansível**: menu lateral com navegação entre Home, **Renda Variável**, **Renda Fixa**, Posições Fechadas, Lucro/Perda, Gerenciar Renda Fixa, Configurações + seção Admin (Dividendos Automáticos, Taxas, Logs de Auditoria) visível apenas para ADMIN. Os itens de RF e RV levam diretamente ao bloco correspondente da Home via âncora.
- Dashboard geral com patrimônio, L/P, dividendos e posições, dividido em blocos **expansíveis** de Renda Variável (`#renda-variavel`) e Renda Fixa (`#renda-fixa`), abertos por padrão e com a preferência de recolhimento salva no navegador.
- **Três gráficos de distribuição na Home**: renda variável por tipo (ACAO/FII/ETF/BDR), renda fixa por tipo (CDB/LCI/LCA/Tesouro/...) e total consolidado RF × RV.
- **Renda fixa completa**: investimentos com múltiplos aportes, indexadores (prefixado, % do CDI, Selic+, IPCA+), IR pela tabela regressiva por aporte, valor atual **líquido**, encerramento com conferência do valor recebido vs. estimado, e cadastro por formulário ou CSV.
- **Cadastro de taxas de referência** (admin) por formulário ou CSV: Selic em **% ao ano** e IPCA como **variação mensal** (aceita deflação), com CDI sempre derivado de `Selic - 0,10 p.p.`.
- Gráfico de dividendos com agrupamento por **dia** (mês atual, com "a receber" em azul claro), **mês** (ano atual) ou **ano** (todos).
- Ordenação de posições por ticker, PT e L/P.
- **Categorização automática de ativos**: ACAO, FII, ETF, BDR (detecção por padrão do ticker com badges visuais).
- **Página de posições fechadas**: exibe ativos onde a posição foi zerada com P/L realizado, dividendos recebidos e período.
- **Página de Lucro/Perda**: visão geral e por ação com P/L não-realizado (valorização), P/L realizado (vendas) e dividendos recebidos.
- Tela de detalhe por ação com:
  - PT, L/P da posição e P/L realizado (vendas),
  - histórico de movimentações com botão de exclusão,
  - tabela de dividendos com exclusão (manual para todos, auto para admin),
  - gráfico de evolução patrimonial e preço médio.
- Registro de compra/venda (global e inline na tela da ação).
- **Edição e exclusão de movimentações**: botões inline (lápis + lixeira) na tabela de transações e dividendos com modais de edição.
- Dividendos:
  - central por cota (`stock_dividends`),
  - manual por usuário (`user_dividends`),
  - cálculo automático por cotas na data-com.
  - regra automática: **data-ex = data-com + 1 dia** (centrais).
  - criação/edição/remoção de dividendos centrais restrita a **ADMIN**.
  - **Página admin dedicada** (`/admin/dividendos-automaticos`): lista completa com filtro, edição e exclusão.
  - edição de dividendos manuais pelo próprio usuário.
  - **CRON de sincronização de dividendos** via API externa.
- Importação de movimentações por CSV + download de modelo.
- Importação de dividendos centrais por CSV (admin) + download de modelo.
- Importação de **investimentos de renda fixa** por CSV + download de modelo.
- Importação de **taxas de referência** por CSV (admin) + download de modelo.
- **Duas CRONs automáticas**:
  - Sincronização de **preços** (Alpha Vantage → Yahoo fallback).
  - Sincronização de **dividendos** (Alpha Vantage → Yahoo fallback).
- **Sincronização manual de cotações do mês** (botão admin "Sync Mês" — Yahoo Finance com throttle de 2.5s/ticker).
- Compartilhamento de perfil (somente leitura):
  - geração de link + código de confirmação (6 caracteres alfanuméricos),
  - validade de 30 minutos,
  - confirmação do acesso pelo destinatário,
  - listagem de acessos recebidos e compartilhamentos enviados,
  - **cotações do banco de dados** (sem chamadas de API na área compartilhada),
  - **dividendos totais e por ano** no detalhe do ticker,
  - **L/P de vendas** (realizado) quando houver transações de venda.
- **Rate limiting por IP** (skip em localhost para desenvolvimento).
- **Logs de auditoria** (admin): registro de ações administrativas e execuções de CRONs com IP, usuário e detalhes.
- **IDs UUID** nas tabelas Transaction, StockDividend, UserDividend e ProfileShare (mais seguros em URLs).
- Suíte automatizada inicial no backend com **Vitest**.
