# 2) Funcionamento expandido

## Visão de módulos
- **Auth**: registro, login, refresh e usuário atual.
- **Transactions**: CRUD de movimentações + importação CSV.
- **Dividends**: dividendos centrais, manuais e cálculo consolidado.
- **Stocks**: busca de ativos, cotação, histórico e dividendos externos.
- **Dashboard**: resumo geral, dividendos agrupados (dia/mês/ano) e detalhe por ativo.
- **FixedIncome**: CRUD de investimentos de renda fixa, aportes, encerramento e importação CSV.
- **Rates**: cadastro admin de taxas de referência (Selic/IPCA) + importação CSV.
- **Shares**: compartilhamento de perfil read-only com confirmação por link+código.
- **AuditLogs**: visualização de logs administrativos (admin-only).
- **Market Data Service**: provider unificado (Alpha Vantage + Yahoo Finance fallback).

## Rotas da API (prefixo `/api`)

> [!NOTE]
> Para o mapeamento detalhado da cadeia de execução de middlewares, parâmetros exigidos, permissões de acesso e esquemas de resposta de cada endpoint, consulte a documentação completa em [`docs/05-rotas-e-middlewares.md`](file:///E:/git/saas/docs/05-rotas-e-middlewares.md).

### Health
- `GET /health` — status da API.

### Auth (`/auth`)
- `POST /register`
- `POST /login`
- `POST /refresh`
- `GET /me` (autenticado)
- `PUT /profile` (autenticado) — atualiza nome e/ou e-mail (com validação de unicidade)
- `PUT /password` (autenticado) — altera senha (requer senha atual, mín. 6 caracteres)

### Transactions (`/transactions`) *(todas autenticadas)*
- `GET /` — lista (filtros: `portfolioId`, `stockId`)
- `POST /` — cria movimentação
- `PUT /:id` — atualiza movimentação
- `DELETE /:id` — remove movimentação
- `POST /import-csv` — importa lote via CSV

### Dividends (`/dividends`) *(todas autenticadas)*
- `GET /stock-dividends` — lista dividendos centrais
- `POST /stock-dividends` — cria dividendo central (valor por cota, **ADMIN**)
- `PUT /stock-dividends/:id` — edita dividendo central (**ADMIN**, registra auditoria)
- `POST /stock-dividends/import-csv` — importa dividendos centrais por CSV (**ADMIN**)
- `DELETE /stock-dividends/:id` (**ADMIN**)
- `GET /manual` — lista dividendos manuais do usuário
- `POST /manual` — cria dividendo manual
- `PUT /manual/:id` — edita dividendo manual (próprio usuário)
- `DELETE /manual/:id`
- `GET /` — dividendos consolidados calculados (auto + manual)

### Stocks (`/stocks`) *(todas autenticadas)*
- `GET /search?q=...`
- `GET /:ticker/quote` — cotação atual (Alpha Vantage → Yahoo fallback) *(usado apenas por CRONs/sync, não pelo frontend)*
- `GET /:ticker/dividends-external` — dividendos de fontes externas (Alpha Vantage → Yahoo fallback)
- `GET /:ticker/history?days=30`
- `GET /` — ativos do usuário
- `GET /admin/api-usage` — uso atual da API Alpha Vantage (**ADMIN**)
- `POST /admin/sync-month` — sincroniza cotações do mês atual via Yahoo Finance (**ADMIN**, ~2.5s/ticker)

### Dashboard (`/dashboard`) *(todas autenticadas)*
- `GET /summary` — patrimônio consolidado com três blocos independentes:
  - `variableIncome`: `invested`, `currentValue`, `profit`, `profitPercent`, `dividends`, `byCategory`
  - `fixedIncome`: `invested`, `currentValue` (líquido), `unrealizedProfit`, `realizedProfit`, `byType`
  - `total`: apenas o **patrimônio** consolidado (`invested` + `currentValue`).
    O **lucro/perda de RF e RV nunca é somado** — cada classe mantém o seu.
- `GET /dividends-monthly`
- `GET /dividends-grouped?mode=day|month|year` — dividendos agrupados com received/pending
- `GET /movements` — lista consolidada de movimentações (compras, vendas e dividendos)
- `GET /stock/:ticker` ou `/stock-detail/:ticker` — detalhe da ação, movimentações e histórico
- `GET /stock/:ticker/evolution?range=day|month|year` — evolução temporal (cotação, valor patrimonial e preço médio)
- `GET /closed-positions` — posições fechadas (qty ≤ 0) com P/L realizado e dividendos
- `GET /pnl-overview` — visão de lucro/perda com blocos `variableIncome` (não-realizado,
  realizado e dividendos por ação) e `fixedIncome` (não-realizado e realizado por
  investimento), **sem cruzamento entre as classes**

### Fixed Income (`/fixed-income`) *(todas autenticadas)*
- `GET /` — lista os investimentos do usuário com projeção calculada e o resumo consolidado
- `POST /` — cria investimento com o primeiro aporte
- `POST /import-csv` — importação em lote (formato abaixo)
- `PUT /:id` — atualiza dados do investimento
- `PATCH /:id/settle` — encerra (com `settledAmount` e `settledDate`) ou reabre
- `POST /:id/contributions` — adiciona aporte
- `PUT /:id/contributions/:contributionId` — edita aporte
- `DELETE /:id/contributions/:contributionId` — exclui aporte
- `DELETE /:id` — exclui o investimento

### Rates (`/rates`)
- `GET /` — lista as taxas cadastradas *(autenticado)*
- `GET /current` — taxas vigentes: Selic (% a.a.), CDI derivado, IPCA do mês com
  `unit`, `annualized` e `accumulated12m` *(autenticado)*
- `POST /` — cria taxa *(ADMIN)*
- `POST /import-csv` — importação em lote com upsert por (tipo, data) *(ADMIN)*
- `PUT /:id` — atualiza taxa *(ADMIN)*
- `DELETE /:id` — exclui taxa *(ADMIN)*

### Shares (`/shares`) *(todas autenticadas)*
- `GET /incoming` — compartilhamentos que recebi
- `GET /outgoing` — compartilhamentos que enviei
- `POST /outgoing` — cria compartilhamento (`targetEmail`) e gera `confirmLink` + código
- `POST /confirm` — confirma compartilhamento com `token + code`
- `DELETE /:id` — revoga compartilhamento (owner ou target)
- `GET /:id/summary` — resumo do portfólio compartilhado (somente leitura)
- `GET /:id/dividends-monthly`
- `GET /:id/stock/:ticker`

### Audit Logs (`/audit-logs`) *(autenticado, ADMIN)*
- `GET /?page=1&limit=50` — lista logs paginados com dados do usuário

## Regras de negócio

### Carteira e posição
- Cada usuário recebe uma carteira padrão **Principal** no registro.
- Se não for informado `portfolioId` na criação de movimentação, usa a carteira padrão.
- Compra aumenta quantidade e custo investido; venda reduz posição proporcionalmente (modelo de custo médio).
- Apenas posições com quantidade > 0 entram no resumo do dashboard.

### Categorização automática de ativos
- Ao criar um stock, o sistema detecta a categoria automaticamente:
  - Termina em `34`, `35` ou `39` → **BDR**
  - 5+ chars terminando em `11` e presente em lista de ETFs conhecidos → **ETF**
  - 5+ chars terminando em `11` (demais) → **FII**
  - Restante → **ACAO**
- A lista de ETFs BR conhecidos está em `server/src/utils/stockCategory.ts`.
- No startup, `syncStockCategories()` recategoriza stocks existentes automaticamente.

### Mercado do ativo
- Detecção simplificada:
  - termina com número e até 6 caracteres → **BR**
  - caso contrário → **US**
- Ativo inexistente é criado automaticamente ao registrar movimentação/dividendo.

### Dividendos
- **Central**: valor por cota + ex/com/payment date; vale para todos os usuários.
- Somente usuário com role **ADMIN** pode criar/remover dividendos centrais.
- **Data-ex automática**: sempre calculada como `data-com + 1 dia` nos dividendos centrais.
- **Manual**: valor total individual, só impacta o próprio usuário.
- Cálculo automático usa quantidade de cotas na **data-com** para cada evento central.
- Retorno consolidado soma auto + manual e ordena por data de pagamento desc.

### Importação CSV de dividendos centrais
- Formato: `Ticker;Data-com;Data-pagamento;Tipo;Valor`
- Tipos aceitos: `DIVIDENDO`, `JCP`, `RENDIMENTO`
- Datas: `AAAA-MM-DD`
- A `data-ex` não é enviada no CSV; o backend calcula automaticamente (`data-com + 1 dia`).
- Linhas inválidas são retornadas em `errors`; linhas válidas são importadas.

### Importação CSV de movimentações
- Formato atual: `Ticker;Cotas;Operação;Valor p/ Cota;Data`
- Operações aceitas: `COMPRA|BUY` e `VENDA|SELL`
- Data esperada: `AAAA-MM-DD`
- Linhas inválidas retornam em `errors`; linhas válidas são importadas.

### Renda fixa — motor de cálculo (`server/src/utils/fixedIncome.ts`)

**Semântica das taxas de referência**

| Índice | Unidade cadastrada | Observação |
|--------|--------------------|------------|
| `SELIC` | **% ao ano** (ex.: `10.50`) | vigência a partir de `startDate` |
| `IPCA` | **variação do mês** (ex.: `0.45`, aceita negativo) | convenção IBGE/NTN-B; `startDate` = 1º dia do mês de referência |
| `CDI` | **não é cadastrado** | derivado sempre como `Selic - 0,10 p.p.` |

- Anualização do IPCA: `monthlyToAnnual(m) = ((1 + m/100)^12 - 1) × 100`.
- `accumulatedIpca(periods, 12, ref)` compõe as 12 variações mensais mais recentes
  (uso apenas para exibição).
- Limites de validação: Selic `0..100`; IPCA `-20..20` (permite deflação).

**Composição do rendimento por indexador**

| Tipo | Fórmula da taxa anual efetiva |
|------|-------------------------------|
| `PRE` | a própria taxa cadastrada no investimento |
| `CDI` | `(Selic - 0,10) × percentual/100` |
| `SELIC` | `Selic + spread` (**aditivo**, convenção Tesouro Selic) |
| `IPCA` | `((1 + ipca_anual/100) × (1 + spread/100) - 1) × 100` (**multiplicativo**, convenção NTN-B) |

- A capitalização é feita por trecho de vigência de cada taxa, com
  `fator = (1 + anual/100)^(dias/365)`. A base é limitada a `max(1e-9, 1 + anual/100)`
  para suportar deflação forte sem raiz de número negativo.
- Cada aporte capitaliza **a partir da sua própria data**; aportes futuros não rendem.

**Janela de accrual**

`resolveAccrualEnd()` = menor data entre **hoje**, o **vencimento** e a
**data de encerramento**. Assim, um investimento encerrado **para de render** na data
do encerramento (antes ele continuava rendendo até hoje — origem de inconsistências).

**Imposto de renda — duas alíquotas distintas**

- `currentTaxRate` / `currentTax`: faixa da tabela regressiva pelo prazo **decorrido**
  → usada para o **valor atual líquido** (`currentNetValue`), o que o usuário
  receberia se resgatasse hoje.
- `taxRate` / `projectedTax`: faixa pelo prazo até o **vencimento** → usada na
  projeção (`projectedNetValue`).
- `currentValue` **é o valor líquido** (antes expunha o bruto, o que inflava
  patrimônio e L/P). Investimentos isentos têm alíquota `0`.
- A alíquota do investimento é a **média ponderada** das alíquotas dos aportes.

**Encerramento e conferência**

- Ao encerrar, `currentValue` passa a ser o `settledAmount` efetivamente recebido e
  `realizedProfit = settledAmount - investido`.
- `expectedNetAtSettlement` guarda o líquido estimado na data do encerramento e
  `settlementDiff = settledAmount - expectedNetAtSettlement`, exibido na coluna
  "Estimado" para conferir divergências com a corretora.

**Separação RF × RV**

- O dashboard mantém blocos independentes; apenas o **patrimônio** é consolidado.
- Lucro/perda de renda fixa e de renda variável **não são somados** em nenhuma tela.

### Importação CSV de renda fixa
- Formato: `Nome;Tipo;Indexador;Taxa;Valor;Data-aporte;Vencimento;Isento`
- Tipos: `CDB`, `LCI`, `LCA`, `TESOURO`, `DEBENTURE`, `CRI`, `CRA`, `OUTRO`
- Indexadores: `PRE`, `CDI`, `SELIC`, `IPCA`
- Datas: `AAAA-MM-DD`; `Isento`: `SIM|NAO`
- Linhas com o **mesmo Nome + Vencimento** viram aportes do **mesmo investimento**.
  Se já existir investimento com esse nome e vencimento, os aportes são anexados.
- Linhas inválidas retornam em `errors`; as válidas são importadas.

### Importação CSV de taxas de referência (admin)
- Formato: `Tipo;Data-inicio;Taxa;Observacao`
- Tipos aceitos: `SELIC` e `IPCA` (CDI é rejeitado — sempre derivado)
- Upsert por **(tipo, data de início)**: taxa já cadastrada na mesma data é atualizada.
- Lembrete: para o IPCA, `Taxa` é a **variação do mês** (pode ser negativa) e
  `Data-inicio` é o **1º dia do mês** de referência.

### Provider de dados de mercado (Alpha Vantage + Yahoo Finance)

O sistema utiliza um provider unificado em `server/src/services/marketData.ts`:

| Função | Descrição |
|--------|-----------|
| `getQuote(ticker, market)` | Cotação atual |
| `getDailySeries(ticker, market)` | Série diária de preços |
| `getDividends(ticker, market)` | Anúncios de dividendos |
| `getAlphaUsageStats()` | Consumo diário da Alpha Vantage |

**Lógica de fallback:**
- Contador interno rastreia chamadas à Alpha Vantage (limite: 24/dia).
- Quando o limite é atingido ou Alpha retorna indicação de rate-limit (`Note`/`Information`), cai automaticamente para Yahoo Finance.
- Reset automático do contador à meia-noite.
- Yahoo Finance não requer API key, mas não fornece `paymentDate` para dividendos.

### Sincronização manual de cotações do mês (Admin)
- Endpoint: `POST /api/stocks/admin/sync-month`
- Busca via Yahoo Finance (`range: 1mo`) todas as barras diárias do mês atual para cada ticker com posição.
- Filtra apenas dias do mês/ano corrente e faz upsert em `stock_prices`.
- Throttle de **2.5 segundos** entre tickers para evitar bloqueio.
- Acessível via botão "Sync Cotações" no menu lateral (execução inline, sem página separada).
- Registra execução nos logs de auditoria (`SYNC_MONTH_PRICES`).

### Sincronização de preços (CRON)
- Job: `server/src/jobs/priceSync.ts`.
- Usa `getDailySeries()` (Alpha Vantage → Yahoo fallback).
- Grava/atualiza em `stock_prices` a barra diária mais recente.
- **Todas as páginas usam `currentPrice` vindo do banco** — nenhuma chamada de API externa é feita pelo frontend.

### Sincronização de dividendos (CRON)
- Job: `server/src/jobs/dividendSync.ts`.
- Usa `getDividends()` (Alpha Vantage → Yahoo fallback).
- Para cada ticker com posição ativa, busca anúncios de dividendos.
- Cria em `stock_dividends` apenas registros que não existam (dedup por exDate + amount).
- `comDate` = exDate - 1 dia.
- `paymentDate` = valor da API ou estimativa (+30 dias quando ausente).
- Tipo padrão: `DIVIDENDO`.

### Dividendos agrupados na Home
- Endpoint: `GET /dashboard/dividends-grouped?mode=day|month|year`
- **dia**: dias do mês atual; dividendos futuros marcados como `pending`.
- **mês**: 12 meses do ano atual.
- **ano**: todos os anos com registros.
- Gráfico de barras com toggle; modo "dia" exibe barra azul claro para "a receber".

### Compartilhamento de perfil (read-only)
- O owner gera um compartilhamento para um email existente no sistema.
- O sistema gera:
  - `token` (link),
  - `confirmationCode` (6 chars alfanuméricos),
  - `expiresAt` (30 min).
- Estados: `PENDING`, `AUTHORIZED`, `REVOKED`, `EXPIRED`.
- O destinatário confirma com token + código.
- Após autorizado, pode visualizar o portfólio do owner em rotas `/shared/...` no frontend sem permissão de escrita.
- **Cotações na área compartilhada** são lidas do banco de dados (tabela `stock_prices`), sem chamadas a APIs externas.

## Validações e segurança

### Rate Limiting
- **Auth routes** (`/api/auth`): máx 50 req/15min por IP.
- **API geral** (`/api`): máx 300 req/min por IP.
- **Localhost é isento** (skip automático para desenvolvimento local).
- Pacote: `express-rate-limit`.

### Logs de Auditoria
- Modelo `AuditLog`: userId (nullable), action, entity, entityId, details, ip, createdAt.
- `userId = null` → ação do sistema (CRONs); exibido como "Sistema" na UI.
- Ações logadas:
  - Criação, edição e remoção de dividendos centrais (userId do admin).
  - `SYNC_MONTH_PRICES` — sincronização manual do mês (userId do admin).
  - `CRON_PRICE_SYNC` — execução da CRON de preços (sistema).
  - `CRON_DIVIDEND_SYNC` — execução da CRON de dividendos (sistema).
- Visualização na UI: `/audit-logs` (admin-only, paginado).

### Segurança
- Middleware JWT (`Authorization: Bearer <token>`) em todas as rotas protegidas.
- Senha armazenada com hash **bcrypt**.
- CORS restrito para `http://localhost:5173` (ambiente dev atual).
- Check de propriedade por `userId` para update/delete de transações e dividendos manuais.
- Check de role para operações administrativas de dividendos centrais.
- Check de acesso por `targetUserId` + status autorizado para leitura de compartilhamentos.
- **IDs UUID (v4)** nas tabelas Transaction, StockDividend, UserDividend e ProfileShare — evita enumeração sequencial.

### Validações principais
- Campos obrigatórios por endpoint (ex.: `ticker`, `type`, `quantity`, `price`, `date`).
- Enum de operação (`BUY/SELL`) e tipo de dividendo (`DIVIDENDO/JCP/RENDIMENTO`).
- Conversão/normalização de ticker para uppercase.
- Conversão de datas com `new Date(...)`.

## Frontend (fluxo funcional)
- **AppLayout** (componente global): header (nav) com logo, "Nova Movimentação", toggle dark mode, nome do usuário (link para `/settings`) e botão "Sair". Sidebar expansível embutida.
- **ThemeContext** gerencia dark/light mode com persistência em localStorage.
- **AuthContext** gerencia sessão e refresh token.
- **Sidebar expansível** com navegação: Home, **Renda Variável** (`/#renda-variavel`), **Renda Fixa** (`/#renda-fixa`), Posições Fechadas, Lucro/Perda, **Gerenciar Renda Fixa** (`/renda-fixa`), Configurações + seção Admin (Dividendos, Taxas, Sync Cotações, Logs de Auditoria) visível apenas para admins. O item ativo é detectado também pelo **hash** da URL.
- **Nav e menu presentes em todas as páginas** (via AppLayout no ProtectedRoute).
- Dashboard (Home) exibe, **simultaneamente e sem abas**, dois blocos ancorados:
  - `#renda-variavel`: cards da classe, posições e dividendos;
  - `#renda-fixa`: cards da classe e tabela dos investimentos ativos inline.
  - Ambos os blocos são **expansíveis/recolhíveis**: o cabeçalho de cada um é um botão
    (`aria-expanded` + `aria-controls`) e a preferência é persistida em `localStorage`
    na chave `dashboard:sections` (`{ rv: boolean, rf: boolean }`, padrão expandido).
    Navegar para `/#renda-variavel` ou `/#renda-fixa` (menu lateral ou cards do topo)
    **reabre automaticamente** o bloco de destino antes de rolar até ele.
  - Os valores dos cards usam fonte adaptativa (`valueSizeClass`): números muito longos
    reduzem o corpo do texto em vez de quebrar no meio ou vazar do cartão.
  - Três gráficos de pizza: **RV por tipo** (ACAO/FII/ETF/BDR), **RF por tipo**
    (CDB/LCI/LCA/Tesouro/...) e **distribuição total RF × RV**.
  - As âncoras usam `scroll-mt-24` e um efeito de scroll suave ao mudar o hash.
- Gráficos Recharts adaptados a dark mode (cores de grid, eixos e tooltip).
- Tabela de posições exibe badges de categoria (FII, ETF, BDR).
- Tela de ticker agrega posição, histórico (com edição/exclusão), dividendos (com edição/exclusão) e formulário inline. **Cotação vem exclusivamente do banco de dados.**
- **Página admin de dividendos automáticos** (`/admin/dividendos-automaticos`): lista todos os dividendos centrais com filtro por ticker, edição (modal) e exclusão. Acesso restrito a ADMIN.
- **Sync Cotações (botão no sidebar)**: ao clicar em "Sync Cotações" na seção Admin do menu lateral, executa a sincronização do mês inline (sem navegar para outra página). Exibe resultado/erro diretamente no sidebar.
- **Página de posições fechadas** (`/closed-positions`): tabela com ativos zerados, P/L realizado e dividendos.
- **Página de Lucro/Perda** (`/pnl`): toggle geral/por ação com P/L não-realizado, realizado e dividendos, em **seções separadas de Renda Variável e Renda Fixa** (os resultados das duas classes não se somam).
- **Página de configurações** (`/settings`): alteração de nome, e-mail e senha.
- **Página de renda fixa** (`/renda-fixa`): cards com valores **líquidos**, IR de hoje vs. IR no vencimento, coluna "Estimado" comparando o recebido com o esperado no encerramento, e exibição do IPCA do mês + acumulado 12 meses.
- Página de nova movimentação organizada em **4 categorias** (botões de topo) com sub-abas:
  - **Compra / Venda**: "Registrar" (formulário de compra/venda) e "Importar CSV" (movimentações);
  - **Dividendo**: para **admin**, "Dividendo (por cota)" vem selecionado por padrão, seguido de "Dividendo Manual" e "Importar CSV" (dividendos centrais); para **usuário comum**, apenas "Dividendo Manual" (default);
  - **Renda Fixa**: "Registrar" (investimento + primeiro aporte) e "Importar CSV" com download de modelo;
  - **Taxas (Selic/IPCA)** *(admin)*: "Registrar" e "Importar CSV" com download de modelo. O formulário adapta rótulos e ajuda conforme o tipo (Selic = % a.a.; IPCA = variação do mês, aceita negativo, data no 1º dia do mês).
- Sidebar da Home inclui gestão de compartilhamentos:
  - acessos recebidos,
  - compartilhamentos enviados,
  - criação e revogação.
- Fluxo de confirmação em `/share/confirm`.
- Visualização compartilhada read-only em:
  - `/shared/:shareId`
  - `/shared/:shareId/stock/:ticker` — inclui: L/P não realizado, L/P de vendas (se houver), dividendos totais, dividendos por ano e tabela de dividendos recebidos.
- Página de auditoria: `/audit-logs` (admin-only).
- Dark mode com overrides CSS globais para alertas, badges, inputs, hovers e charts.

### Responsividade (mobile-first)

O Tailwind é usado em modo mobile-first: as classes sem prefixo valem para o celular e
`sm:` / `md:` / `lg:` ampliam o layout em telas maiores. Convenções adotadas:

| Elemento | Mobile | Desktop |
|----------|--------|---------|
| Container de página | `px-3 py-4` | `sm:px-6 sm:py-8` |
| Cards de métrica | 1 coluna abaixo de 430px, 2 acima (`grid-cols-1 min-[430px]:grid-cols-2`) | `2xl:grid-cols-4` |
| Valores monetários nos cards | `valueSizeClass()` reduz o corpo do texto quando o número é longo; `break-words` como rede de segurança | idem |
| Padding de card/formulário | `p-4` | `sm:p-6` |
| Tabelas | `overflow-x-auto` + `min-w-[...]` na `<table>` (rolagem horizontal em vez de espremer) | largura natural |
| Modais | *bottom sheet* (`items-end`, `rounded-t-2xl`, `max-h-[90vh] overflow-y-auto`) | centralizado (`sm:items-center`, `sm:rounded-xl`) |
| Abas / filtros | faixa rolável (`overflow-x-auto` + `whitespace-nowrap shrink-0`) | linha normal |
| Gráficos | wrapper com altura (`h-64`) + `ResponsiveContainer height="100%"` | `sm:h-72` |
| Títulos | `text-2xl` | `sm:text-3xl` |

Detalhes do shell e do CSS global (`client/src/index.css`):
- **Header**: em telas pequenas, "Nova Movimentação", tema, perfil e sair viram botões de
  ícone de 40×40 com `aria-label`; o texto reaparece a partir de `sm:`.
- **Sidebar**: largura `w-[85vw] max-w-[18rem]` no celular, overlay em qualquer breakpoint,
  navegação com `overflow-y-auto` e **trava de rolagem do body** enquanto está aberta.
- **CSS global**: `overflow-x: clip` em `html/body` como rede de segurança contra estouro
  horizontal; inputs com `font-size: 16px` até 640px (evita o zoom automático do iOS);
  alvos de toque com altura mínima de 40px (36px dentro de tabelas);
  `-webkit-tap-highlight-color: transparent` e `max-width: 100%` em `img/svg/canvas`.
- Os gráficos de pizza da Home exibem o **percentual dentro da fatia** e uma **legenda**,
  em vez de rótulos externos que eram cortados em telas estreitas.
- Os blocos **Renda Variável** e **Renda Fixa** da Home podem ser recolhidos para encurtar
  a rolagem no celular; o estado fica salvo em `localStorage` (`dashboard:sections`).
