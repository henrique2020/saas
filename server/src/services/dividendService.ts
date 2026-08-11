import prisma from '../lib/prisma';
import { getExDate, toStartOfDayUTC } from '../utils/dateBR';

export async function calculateUserDividends(userId: number, stockId?: number) {
  const txWhere: any = { userId };
  if (stockId) txWhere.stockId = stockId;

  const transactions = await prisma.transaction.findMany({
    where: txWhere,
    include: { stock: true },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
  });

  const sdWhere: any = {};
  if (stockId) sdWhere.stockId = stockId;

  const stockDividends = await prisma.stockDividend.findMany({
    where: sdWhere,
    include: { stock: true },
    orderBy: { paymentDate: 'asc' },
  });

  const calculatedDividends: Array<{
    source: 'auto';
    ticker: string;
    stockName: string;
    amountPerShare: number;
    sharesHeld: number;
    totalAmount: number;
    exDate: Date;
    comDate: Date;
    paymentDate: Date;
    type: string;
  }> = [];

  for (const sd of stockDividends) {
    const sharesAtComDate = getHoldingsAtDate(transactions, sd.stockId, sd.comDate);

    if (sharesAtComDate > 0) {
      calculatedDividends.push({
        source: 'auto',
        ticker: sd.stock.ticker,
        stockName: sd.stock.name,
        amountPerShare: Number(sd.amountPerShare),
        sharesHeld: sharesAtComDate,
        totalAmount: sharesAtComDate * Number(sd.amountPerShare),
        exDate: getExDate(sd.comDate),
        comDate: sd.comDate,
        paymentDate: sd.paymentDate,
        type: sd.type,
      });
    }
  }

  const manualWhere: any = { userId };
  if (stockId) manualWhere.stockId = stockId;

  const manualDividends = await prisma.userDividend.findMany({
    where: manualWhere,
    include: { stock: true },
    orderBy: { paymentDate: 'asc' },
  });

  const manualResults = manualDividends.map((d) => {
    const sharesAtComDate = getHoldingsAtDate(transactions, d.stockId, d.comDate);
    const amount = Number(d.amount);
    return {
      source: 'manual' as const,
      ticker: d.stock.ticker,
      stockName: d.stock.name,
      amountPerShare: sharesAtComDate > 0 ? amount / sharesAtComDate : 0,
      sharesHeld: sharesAtComDate,
      totalAmount: amount,
      exDate: getExDate(d.comDate),
      comDate: d.comDate,
      paymentDate: d.paymentDate,
      type: d.type,
      notes: d.notes,
      id: d.id,
    };
  });

  const all = [...calculatedDividends, ...manualResults].sort(
    (a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
  );

  const totalAmount = all.reduce((sum, d) => sum + d.totalAmount, 0);

  return { dividends: all, totalAmount };
}

export function getHoldingsAtDate(
  transactions: Array<{ stockId: number; type: string; quantity: any; date: Date }>,
  stockId: number,
  targetDate: Date
): number {
  let holdings = 0;
  const targetTime = toStartOfDayUTC(targetDate).getTime();

  for (const tx of transactions) {
    if (tx.stockId !== stockId) continue;
    const txTime = toStartOfDayUTC(tx.date).getTime();
    if (txTime > targetTime) break;

    const qty = Number(tx.quantity);
    if (tx.type === 'BUY') {
      holdings += qty;
    } else {
      holdings = Math.max(0, holdings - qty);
    }
  }

  return holdings;
}
