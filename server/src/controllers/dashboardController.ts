import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { calculateUserPositions, getDashboardSummaryForUser, getClosedPositionsForUser } from '../services/portfolioService';
import { calculateUserDividends } from '../services/dividendService';
import { getFixedIncomeSummaryForUser } from '../services/fixedIncomeService';

export async function getSummary(req: AuthRequest, res: Response): Promise<void> {
  try {
    const summary = await getDashboardSummaryForUser(req.userId!);
    res.json(summary);
  } catch (error) {
    console.error('Get dashboard summary error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

export async function getDividendsMonthly(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { dividends } = await calculateUserDividends(req.userId!);
    const monthly: Record<string, number> = {};

    for (const div of dividends) {
      const d = new Date(div.paymentDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthly[key] = (monthly[key] || 0) + div.totalAmount;
    }

    const result = Object.entries(monthly)
      .map(([month, total]) => ({ month, total }))
      .sort((a, b) => a.month.localeCompare(b.month));

    res.json(result);
  } catch (error) {
    console.error('Get dashboard dividends monthly error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

export async function getDividendsGrouped(req: AuthRequest, res: Response): Promise<void> {
  try {
    const mode = (req.query.mode as 'day' | 'month' | 'year') || 'month';
    const { dividends } = await calculateUserDividends(req.userId!);
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const today = new Date(currentYear, currentMonth, now.getDate());

    if (mode === 'day') {
      const grouped: Record<string, { received: number; pending: number }> = {};
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

      for (let d = 1; d <= daysInMonth; d++) {
        const key = String(d).padStart(2, '0');
        grouped[key] = { received: 0, pending: 0 };
      }

      for (const div of dividends) {
        const payDate = new Date(div.paymentDate);
        if (payDate.getFullYear() !== currentYear || payDate.getMonth() !== currentMonth) continue;
        const dayKey = String(payDate.getDate()).padStart(2, '0');
        if (!grouped[dayKey]) grouped[dayKey] = { received: 0, pending: 0 };

        if (payDate <= today) {
          grouped[dayKey].received += div.totalAmount;
        } else {
          grouped[dayKey].pending += div.totalAmount;
        }
      }

      const result = Object.entries(grouped)
        .map(([day, v]) => ({ label: day, received: v.received, pending: v.pending, total: v.received + v.pending }))
        .sort((a, b) => a.label.localeCompare(b.label));

      res.json(result);
      return;
    }

    if (mode === 'year') {
      const grouped: Record<string, { received: number; pending: number }> = {};

      for (const div of dividends) {
        const payDate = new Date(div.paymentDate);
        const yearKey = String(payDate.getFullYear());
        if (!grouped[yearKey]) grouped[yearKey] = { received: 0, pending: 0 };

        if (payDate <= today) {
          grouped[yearKey].received += div.totalAmount;
        } else {
          grouped[yearKey].pending += div.totalAmount;
        }
      }

      const result = Object.entries(grouped)
        .map(([year, v]) => ({ label: year, received: v.received, pending: v.pending, total: v.received + v.pending }))
        .sort((a, b) => a.label.localeCompare(b.label));

      res.json(result);
      return;
    }

    // Default mode: 'month'
    const grouped: Record<string, { received: number; pending: number }> = {};
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    for (let m = 0; m < 12; m++) {
      const key = `${m + 1}-${monthNames[m]}`;
      grouped[key] = { received: 0, pending: 0 };
    }

    for (const div of dividends) {
      const payDate = new Date(div.paymentDate);
      if (payDate.getFullYear() !== currentYear) continue;
      const m = payDate.getMonth();
      const key = `${m + 1}-${monthNames[m]}`;
      if (!grouped[key]) grouped[key] = { received: 0, pending: 0 };

      if (payDate <= today) {
        grouped[key].received += div.totalAmount;
      } else {
        grouped[key].pending += div.totalAmount;
      }
    }

    const result = Object.entries(grouped)
      .map(([key, v]) => {
        const [num, name] = key.split('-');
        return { label: name, received: v.received, pending: v.pending, total: v.received + v.pending, monthNum: Number(num) };
      })
      .sort((a, b) => a.monthNum - b.monthNum)
      .map(({ label, received, pending, total }) => ({ label, received, pending, total }));

    res.json(result);
  } catch (error) {
    console.error('Get dashboard dividends grouped error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

export async function getClosedPositions(req: AuthRequest, res: Response): Promise<void> {
  try {
    const closed = await getClosedPositionsForUser(req.userId!);
    res.json(closed);
  } catch (error) {
    console.error('Get closed positions error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

export async function getPnLOverview(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { activePositions } = await calculateUserPositions(userId);
    const closedPositions = await getClosedPositionsForUser(userId);
    const { dividends: allDividends } = await calculateUserDividends(userId);

    const stocksMap: Record<number, { ticker: string; name: string; category: string; market: string }> = {};

    for (const p of activePositions) {
      stocksMap[p.stockId] = { ticker: p.ticker, name: p.name, category: p.category, market: p.market };
    }
    for (const c of closedPositions) {
      stocksMap[c.stockId] = { ticker: c.ticker, name: c.name, category: c.category, market: c.market };
    }

    const rows = [];
    let grandUnrealized = 0;
    let grandRealized = 0;
    let grandDividends = 0;

    for (const stockIdStr in stocksMap) {
      const stockId = Number(stockIdStr);
      const meta = stocksMap[stockId];
      const active = activePositions.find((p) => p.stockId === stockId);
      const closed = closedPositions.find((c) => c.stockId === stockId);

      const stockDivs = allDividends.filter((d) => d.ticker === meta.ticker);
      const divTotal = stockDivs.reduce((sum, d) => sum + d.totalAmount, 0);

      const unrealizedPnL = active ? (active.currentPrice || active.averagePrice) * active.quantity - active.totalInvested : 0;
      const realizedPnL = closed ? closed.realizedPnL : 0;
      const totalPnL = unrealizedPnL + realizedPnL + divTotal;

      grandUnrealized += unrealizedPnL;
      grandRealized += realizedPnL;
      grandDividends += divTotal;

      rows.push({
        stockId,
        ticker: meta.ticker,
        name: meta.name,
        category: meta.category,
        market: meta.market,
        hasActivePosition: !!active,
        quantity: active ? active.quantity : 0,
        averagePrice: active ? active.averagePrice : 0,
        currentPrice: active ? active.currentPrice : 0,
        totalInvested: active ? active.totalInvested : 0,
        unrealizedPnL,
        realizedPnL,
        totalDividends: divTotal,
        totalPnL,
      });
    }

    rows.sort((a, b) => b.totalPnL - a.totalPnL);

    const fixedIncome = await getFixedIncomeSummaryForUser(userId);

    const totalResult = grandUnrealized + grandRealized + grandDividends;

    const byStock = rows.map((r) => ({
      stockId: r.stockId,
      ticker: r.ticker,
      name: r.name,
      category: r.category,
      market: r.market,
      isOpen: r.hasActivePosition,
      unrealizedPnL: r.unrealizedPnL,
      realizedPnL: r.realizedPnL,
      dividends: r.totalDividends,
      totalResult: r.totalPnL,
    }));

    res.json({
      summary: {
        unrealizedPnL: grandUnrealized,
        realizedPnL: grandRealized,
        totalDividends: grandDividends,
        totalPnL: totalResult,
        totalResult,
      },
      fixedIncomeSummary: {
        invested: fixedIncome.invested,
        currentValue: fixedIncome.currentValue,
        netProfit: fixedIncome.netProfit,
        activeCount: fixedIncome.activeCount,
      },
      fixedIncome: {
        invested: fixedIncome.invested,
        currentValue: fixedIncome.currentValue,
        unrealizedPnL: fixedIncome.netProfit,
        realizedPnL: 0,
        projectedProfit: fixedIncome.projectedProfit || 0,
        settledTotal: 0,
        activeCount: fixedIncome.activeCount,
        totalResult: fixedIncome.netProfit,
      },
      stocks: rows,
      byStock,
    });
  } catch (error) {
    console.error('Get PnL overview error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

export async function getStockDetail(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const ticker = String(req.params.ticker).toUpperCase();

    const stock = await prisma.stock.findUnique({ where: { ticker } });
    if (!stock) {
      res.status(404).json({ error: 'Ativo não encontrado' });
      return;
    }

    const transactions = await prisma.transaction.findMany({
      where: { userId, stockId: stock.id },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    });

    let quantity = 0;
    let totalInvested = 0;
    let averagePrice = 0;
    let realizedPnL = 0;

    const history: Array<{
      date: string;
      type: string;
      quantity: number;
      price: number;
      fees: number;
      runningQuantity: number;
      runningAveragePrice: number;
      totalInvested: number;
    }> = [];

    for (const tx of transactions) {
      const q = Number(tx.quantity);
      const p = Number(tx.price);
      const f = Number(tx.fees || 0);

      if (tx.type === 'BUY') {
        totalInvested += q * p + f;
        quantity += q;
      } else {
        if (quantity > 0) {
          const avgPrice = totalInvested / quantity;
          const costOfSold = q * avgPrice;
          const netSaleValue = q * p - f;
          realizedPnL += netSaleValue - costOfSold;

          totalInvested -= costOfSold;
          quantity = Math.max(0, quantity - q);
        }
      }

      averagePrice = quantity > 0 ? totalInvested / quantity : 0;

      history.push({
        date: tx.date.toISOString(),
        type: tx.type,
        quantity: q,
        price: p,
        fees: f,
        runningQuantity: quantity,
        runningAveragePrice: averagePrice,
        totalInvested,
      });
    }

    const priceRow = await prisma.stockPrice.findFirst({
      where: { stockId: stock.id },
      orderBy: { date: 'desc' },
    });

    const currentPrice = priceRow ? Number(priceRow.close) : averagePrice;
    const marketValue = quantity * currentPrice;
    const unrealizedPnL = marketValue - totalInvested;

    const { dividends: userDivs } = await calculateUserDividends(userId, stock.id);
    const totalDividends = userDivs.reduce((sum, d) => sum + d.totalAmount, 0);

    const dividendsByYear: Record<string, number> = {};
    const dividendPerShareByYear: Record<string, number> = {};

    for (const d of userDivs) {
      const yr = String(new Date(d.paymentDate).getFullYear());
      dividendsByYear[yr] = (dividendsByYear[yr] || 0) + d.totalAmount;
      const perShare = d.sharesHeld > 0 ? d.totalAmount / d.sharesHeld : d.amountPerShare || 0;
      dividendPerShareByYear[yr] = (dividendPerShareByYear[yr] || 0) + (isNaN(perShare) ? 0 : perShare);
    }

    const priceHistoryRows = await prisma.stockPrice.findMany({
      where: { stockId: stock.id },
      orderBy: { date: 'asc' },
    });

    const priceHistory = priceHistoryRows.map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      close: Number(r.close),
    }));

    res.json({
      stock: {
        id: stock.id,
        ticker: stock.ticker,
        name: stock.name,
        market: stock.market,
        category: stock.category,
      },
      position: {
        quantity,
        totalInvested,
        averagePrice,
        currentPrice,
        marketValue,
        unrealizedPnL,
        realizedPnL,
        totalDividends,
        totalPnL: unrealizedPnL + realizedPnL + totalDividends,
        lastPriceDate: priceRow ? priceRow.date.toISOString() : null,
      },
      totalDividends,
      dividendsByYear,
      dividendPerShareByYear,
      transactions: history,
      dividends: userDivs,
      priceHistory,
    });
  } catch (error) {
    console.error('Get stock detail error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

export async function getMovements(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;

    const transactions = await prisma.transaction.findMany({
      where: { userId },
      include: { stock: true },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });

    const txMovements = transactions.map((tx) => {
      const q = Number(tx.quantity);
      const p = Number(tx.price);
      const f = Number(tx.fees || 0);
      const total = q * p + (tx.type === 'BUY' ? f : -f);

      return {
        id: tx.id,
        source: 'transaction' as const,
        kind: tx.type,
        category: tx.type === 'BUY' ? 'Compra' : 'Venda',
        ticker: tx.stock.ticker,
        stockName: tx.stock.name,
        date: tx.date.toISOString(),
        quantity: q,
        unitValue: p,
        fees: f,
        total,
        editable: true,
        notes: tx.notes || null,
        divType: null,
        paymentDate: null,
      };
    });

    const { dividends } = await calculateUserDividends(userId);

    const divMovements = dividends.map((d) => ({
      id: d.source === 'manual' ? d.id || null : null,
      source: d.source === 'manual' ? ('dividend-manual' as const) : ('dividend-auto' as const),
      kind: 'DIVIDEND',
      category: d.source === 'manual' ? 'Dividendo Manual' : 'Dividendo Automático',
      ticker: d.ticker,
      stockName: d.stockName,
      date: new Date(d.paymentDate).toISOString(),
      comDate: new Date(d.comDate).toISOString(),
      paymentDate: new Date(d.paymentDate).toISOString(),
      quantity: d.sharesHeld,
      unitValue: d.amountPerShare,
      fees: 0,
      total: d.totalAmount,
      editable: d.source === 'manual',
      notes: d.source === 'manual' ? (d as any).notes || null : null,
      divType: d.type,
    }));

    const allMovements = [...txMovements, ...divMovements].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    res.json(allMovements);
  } catch (error) {
    console.error('Get movements error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

export async function getStockEvolution(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const ticker = String(req.params.ticker).toUpperCase();
    const range = (req.query.range as 'day' | 'month' | 'year') || 'month';

    const stock = await prisma.stock.findUnique({ where: { ticker } });
    if (!stock) {
      res.status(404).json({ error: 'Ativo não encontrado' });
      return;
    }

    const transactions = await prisma.transaction.findMany({
      where: { userId, stockId: stock.id },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    });

    const allPrices = await prisma.stockPrice.findMany({
      where: { stockId: stock.id },
      orderBy: { date: 'asc' },
    });

    if (allPrices.length === 0) {
      res.json({ series: [] });
      return;
    }

    let targetBars: typeof allPrices = [];

    if (range === 'day') {
      const now = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 30);
      targetBars = allPrices.filter((p) => p.date >= thirtyDaysAgo);
      if (targetBars.length === 0) {
        targetBars = allPrices.slice(-30);
      }
    } else if (range === 'month') {
      const now = new Date();
      const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

      const recentPrices = allPrices.filter((p) => p.date >= twelveMonthsAgo);
      const pricesToGroup = recentPrices.length > 0 ? recentPrices : allPrices;

      const monthlyLastBar: Record<string, typeof allPrices[0]> = {};
      for (const bar of pricesToGroup) {
        const d = bar.date;
        const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
        monthlyLastBar[key] = bar;
      }

      targetBars = Object.values(monthlyLastBar).sort((a, b) => a.date.getTime() - b.date.getTime());
    } else if (range === 'year') {
      const yearlyLastBar: Record<string, typeof allPrices[0]> = {};
      for (const bar of allPrices) {
        const key = String(bar.date.getUTCFullYear());
        yearlyLastBar[key] = bar;
      }
      targetBars = Object.values(yearlyLastBar).sort((a, b) => a.date.getTime() - b.date.getTime());
    }

    const series = targetBars.map((bar) => {
      const barDateStr = bar.date.toISOString().slice(0, 10);
      const barTime = new Date(`${barDateStr}T23:59:59.999Z`).getTime();

      let qty = 0;
      let totalInvested = 0;
      for (const tx of transactions) {
        if (new Date(tx.date).getTime() <= barTime) {
          const q = Number(tx.quantity);
          const p = Number(tx.price);
          const f = Number(tx.fees || 0);

          if (tx.type === 'BUY') {
            totalInvested += q * p + f;
            qty += q;
          } else {
            if (qty > 0) {
              const avgPrice = totalInvested / qty;
              totalInvested -= Math.min(qty, q) * avgPrice;
              qty = Math.max(0, qty - q);
            }
          }
        }
      }

      const precoMedio = qty > 0 ? totalInvested / qty : 0;
      const cotacao = Number(bar.close);
      const valorPatrimonial = qty * cotacao;

      return {
        date: barDateStr,
        cotacao,
        valorPatrimonial,
        precoMedio,
      };
    });

    res.json({ series });
  } catch (error) {
    console.error('Get stock evolution error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

