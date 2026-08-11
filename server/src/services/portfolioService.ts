import prisma from '../lib/prisma';
import { calculateUserDividends } from './dividendService';
import { getFixedIncomeSummaryForUser } from './fixedIncomeService';

export type Position = {
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
};

export async function calculateUserPositions(userId: number) {
  const transactions = await prisma.transaction.findMany({
    where: { userId },
    include: { stock: true },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
  });

  const positions: Record<string, Position> = {};

  for (const tx of transactions) {
    const ticker = tx.stock.ticker;
    if (!positions[ticker]) {
      positions[ticker] = {
        stockId: tx.stock.id,
        ticker,
        name: tx.stock.name,
        market: tx.stock.market,
        category: tx.stock.category,
        quantity: 0,
        totalInvested: 0,
        averagePrice: 0,
        currentPrice: 0,
        previousClose: 0,
        changePercent: 0,
        lastPriceDate: null,
      };
    }

    const qty = Number(tx.quantity);
    const price = Number(tx.price);

    if (tx.type === 'BUY') {
      positions[ticker].totalInvested += qty * price;
      positions[ticker].quantity += qty;
    } else {
      if (positions[ticker].quantity > 0) {
        // Reduz investimento proporcionalmente à quantidade vendida em relação à carteira
        const sellRatio = Math.min(1, qty / positions[ticker].quantity);
        positions[ticker].totalInvested -= positions[ticker].totalInvested * sellRatio;
        positions[ticker].quantity = Math.max(0, positions[ticker].quantity - qty);
      } else {
        // Proteção contra ordens de venda sem posição prévia
        positions[ticker].quantity = 0;
        positions[ticker].totalInvested = 0;
      }
    }

    if (positions[ticker].quantity > 0) {
      positions[ticker].averagePrice = positions[ticker].totalInvested / positions[ticker].quantity;
    } else {
      positions[ticker].averagePrice = 0;
      positions[ticker].totalInvested = 0;
    }
  }

  const activePositions = Object.values(positions).filter((p) => p.quantity > 0);

  if (activePositions.length > 0) {
    const stockIds = activePositions.map((p) => p.stockId);
    const priceRows = await prisma.stockPrice.findMany({
      where: { stockId: { in: stockIds } },
      orderBy: [{ stockId: 'asc' }, { date: 'desc' }],
    });

    const pricesByStock: Record<number, Array<{ close: number; date: Date }>> = {};
    for (const row of priceRows) {
      if (!pricesByStock[row.stockId]) pricesByStock[row.stockId] = [];
      if (pricesByStock[row.stockId].length < 2) {
        pricesByStock[row.stockId].push({ close: Number(row.close), date: row.date });
      }
    }

    for (const position of activePositions) {
      const bars = pricesByStock[position.stockId] || [];
      const latest = bars[0];
      const prev = bars[1];
      if (latest) {
        position.currentPrice = latest.close;
        position.lastPriceDate = latest.date.toISOString();
        position.previousClose = prev ? prev.close : latest.close;
        position.changePercent =
          position.previousClose > 0
            ? ((position.currentPrice - position.previousClose) / position.previousClose) * 100
            : 0;
      } else {
        position.currentPrice = position.averagePrice;
        position.previousClose = position.averagePrice;
        position.changePercent = 0;
        position.lastPriceDate = null;
      }
    }
  }

  return { positions, activePositions };
}

export async function getDashboardSummaryForUser(userId: number) {
  const { activePositions } = await calculateUserPositions(userId);
  const { totalAmount: totalDividends } = await calculateUserDividends(userId);

  const totalInvested = activePositions.reduce((sum, p) => sum + p.totalInvested, 0);
  const marketValue = activePositions.reduce(
    (sum, p) => sum + p.quantity * (p.currentPrice || p.averagePrice),
    0
  );
  const fixedIncome = await getFixedIncomeSummaryForUser(userId);

  const rvByCategory: Record<string, { invested: number; currentValue: number }> = {};
  for (const p of activePositions) {
    const key = p.category || 'ACAO';
    if (!rvByCategory[key]) rvByCategory[key] = { invested: 0, currentValue: 0 };
    rvByCategory[key].invested += p.totalInvested;
    rvByCategory[key].currentValue += p.quantity * (p.currentPrice || p.averagePrice);
  }

  const variableIncome = {
    invested: totalInvested,
    currentValue: marketValue,
    unrealizedProfit: marketValue - totalInvested,
    totalDividends,
    positionsCount: activePositions.length,
    byCategory: Object.entries(rvByCategory)
      .map(([category, v]) => ({ category, invested: v.invested, currentValue: v.currentValue }))
      .sort((a, b) => b.currentValue - a.currentValue),
  };

  return {
    totalInvested,
    totalDividends,
    positions: activePositions,
    totalStocks: activePositions.length,
    variableIncome,
    fixedIncome,
    totalInvestedWithFixedIncome: totalInvested + fixedIncome.invested,
    total: {
      invested: totalInvested + fixedIncome.invested,
      currentValue: marketValue + fixedIncome.currentValue,
    },
  };
}

export async function getClosedPositionsForUser(userId: number) {
  const transactions = await prisma.transaction.findMany({
    where: { userId },
    include: { stock: true },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
  });

  const stocksMap: Record<number, { stock: any; txs: typeof transactions }> = {};
  for (const tx of transactions) {
    if (!stocksMap[tx.stockId]) {
      stocksMap[tx.stockId] = { stock: tx.stock, txs: [] };
    }
    stocksMap[tx.stockId].txs.push(tx);
  }

  const { dividends: allDividends } = await calculateUserDividends(userId);

  const closedPositions = [];

  for (const stockIdStr in stocksMap) {
    const stockId = Number(stockIdStr);
    const { stock, txs } = stocksMap[stockIdStr];

    let quantity = 0;
    let totalInvested = 0;
    let realizedPnL = 0;
    let firstBuyDate: Date | null = null;
    let lastSellDate: Date | null = null;
    let hadPosition = false;

    for (const tx of txs) {
      const qty = Number(tx.quantity);
      const price = Number(tx.price);
      const fees = Number(tx.fees || 0);

      if (tx.type === 'BUY') {
        if (!firstBuyDate) firstBuyDate = tx.date;
        totalInvested += qty * price + fees;
        quantity += qty;
        hadPosition = true;
      } else if (tx.type === 'SELL') {
        lastSellDate = tx.date;
        if (quantity > 0) {
          const avgPrice = totalInvested / quantity;
          const costOfSold = qty * avgPrice;
          const netSaleValue = qty * price - fees;
          realizedPnL += netSaleValue - costOfSold;

          totalInvested -= costOfSold;
          quantity = Math.max(0, quantity - qty);
        }
      }
    }

    if (hadPosition && quantity === 0) {
      const stockDividends = allDividends.filter((d) => d.ticker === stock.ticker);
      const totalDividends = stockDividends.reduce((sum, d) => sum + d.totalAmount, 0);

      closedPositions.push({
        stockId: stock.id,
        ticker: stock.ticker,
        name: stock.name,
        category: stock.category,
        market: stock.market,
        realizedPnL,
        totalDividends,
        totalPnL: realizedPnL + totalDividends,
        firstBuyDate: firstBuyDate ? firstBuyDate.toISOString() : null,
        closedDate: lastSellDate ? lastSellDate.toISOString() : null,
      });
    }
  }

  return closedPositions;
}
