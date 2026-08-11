import prisma from '../lib/prisma';
import { calculateFixedIncome, RatePeriod } from '../utils/fixedIncome';

export async function getFixedIncomeSummaryForUser(userId: number) {
  const investments = await prisma.fixedIncome.findMany({
    where: { userId },
    include: {
      contributions: { orderBy: { date: 'asc' } },
    },
    orderBy: [{ settledDate: 'asc' }, { maturityDate: 'asc' }],
  });

  const rateIndexRows = await prisma.rateIndex.findMany({
    orderBy: { startDate: 'asc' },
  });

  const ratePeriods: RatePeriod[] = rateIndexRows.map((r) => ({
    type: r.type,
    rate: Number(r.rate),
    startDate: r.startDate,
  }));

  const projections = investments.map((inv) => {
    const contributions = inv.contributions.map((c) => ({
      amount: Number(c.amount),
      date: c.date,
    }));

    const proj = calculateFixedIncome({
      yieldType: inv.yieldType,
      rate: Number(inv.rate),
      contributions,
      maturityDate: inv.maturityDate,
      taxExempt: inv.taxExempt,
      settledAmount: inv.settledAmount ? Number(inv.settledAmount) : null,
      settledDate: inv.settledDate,
    }, ratePeriods);

    return {
      investment: inv,
      projection: proj,
    };
  });

  const active = projections.filter((p) => !p.projection.settled);
  const settled = projections.filter((p) => p.projection.settled);

  const investedActive = active.reduce((sum, p) => sum + p.projection.investedAmount, 0);
  const currentGrossValueActive = active.reduce((sum, p) => sum + p.projection.currentGrossValue, 0);
  const currentTaxActive = active.reduce((sum, p) => sum + p.projection.currentTax, 0);
  const currentValueActive = active.reduce((sum, p) => sum + p.projection.currentNetValue, 0);
  const unrealizedProfitActive = currentValueActive - investedActive;

  const projectedNetValueActive = active.reduce((sum, p) => sum + p.projection.projectedNetValue, 0);
  const projectedProfitActive = active.reduce((sum, p) => sum + p.projection.projectedNetProfit, 0);
  const projectedTaxActive = active.reduce((sum, p) => sum + p.projection.projectedTax, 0);

  const settledInvested = settled.reduce((sum, p) => sum + p.projection.investedAmount, 0);
  const settledTotal = settled.reduce((sum, p) => sum + (p.investment.settledAmount ? Number(p.investment.settledAmount) : p.projection.currentNetValue), 0);
  const settledTax = settled.reduce((sum, p) => sum + p.projection.currentTax, 0);
  const realizedProfit = settledTotal - settledInvested;

  const byType: Record<string, { invested: number; currentValue: number }> = {};
  for (const item of active) {
    const key = item.investment.investmentType;
    if (!byType[key]) byType[key] = { invested: 0, currentValue: 0 };
    byType[key].invested += item.projection.investedAmount;
    byType[key].currentValue += item.projection.currentNetValue;
  }

  return {
    investments: projections,
    invested: investedActive,
    currentGrossValue: currentGrossValueActive,
    currentValue: currentValueActive,
    currentTax: currentTaxActive,
    unrealizedProfit: unrealizedProfitActive,
    netProfit: unrealizedProfitActive,
    projectedNetValue: projectedNetValueActive,
    projectedProfit: projectedProfitActive,
    projectedTax: projectedTaxActive,
    settledInvested,
    settledTotal,
    settledTax,
    realizedProfit,
    activeCount: active.length,
    settledCount: settled.length,
    byType: Object.entries(byType)
      .map(([type, v]) => ({ type, investmentType: type, invested: v.invested, currentValue: v.currentValue }))
      .sort((a, b) => b.currentValue - a.currentValue),
  };
}
