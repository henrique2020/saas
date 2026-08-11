/**
 * Motor de cálculo de renda fixa.
 *
 * O rendimento é acumulado por períodos de vigência das taxas cadastradas
 * (Selic / IPCA / CDI), aplicando juros compostos pro rata sobre o número de
 * dias corridos de cada período. Para o trecho futuro (entre hoje e o
 * vencimento) é usada a última taxa vigente.
 *
 * Um investimento pode ter vários aportes: cada aporte capitaliza a partir da
 * sua própria data e tem o IR calculado pelo seu prazo individual, conforme a
 * tabela regressiva.
 *
 * Convenções das taxas cadastradas (`RateIndex`):
 *   SELIC -> percentual ao ano (meta Selic vigente a partir de `startDate`)
 *   IPCA  -> variação PERCENTUAL DO MÊS divulgada pelo IBGE (pode ser negativa
 *            em meses de deflação). O motor anualiza compondo 12 meses.
 *   CDI   -> nunca é cadastrado, é derivado como Selic - 0,10 p.p.
 */

export type YieldType = 'PRE' | 'CDI' | 'SELIC' | 'IPCA';

/** Spread fixo entre Selic e CDI: o CDI é sempre derivado como Selic - 0,10 p.p. */
export const CDI_SELIC_SPREAD = 0.1;

export interface RatePeriod {
  type: string;
  rate: number;
  startDate: Date;
}

export interface Contribution {
  amount: number;
  date: Date;
}

export interface FixedIncomeInput {
  yieldType: string;
  /** Prefixado: % a.a. | CDI: % do CDI | Selic/IPCA: spread em p.p. a.a. */
  rate: number;
  /** Aportes do investimento. Cada um capitaliza a partir da sua própria data. */
  contributions: Contribution[];
  maturityDate: Date;
  taxExempt: boolean;
  settledAmount?: number | null;
  settledDate?: Date | null;
}

/** Projeção individual de um aporte. */
export interface ContributionProjection {
  amount: number;
  date: Date;
  /** Valor bruto acumulado até a data corrente (hoje / encerramento / vencimento). */
  currentGrossValue: number;
  /** IR que incidiria se o resgate acontecesse na data corrente. */
  currentTax: number;
  /** Alíquota de IR pelo prazo já decorrido (0 se isento). */
  currentTaxRate: number;
  /** Valor líquido se resgatado na data corrente. */
  currentNetValue: number;
  projectedGrossValue: number;
  projectedNetValue: number;
  projectedTax: number;
  /** Alíquota de IR pelo prazo até o vencimento (0 se isento). */
  taxRate: number;
  /** Dias do aporte até o vencimento. */
  days: number;
  /** Dias do aporte até a data corrente. */
  daysElapsed: number;
}

export interface FixedIncomeProjection {
  /** Soma dos aportes. */
  investedAmount: number;
  /** Data do primeiro aporte. */
  firstContributionDate: Date | null;
  /** Valor bruto acumulado até hoje (ou até o encerramento/vencimento). */
  currentGrossValue: number;
  /** IR que incidiria num resgate na data corrente. */
  currentTax: number;
  /** Valor líquido de um resgate na data corrente. */
  currentNetValue: number;
  /** Rendimento bruto acumulado até a data corrente. */
  currentGrossProfit: number;
  /** Rendimento líquido acumulado até a data corrente (após IR do prazo decorrido). */
  currentNetProfit: number;
  /** Alíquota média ponderada de IR na data corrente (0 se isento). */
  currentTaxRate: number;
  /** Valor bruto previsto no vencimento. */
  projectedGrossValue: number;
  /** Valor líquido previsto no vencimento (após IR). */
  projectedNetValue: number;
  /** Rendimento bruto previsto no vencimento. */
  projectedGrossProfit: number;
  /** Rendimento líquido previsto no vencimento. */
  projectedNetProfit: number;
  /** IR previsto no vencimento (somado por aporte). */
  projectedTax: number;
  /** Alíquota média ponderada de IR no vencimento (0 se isento). */
  taxRate: number;
  /** Taxa efetiva anual média ponderada usada na projeção (% a.a.). */
  effectiveAnnualRate: number;
  /** Prazo do primeiro aporte até o vencimento. */
  daysTotal: number;
  daysElapsed: number;
  /** Valor considerado como posição atual: encerrado usa o valor recebido. */
  currentValue: number;
  settled: boolean;
  /** Rendimento realizado (apenas quando encerrado). */
  realizedProfit: number | null;
  /** Líquido estimado pelo motor na data de encerramento (só quando encerrado). */
  expectedNetAtSettlement: number | null;
  /**
   * Diferença entre o valor efetivamente recebido e o líquido estimado para a
   * data de encerramento. Positivo = recebeu mais que o previsto.
   */
  settlementDiff: number | null;
  matured: boolean;
  /** Detalhe por aporte. */
  contributions: ContributionProjection[];
}

const MS_PER_DAY = 86_400_000;
const DAYS_PER_YEAR = 365;
const MONTHS_PER_YEAR = 12;

