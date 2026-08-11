import cron from 'node-cron';
import prisma from '../lib/prisma';
import { getDailySeries, detectMarket } from '../services/marketData';
import { logAudit } from '../utils/auditLog';

const PRICE_SYNC_CRON = process.env.PRICE_SYNC_CRON || '15 22 * * 1-5';
const PRICE_SYNC_TIMEZONE = process.env.PRICE_SYNC_TIMEZONE || 'America/Sao_Paulo';
const PRICE_SYNC_STARTUP = (process.env.PRICE_SYNC_STARTUP || 'true').toLowerCase() === 'true';

let running = false;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function syncDailyPrices(): Promise<void> {
  if (running) return;
  running = true;

  let synced = 0;
  let total = 0;

  try {
    const stocks = await prisma.stock.findMany({
      where: { transactions: { some: {} } },
      select: { id: true, ticker: true, market: true },
      orderBy: { ticker: 'asc' },
    });

    total = stocks.length;

    for (const stock of stocks) {
      try {
        const market = (stock.market === 'BR' || stock.market === 'US') ? stock.market as 'BR' | 'US' : detectMarket(stock.ticker);
        const bars = await getDailySeries(stock.ticker, market);

        if (!bars || bars.length === 0) {
          console.warn(`[price-sync] Nenhum retorno para ${stock.ticker}`);
          continue;
        }

        // Upsert the latest bar
        const latest = bars[0];
        const date = new Date(`${latest.date}T00:00:00`);

        await prisma.stockPrice.upsert({
          where: { stockId_date: { stockId: stock.id, date } },
          update: {
            open: latest.open,
            high: latest.high,
            low: latest.low,
            close: latest.close,
            volume: BigInt(Math.trunc(latest.volume)),
          },
          create: {
            stockId: stock.id,
            date,
            open: latest.open,
            high: latest.high,
            low: latest.low,
            close: latest.close,
            volume: BigInt(Math.trunc(latest.volume)),
          },
        });

        synced++;
        console.info(`[price-sync] Sincronizado ${stock.ticker} para ${latest.date} (close=${latest.close})`);
      } catch (error) {
        console.error(`[price-sync] Falha ao sincronizar ${stock.ticker}:`, error);
      }

      // Delay between requests to respect rate limits
      await delay(2000);
    }

    await logAudit({
      userId: null,
      action: 'CRON_PRICE_SYNC',
      entity: 'stock_prices',
      details: `${synced}/${total} tickers sincronizados`,
    });
  } finally {
    running = false;
  }
}

export function startPriceSyncCron() {
  return 1;
  cron.schedule(
    PRICE_SYNC_CRON,
    () => {
      void syncDailyPrices();
    },
    { timezone: PRICE_SYNC_TIMEZONE },
  );

  if (PRICE_SYNC_STARTUP) {
    void syncDailyPrices();
  }

  console.log(
    `[price-sync] Cron iniciado (${PRICE_SYNC_CRON}) TZ=${PRICE_SYNC_TIMEZONE} startup=${PRICE_SYNC_STARTUP}`,
  );
}
