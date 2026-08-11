# StockSaaS - Gestão de Carteira de Ações

SaaS para acompanhamento de carteira de ações com dashboards de lucro/perda, dividendos e histórico de movimentações.

## Stack

- **Frontend:** React 19 + Vite + TypeScript + Tailwind CSS v4 + Recharts
- **Backend:** Node.js + Express 5 + TypeScript + Prisma 7
- **Banco de Dados:** MySQL
- **APIs de mercado:** Alpha Vantage (primária) + Yahoo Finance (fallback automático)

## Pré-requisitos

- Node.js 18+
- MySQL 8+
- Chave de API: [Alpha Vantage](https://www.alphavantage.co/support/#api-key) (cotações e dividendos)

## Setup

### 1. Banco de Dados

Crie um banco MySQL:

```sql
CREATE DATABASE stock_saas;
```

### 2. Backend

```bash
cd server
cp .env .env.local   # Edite com suas credenciais
npm install
npx prisma generate
npx prisma db push   # Cria as tabelas
npm run dev
```

### 3. Frontend

```bash
cd client
npm install
npm run dev
```

O app estará disponível em `http://localhost:5173`

## Variáveis de Ambiente (server/.env)

```env
DATABASE_URL="mysql://user:password@localhost:3306/stock_saas"
JWT_SECRET="sua-chave-secreta"
JWT_REFRESH_SECRET="sua-chave-refresh"
ALPHA_VANTAGE_KEY="sua-chave-alpha-vantage"

# CRON - Sincronização de preços
PRICE_SYNC_CRON="15 22 * * 1-5"
PRICE_SYNC_TIMEZONE="America/Sao_Paulo"
PRICE_SYNC_STARTUP="false"

# CRON - Sincronização de dividendos
DIVIDEND_SYNC_CRON="0 23 * * 1-5"
DIVIDEND_SYNC_TIMEZONE="America/Sao_Paulo"
DIVIDEND_SYNC_STARTUP="false"
```

## CRONs automáticas

O backend inicia duas CRONs automaticamente ao subir:

| Job                     | Descrição                         | Horário padrão |
| ----------------------- | ----------------------------------- | ---------------- |
| **Price Sync**    | Sincroniza cotações de fechamento | 22:15 seg-sex    |
| **Dividend Sync** | Busca novos anúncios de dividendos | 23:00 seg-sex    |

Ambos utilizam Alpha Vantage como fonte primária e Yahoo Finance como fallback quando o limite diário é atingido.

## Funcionalidades

- ✅ Login e registro de usuários (JWT)
- ✅ Dashboard com patrimônio total, lucro/perda, dividendos
- ✅ Gráfico de dividendos agrupados por dia/mês/ano
- ✅ Tabela de posições com cotações diárias sincronizadas por CRON
- ✅ Categorização automática: ACAO, FII, ETF, BDR (com badges)
- ✅ Dark mode completo (toggle + preferência do sistema + overrides CSS)
- ✅ Interface responsiva mobile-first (header compacto, menu em overlay, tabelas com
  rolagem própria, modais em *bottom sheet*, gráficos adaptativos — validado em 320/360/768px)
- ✅ Detalhe por ação (histórico, dividendos, evolução)
- ✅ Registro de compras, vendas e dividendos
- ✅ Edição e exclusão de movimentações e dividendos (com confirmação)
- ✅ Importador CSV de movimentações (compra/venda)
- ✅ Importador CSV de dividendos centrais (admin)
- ✅ Suporte a ações brasileiras (B3) e internacionais (NYSE/NASDAQ)
- ✅ Dual-source market data (Alpha Vantage + Yahoo Finance fallback)
- ✅ CRON de sincronização de dividendos via API
- ✅ Compartilhamento de portfólio (read-only com confirmação, cotações do banco)
- ✅ Rate limiting por IP (skip em localhost)
- ✅ Logs de auditoria (admin + sistema/CRONs)
- ✅ Sidebar expansível (Home, Posições Fechadas, Lucro/Perda, Configurações + seção Admin)
- ✅ Página de posições fechadas (P/L realizado + dividendos)
- ✅ Página de Lucro/Perda geral e por ação (não-realizado + realizado + dividendos)
- ✅ Área de configurações do usuário (nome, e-mail, senha)
- ✅ Painel admin de dividendos automáticos (`/admin/dividendos-automaticos`)
- ✅ Sync manual de cotações do mês (botão inline no sidebar, Yahoo Finance)
- ✅ IDs UUID nas tabelas de movimentações e dividendos
- ✅ Renda fixa (`/renda-fixa`): CDB, LCI/LCA, Tesouro, debêntures, CRI/CRA
  - Tipos de rendimento: prefixado, % do CDI, Selic + spread e IPCA + spread
  - **Múltiplos aportes por investimento**, com adicionar/editar/excluir aportes
  - Alíquota de IR calculada por aporte (prazo individual até o vencimento) e
    alíquota média ponderada no total do investimento
  - Projeção de retorno com juros compostos por período de vigência de cada taxa
  - Checkbox de isenção de IR e tabela regressiva (22,5% → 15%) quando tributado
  - **Valor atual sempre líquido**: o valor exibido já desconta o IR da faixa do
    prazo **decorrido**, enquanto a projeção usa a faixa do prazo até o vencimento
  - **Rendimento congela na data de encerramento** (não continua rendendo até hoje)
  - Encerramento com ajuste do valor efetivamente recebido, com coluna comparando
    o recebido vs. o estimado (`settlementDiff`), e reabertura
  - **Cadastro por formulário e por CSV** em "Nova Movimentação"
  - Totais somados ao patrimônio; **lucro/perda de RF e RV nunca se cruzam**
- ✅ Cadastro admin de taxas de referência (`/admin/taxas`): tipo (Selic/IPCA),
  data de início da vigência e importação por CSV. O CDI não é cadastrado — é sempre
  derivado automaticamente como **Selic - 0,10 p.p.**
  - **Selic**: percentual **ao ano** (ex.: `10.50`)
  - **IPCA**: variação **do mês** conforme divulgação do IBGE, aceitando valores
    negativos em caso de deflação (ex.: `0.45` ou `-0.10`), com data de início no
    **1º dia do mês de referência**. O sistema anualiza compondo 12 meses
    (`(1+m/100)^12 - 1`) e exibe também o acumulado de 12 meses
  - **IPCA+ é multiplicativo** (convenção NTN-B):
    `((1 + ipca_anual) × (1 + spread) - 1)`; **Selic+ é aditivo**
- ✅ Home com blocos **expansíveis** de **Renda Variável** e **Renda Fixa** (âncoras
  `#renda-variavel` e `#renda-fixa` acessíveis pelo menu lateral; abertos por padrão e
  com a preferência de recolhimento salva no navegador), com gráficos de
  RV por tipo, RF por tipo e distribuição total RF × RV
- ✅ Dividendos por cota em cada ano no detalhe do ticker (ao lado do gráfico de proventos)

## Documentação

- `docs/01-funcionamento-resumido.md` — Visão geral e funcionalidades
- `docs/02-funcionamento-expandido.md` — Arquitetura, regras de negócio e estrutura do projeto
- `docs/03-desenvolvimento.md` — Setup, ambiente de testes e convenções de código
- `docs/04-logs-e-auditoria.md` — Log de acesso a rotas (`routes.log` e DB) e auditoria de ações
- `docs/05-rotas-e-middlewares.md` — Mapeamento completo de todas as rotas da API REST e cadeia de middlewares
- `docs/06-build-dev-producao.md` — Guia de compilação, execução em desenvolvimento e implantação em produção (PM2 + Nginx)
- `mudancas.txt` — Histórico detalhado de alterações de código e banco de dados

## Disclaimer

Este projeto está sendo desenvolvido puramente por meio de propmts repassados a IA e está sujeito a erros e vulnerabilidades.

Trata-se de um projeto de estudo e **não deve ser utilizado comercialmente**.