/** Diferença em dias corridos entre duas datas (mínimo 0). */
export function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.max(0, Math.round((b - a) / MS_PER_DAY));
}

/** Tabela regressiva de IR para renda fixa. */
export function getIncomeTaxRate(days: number): number {
  if (days <= 180) return 0.225;
  if (days <= 360) return 0.2;
  if (days <= 720) return 0.175;
  return 0.15;
}

/** Taxa vigente de um índice em uma data (a mais recente com início <= data). */
export function getRateAt(periods: RatePeriod[], type: string, date: Date): number | null {
  const candidates = periods
    .filter((p) => p.type === type && p.startDate.getTime() <= date.getTime())
    .sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
  if (candidates.length > 0) return candidates[0].rate;

  // Sem taxa anterior à data: usa a mais antiga cadastrada como aproximação.
  const earliest = periods
    .filter((p) => p.type === type)
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())[0];
  return earliest ? earliest.rate : null;
}

/**
 * Anualiza uma variação mensal compondo 12 meses.
 * Ex.: 0,45% no mês -> ((1,0045)^12 - 1) * 100 ≈ 5,54% a.a.
 * Aceita valores negativos (deflação).
 */
export function monthlyToAnnual(monthlyPercent: number): number {
  return (Math.pow(1 + monthlyPercent / 100, MONTHS_PER_YEAR) - 1) * 100;
}

/**
 * IPCA acumulado numa janela de meses, a partir das variações mensais
 * cadastradas (da mais recente para trás). Usado apenas para exibição.
 */
export function accumulatedIpca(
  periods: RatePeriod[],
  months = 12,
  reference: Date = new Date()
): number | null {
  const monthly = periods
    .filter((p) => p.type === 'IPCA' && p.startDate.getTime() <= reference.getTime())
    .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())
    .slice(0, months);

  if (monthly.length === 0) return null;
  const factor = monthly.reduce((acc, p) => acc * (1 + p.rate / 100), 1);
  return (factor - 1) * 100;
}

/**
 * Converte a taxa de referência vigente na taxa anual efetiva do investimento.
 * Retorna null quando o índice necessário não possui taxa cadastrada.
 *
 * - PRE:   a própria taxa.
 * - CDI:   percentual aplicado sobre o CDI derivado da Selic.
 * - SELIC: Selic + spread (convenção aditiva do Tesouro Selic).
 * - IPCA:  (1 + IPCA anualizado) * (1 + spread) - 1, convenção multiplicativa
 *          das NTN-B / CDBs "IPCA+". O IPCA cadastrado é a variação mensal.
 */
export function resolveAnnualRate(
  yieldType: string,
  rate: number,
  periods: RatePeriod[],
  date: Date
): number | null {
  switch (yieldType) {
    case 'PRE':
      return rate;
    case 'CDI': {
      // O CDI nunca é cadastrado: é sempre derivado da Selic (CDI ≈ Selic - 0,10 p.p.).
      const selic = getRateAt(periods, 'SELIC', date);
      if (selic === null) return null;
      const cdi = Math.max(0, selic - CDI_SELIC_SPREAD);
      return (cdi * rate) / 100;
    }
    case 'SELIC': {
      const selic = getRateAt(periods, 'SELIC', date);
      return selic === null ? null : selic + rate;
    }
    case 'IPCA': {
      const monthly = getRateAt(periods, 'IPCA', date);
      if (monthly === null) return null;
      const annualIpca = monthlyToAnnual(monthly);
      return ((1 + annualIpca / 100) * (1 + rate / 100) - 1) * 100;
    }
    default:
      return null;
  }
}

/** Datas de virada de taxa relevantes para o investimento, dentro do intervalo. */
function boundaries(periods: RatePeriod[], yieldType: string, from: Date, to: Date): Date[] {
  const relevant: string[] = yieldType === 'CDI' ? ['SELIC'] : [yieldType];
  const dates = periods
    .filter((p) => relevant.includes(p.type))
    .map((p) => p.startDate)
    .filter((d) => d.getTime() > from.getTime() && d.getTime() < to.getTime())
    .sort((a, b) => a.getTime() - b.getTime());

  const unique: Date[] = [];
  for (const d of dates) {
    if (!unique.some((u) => u.getTime() === d.getTime())) unique.push(d);
  }
  return unique;
}

/**
 * Fator de capitalização composto entre duas datas, respeitando as viradas de taxa.
 * Taxas negativas (deflação em papéis IPCA+ com spread baixo) reduzem o fator.
 */
function compoundFactor(
  input: Pick<FixedIncomeInput, 'yieldType' | 'rate'>,
  periods: RatePeriod[],
  from: Date,
  to: Date
): number {
  const totalDays = daysBetween(from, to);
  if (totalDays <= 0) return 1;

  const marks = [from, ...boundaries(periods, input.yieldType, from, to), to];
  let factor = 1;

  for (let i = 0; i < marks.length - 1; i++) {
    const segStart = marks[i];
    const segEnd = marks[i + 1];
    const segDays = daysBetween(segStart, segEnd);
    if (segDays <= 0) continue;

    const annual = resolveAnnualRate(input.yieldType, input.rate, periods, segStart) ?? 0;
    // Um fator base <= 0 não tem raiz real: trava próximo de -100% a.a.
    const base = Math.max(1e-9, 1 + annual / 100);
    factor *= Math.pow(base, segDays / DAYS_PER_YEAR);
  }

  return factor;
}

