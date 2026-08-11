export interface User {
  id: number;
  name: string;
  email: string;
  role?: 'USER' | 'ADMIN';
  createdAt?: string;
}

export interface Stock {
  id: number;
  ticker: string;
  name: string;
  market: 'BR' | 'US';
  sector?: string;
}

export interface Transaction {
  id: string;
  userId: number;
  portfolioId: number;
  stockId: number;
  type: 'BUY' | 'SELL';
  quantity: string;
  price: string;
  fees: string;
  date: string;
  notes?: string;
  createdAt: string;
  stock: Stock;
  portfolio?: { id: number; name: string };
}

export interface CalculatedDividend {
  source: 'auto' | 'manual';
  ticker: string;
  stockName: string;
  amountPerShare: number;
  sharesHeld: number;
  totalAmount: number;
  exDate: string;
  comDate: string;
  paymentDate: string;
  type: 'DIVIDENDO' | 'JCP' | 'RENDIMENTO';
  notes?: string;
  id?: string;
}

export interface DividendsResponse {
  dividends: CalculatedDividend[];
  totalAmount: number;
}

export interface StockPosition {
  stockId: number;
  ticker: string;
  name: string;
  market: string;
  category: string;
  quantity: number;
  totalInvested: number;
  averagePrice: number;
  currentPrice: number;
  previousClose: number;
  changePercent: number;
  lastPriceDate: string | null;
}

export interface FixedIncomeContributionProjection {
  id: string;
  amount: number;
  date: string;
  notes?: string | null;
  createdAt: string;
  currentGrossValue: number;
  currentTax: number;
  currentTaxRate: number;
  currentNetValue: number;
  projectedGrossValue: number;
  projectedNetValue: number;
  projectedTax: number;
  taxRate: number;
  days: number;
  daysElapsed: number;
}

export interface FixedIncomeProjection {
  investedAmount: number;
  firstContributionDate: string | null;
  currentGrossValue: number;
  currentTax: number;
  currentNetValue: number;
  currentGrossProfit: number;
  currentNetProfit: number;
  currentTaxRate: number;
  projectedGrossValue: number;
  projectedNetValue: number;
  projectedGrossProfit: number;
  projectedNetProfit: number;
  projectedTax: number;
  taxRate: number;
  effectiveAnnualRate: number;
  daysTotal: number;
  daysElapsed: number;
  currentValue: number;
  settled: boolean;
  realizedProfit: number | null;
  expectedNetAtSettlement: number | null;
  settlementDiff: number | null;
  matured: boolean;
}

export type FixedIncomeYieldType = 'PRE' | 'CDI' | 'SELIC' | 'IPCA';

export interface FixedIncome {
  id: string;
  name: string;
  investmentType: string;
  yieldType: FixedIncomeYieldType;
  rate: number;
  investedAmount: number;
  purchaseDate: string | null;
  maturityDate: string;
  taxExempt: boolean;
  settledAmount: number | null;
  settledDate: string | null;
  notes?: string | null;
  createdAt: string;
  contributions: FixedIncomeContributionProjection[];
  projection: FixedIncomeProjection;
}

export interface FixedIncomeTypeBreakdown {
  type: string;
  invested: number;
  currentValue: number;
}

export interface FixedIncomeSummary {
  invested: number;
  currentGrossValue: number;
  /** Líquido de um resgate hoje (bruto - IR do prazo decorrido). */
  currentValue: number;
  currentTax: number;
  unrealizedProfit: number;
  projectedNetValue: number;
  projectedProfit: number;
  projectedTax?: number;
  settledInvested: number;
  settledTotal: number;
  settledTax?: number;
  realizedProfit: number;
  activeCount: number;
  totalCount: number;
  byType: FixedIncomeTypeBreakdown[];
}

export interface VariableIncomeCategoryBreakdown {
  category: string;
  invested: number;
  currentValue: number;
}

export interface VariableIncomeSummary {
  invested: number;
  currentValue: number;
  unrealizedProfit: number;
  totalDividends: number;
  positionsCount: number;
  byCategory: VariableIncomeCategoryBreakdown[];
}

export interface RateIndex {
  id: number;
  type: 'SELIC' | 'IPCA';
  /** SELIC: % ao ano. IPCA: variação do mês (pode ser negativa). */
  rate: string | number;
  startDate: string;
  notes?: string | null;
  createdAt: string;
}

export interface CurrentRate {
  rate: number;
  startDate: string;
  derived?: boolean;
  unit: 'ANNUAL' | 'MONTHLY';
  annualized?: number;
  accumulated12m?: number;
}

export interface DashboardSummary {
  totalInvested: number;
  totalDividends: number;
  positions: StockPosition[];
  totalStocks: number;
  variableIncome?: VariableIncomeSummary;
  fixedIncome?: FixedIncomeSummary;
  totalInvestedWithFixedIncome?: number;
  total?: { invested: number; currentValue: number };
}

export interface StockQuote {
  ticker: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  market: string;
}

export interface StockDetail {
  stock: Stock;
  position: {
    quantity: number;
    totalInvested: number;
    averagePrice: number;
    currentPrice: number;
    totalDividends?: number;
  };
  totalDividends?: number;
  dividendsByYear?: Record<string, number>;
  dividendPerShareByYear?: Record<string, number>;
  realizedPnL?: number;
  transactions: Transaction[];
  dividends: CalculatedDividend[];
}

export interface MonthlyDividend {
  month: string;
  total: number;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface ProfileShare {
  id: string;
  ownerUserId: number;
  targetUserId: number;
  token: string;
  confirmationCode: string;
  status: 'PENDING' | 'AUTHORIZED' | 'REVOKED' | 'EXPIRED';
  expiresAt: string;
  authorizedAt?: string;
  revokedAt?: string;
  createdAt: string;
  confirmLink?: string;
  ownerUser?: Pick<User, 'id' | 'name' | 'email'>;
  targetUser?: Pick<User, 'id' | 'name' | 'email'>;
}

export interface SharedDashboardSummary extends DashboardSummary {
  owner: Pick<User, 'id' | 'name' | 'email'>;
}
