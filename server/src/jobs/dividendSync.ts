import cron from 'node-cron';
import prisma from '../lib/prisma';
import { getDividends, detectMarket } from '../services/marketData';
import { logAudit } from '../utils/auditLog';
import { getComDateFromEx } from '../utils/dateBR';
import { exit } from 'process';

const DIVIDEND_SYNC_CRON = process.env.DIVIDEND_SYNC_CRON || '0 10 * * 1-5';
const DIVIDEND_SYNC_TIMEZONE = process.env.DIVIDEND_SYNC_TIMEZONE || 'America/Sao_Paulo';
const DIVIDEND_SYNC_STARTUP = (process.env.DIVIDEND_SYNC_STARTUP || 'false').toLowerCase() === 'true';

let running = false;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function syncDividends(): Promise<void> {
  if (running) return;
  running = true;

  try {
    // Get all stocks that have at least one transaction (active in portfolio)
    const stocks = await prisma.stock.findMany({
      where: { transactions: { some: {} } },
      select: { id: true, ticker: true, market: true },
      orderBy: { ticker: 'asc' },
    });

    let totalCreated = 0;

    for (const stock of stocks) {
      try {
        const market = (stock.market === 'BR' || stock.market === 'US')
          ? stock.market as 'BR' | 'US'
          : detectMarket(stock.ticker);

        const announcements = await getDividends(stock.ticker, market);
        if (!announcements || announcements.length === 0) {
          continue;
        }

        // Get existing dividends for this stock to avoid duplicates
        const existing = await prisma.stockDividend.findMany({
          where: { stockId: stock.id },
          select: { comDate: true, amountPerShare: true },
        });

        const existingSet = new Set(
          existing.map((e) => `${e.comDate.toISOString().split('T')[0]}_${Number(e.amountPerShare)}`)
        );

        for (const ann of announcements) {
          if (!ann.exDate || ann.amount <= 0) continue;

          const exDate = new Date(`${ann.exDate}T00:00:00`);
          if (isNaN(exDate.getTime())) continue;

          // comDate = data-ex externa - 1 dia útil (armazenamos apenas a data-com)
          const comDate = getComDateFromEx(exDate);

          // Key to check uniqueness: comDate + amount
          const key = `${comDate.toISOString().split('T')[0]}_${ann.amount}`;
          if (existingSet.has(key)) continue;

          // paymentDate: use provided or default to exDate + 30 days (estimate)
          let paymentDate: Date;
          if (ann.paymentDate) {
            paymentDate = new Date(`${ann.paymentDate}T00:00:00`);
            if (isNaN(paymentDate.getTime())) {
              paymentDate = new Date(exDate);
              paymentDate.setDate(paymentDate.getDate() + 30);
            }
          } else {
            paymentDate = new Date(exDate);
            paymentDate.setDate(paymentDate.getDate() + 30);
          }

          await prisma.stockDividend.create({
            data: {
              stockId: stock.id,
              amountPerShare: ann.amount,
              comDate,
              paymentDate,
              type: 'DIVIDENDO',
            },
          });

          existingSet.add(key);
          totalCreated++;
        }
      } catch (error) {
        console.error(`[dividend-sync] Erro ao buscar dividendos de ${stock.ticker}:`, error);
      }

      // Delay between tickers to respect rate limits
      await delay(2000);
    }

    if (totalCreated > 0) {
      console.info(`[dividend-sync] ${totalCreated} novo(s) dividendo(s) importado(s)`);
    } else {
      console.info('[dividend-sync] Nenhum dividendo novo encontrado');
    }

    await logAudit({
      userId: null,
      action: 'CRON_DIVIDEND_SYNC',
      entity: 'stock_dividends',
      details: `${totalCreated} novo(s) dividendo(s) de ${stocks.length} tickers`,
    });
  } finally {
    running = false;
  }
}

export function startDividendSyncCron() {
  cron.schedule(
    DIVIDEND_SYNC_CRON,
    () => {
      void syncDividends();
    },
    { timezone: DIVIDEND_SYNC_TIMEZONE },
  );

  if (DIVIDEND_SYNC_STARTUP) {
    void syncDividends();
  }

  console.log(
    `[dividend-sync] Cron iniciado (${DIVIDEND_SYNC_CRON}) TZ=${DIVIDEND_SYNC_TIMEZONE} startup=${DIVIDEND_SYNC_STARTUP}`,
  );
}