/**
 * Data em que o rendimento para de ser acumulado: o menor entre hoje,
 * o vencimento e (quando encerrado) a data de encerramento.
 */
function resolveAccrualEnd(input: FixedIncomeInput, now: Date): Date {
  let end = now.getTime() < input.maturityDate.getTime() ? now : input.maturityDate;
  if (input.settledDate && input.settledDate.getTime() < end.getTime()) {
    end = input.settledDate;
  }
  return end;
}

export function calculateFixedIncome(
  input: FixedIncomeInput,
  periods: RatePeriod[],
  now: Date = new Date()
): FixedIncomeProjection {
  const { maturityDate } = input;

  const contributions = [...(input.contributions || [])].sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );

  const settled = input.settledAmount !== null && input.settledAmount !== undefined;
  const settledAmount = settled ? Number(input.settledAmount) : null;
  const matured = now.getTime() >= maturityDate.getTime();
  const accrualEnd = resolveAccrualEnd(input, now);

  const firstDate = contributions.length > 0 ? contributions[0].date : null;
  const daysTotal = firstDate ? daysBetween(firstDate, maturityDate) : 0;
  const daysElapsed = firstDate ? daysBetween(firstDate, accrualEnd) : 0;

  let investedAmount = 0;
  let currentGrossValue = 0;
  let currentTax = 0;
  let projectedGrossValue = 0;
  let projectedTax = 0;
  let weightedDays = 0;

  const details: ContributionProjection[] = contributions.map((c) => {
    // Aportes futuros ainda não capitalizam
    const end = accrualEnd.getTime() > c.date.getTime() ? accrualEnd : c.date;
    const currentValue = c.amount * compoundFactor(input, periods, c.date, end);
    const projectedGross = c.amount * compoundFactor(input, periods, c.date, maturityDate);

    const days = daysBetween(c.date, maturityDate);
    const elapsed = daysBetween(c.date, end);

    const rateIR = input.taxExempt ? 0 : getIncomeTaxRate(days);
    const tax = Math.max(0, projectedGross - c.amount) * rateIR;

    // IR de um resgate na data corrente usa a faixa do prazo já decorrido.
    const currentRateIR = input.taxExempt ? 0 : getIncomeTaxRate(elapsed);
    const currentTaxAmount = Math.max(0, currentValue - c.amount) * currentRateIR;

    investedAmount += c.amount;
    currentGrossValue += currentValue;
    currentTax += currentTaxAmount;
    projectedGrossValue += projectedGross;
    projectedTax += tax;
    weightedDays += c.amount * days;

    return {
      amount: c.amount,
      date: c.date,
      currentGrossValue: currentValue,
      currentTax: currentTaxAmount,
      currentTaxRate: currentRateIR,
      currentNetValue: currentValue - currentTaxAmount,
      projectedGrossValue: projectedGross,
      projectedNetValue: projectedGross - tax,
      projectedTax: tax,
      taxRate: rateIR,
      days,
      daysElapsed: elapsed,
    };
  });

  const projectedGrossProfit = projectedGrossValue - investedAmount;
  const projectedNetValue = projectedGrossValue - projectedTax;
  const currentNetValue = currentGrossValue - currentTax;
  const currentGrossProfit = currentGrossValue - investedAmount;

  // Taxa efetiva ponderada pelo valor e prazo de cada aporte
  const avgDays = investedAmount > 0 ? weightedDays / investedAmount : 0;
  const effectiveAnnualRate =
    investedAmount > 0 && avgDays > 0
      ? (Math.pow(projectedGrossValue / investedAmount, DAYS_PER_YEAR / avgDays) - 1) * 100
      : 0;

  const taxRate = projectedGrossProfit > 0 ? projectedTax / projectedGrossProfit : 0;
  const currentTaxRate = currentGrossProfit > 0 ? currentTax / currentGrossProfit : 0;

  return {
    investedAmount,
    firstContributionDate: firstDate,
    currentGrossValue,
    currentTax,
    currentNetValue,
    currentGrossProfit,
    currentNetProfit: currentNetValue - investedAmount,
    currentTaxRate,
    projectedGrossValue,
    projectedNetValue,
    projectedGrossProfit,
    projectedNetProfit: projectedNetValue - investedAmount,
    projectedTax,
    taxRate,
    effectiveAnnualRate,
    daysTotal,
    daysElapsed,
    // Encerrado: vale o que efetivamente entrou na conta. Ativo: vale o líquido
    // de um resgate hoje, que é o valor que o usuário realmente receberia.
    currentValue: settled ? settledAmount! : currentNetValue,
    settled,
    realizedProfit: settled ? settledAmount! - investedAmount : null,
    expectedNetAtSettlement: settled ? currentNetValue : null,
    settlementDiff: settled ? settledAmount! - currentNetValue : null,
    matured,
    contributions: details,
  };
}
