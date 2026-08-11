// Known BR ETF tickers (not exhaustive, but covers major ones)
const BR_ETFS = new Set([
  'BOVA11', 'IVVB11', 'SMAL11', 'DIVO11', 'BRAX11', 'ECOO11', 'FIND11',
  'GOVE11', 'MATB11', 'PIBB11', 'ISUS11', 'BOVV11', 'XBOV11', 'BBOV11',
  'BOVB11', 'HASH11', 'QBTC11', 'QETH11', 'ETHE11', 'BITH11', 'DEFI11',
  'NFTS11', 'WEB311', 'META11', 'TECB11', 'NASD11', 'SPXI11', 'SPXB11',
  'USTK11', 'WRLD11', 'ACWI11', 'EURP11', 'XINA11', 'ASIA11', 'GOLD11',
  'IMAB11', 'IRFM11', 'FIXA11', 'B5P211', 'IB5M11', 'IMBB11', 'NTNS11',
  'COIN11',
]);

/**
 * Auto-detect stock category based on ticker pattern (BR market).
 * - BDR: ends in 34, 35, or 39
 * - ETF: known ETF tickers or 6+ chars ending in 11 that are in the ETF set
 * - FII: 6+ chars ending in 11 (not in ETF set)
 * - ACAO: everything else
 */
export function detectCategory(ticker: string, market: string): string {
  if (market === 'US') return 'ACAO';

  const upper = ticker.toUpperCase();

  // BDRs end in 34, 35, or 39
  if (/\d{2}$/.test(upper)) {
    const suffix = upper.slice(-2);
    if (['34', '35', '39'].includes(suffix)) return 'BDR';
  }

  // ETFs / FIIs: 6+ chars ending in 11
  if (upper.length >= 5 && upper.endsWith('11')) {
    if (BR_ETFS.has(upper)) return 'ETF';
    return 'FII';
  }

  return 'ACAO';
}

/**
 * On startup, recategorize all existing stocks that still have default "ACAO"
 * but match FII/ETF/BDR patterns.
 */
export async function syncStockCategories(): Promise<void> {
  try {
    const prisma = (await import('../lib/prisma')).default;
    const stocks = await prisma.stock.findMany();
    let updated = 0;

    for (const stock of stocks) {
      const correct = detectCategory(stock.ticker, stock.market);
      if (stock.category !== correct) {
        await prisma.stock.update({
          where: { id: stock.id },
          data: { category: correct },
        });
        updated++;
      }
    }

    if (updated > 0) {
      console.log(`[StockCategory] Recategorized ${updated} stock(s)`);
    }
  } catch (err) {
    console.error('[StockCategory] Sync failed:', err);
  }
}
