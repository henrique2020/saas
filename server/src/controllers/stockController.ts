import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { getQuote, getDividends, detectMarket, getAlphaUsageStats, getYahooMonthlySeries } from '../services/marketData';
import { logAudit } from '../utils/auditLog';

export async function searchStocks(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { q } = req.query;
    if (!q) {
      res.status(400).json({ error: 'Parâmetro q é obrigatório' });
      return;
    }

    const stocks = await prisma.stock.findMany({
      where: {
        OR: [
          { ticker: { contains: String(q).toUpperCase() } },
          { name: { contains: String(q) } },
        ],
      },
      take: 20,
    });

    res.json(stocks);
  } catch (error) {
    console.error('Search stocks error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

export async function getStockQuote(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { ticker } = req.params;
    const upperTicker = String(ticker).toUpperCase();
    const market = detectMarket(upperTicker);
    const quote = await getQuote(upperTicker, market);

    if (!quote) {
      res.status(404).json({ error: 'Cotação não encontrada' });
      return;
    }

    res.json(quote);
  } catch (error) {
    console.error('Get quote error:', error);
    res.status(500).json({ error: 'Erro ao buscar cotação' });
  }
}

export async function getExternalDividends(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { ticker } = req.params;
    const upperTicker = String(ticker).toUpperCase();
    const market = detectMarket(upperTicker);
    const dividends = await getDividends(upperTicker, market);

    if (!dividends) {
      res.json([]);
      return;
    }

    res.json(dividends);
  } catch (error) {
    console.error('Get external dividends error:', error);
    res.status(500).json({ error: 'Erro ao buscar dividendos externos' });
  }
}

export async function getStockHistory(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { ticker } = req.params;
    const { days } = req.query;

    const stock = await prisma.stock.findUnique({ where: { ticker: String(ticker).toUpperCase() } });
    if (!stock) {
      res.status(404).json({ error: 'Ação não encontrada' });
      return;
    }

    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - Number(days || 30));

    const prices = await prisma.stockPrice.findMany({
      where: {
        stockId: stock.id,
        date: { gte: fromDate },
      },
      orderBy: { date: 'asc' },
    });

    res.json(prices);
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

export async function listUserStocks(req: AuthRequest, res: Response): Promise<void> {
  try {
    const stocks = await prisma.stock.findMany({
      where: {
        transactions: { some: { userId: req.userId } },
      },
    });

    res.json(stocks);
  } catch (error) {
    console.error('List stocks error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

export async function getApiUsageStats(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (req.userRole !== 'ADMIN') {
      res.status(403).json({ error: 'Acesso restrito' });
      return;
    }
    res.json(getAlphaUsageStats());
  } catch (error) {
    res.status(500).json({ error: 'Erro interno' });
  }
}

export async function syncMonthPrices(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (req.userRole !== 'ADMIN') {
      res.status(403).json({ error: 'Acesso restrito' });
      return;
    }

    const stocks = await prisma.stock.findMany({
      where: { transactions: { some: {} } },
      select: { id: true, ticker: true, market: true },
      orderBy: { ticker: 'asc' },
    });

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const results: { ticker: string; bars: number; error?: string }[] = [];

    for (const stock of stocks) {
      try {
        const market = (stock.market === 'BR' || stock.market === 'US')
          ? stock.market as 'BR' | 'US'
          : detectMarket(stock.ticker);

        const bars = await getYahooMonthlySeries(stock.ticker, market);

        if (!bars || bars.length === 0) {
          results.push({ ticker: stock.ticker, bars: 0, error: 'Sem dados' });
          continue;
        }

        const monthBars = bars.filter((b) => {
          const d = new Date(`${b.date}T00:00:00`);
          return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });

        let saved = 0;
        for (const bar of monthBars) {
          const date = new Date(`${bar.date}T00:00:00`);
          await prisma.stockPrice.upsert({
            where: { stockId_date: { stockId: stock.id, date } },
            update: {
              open: bar.open,
              high: bar.high,
              low: bar.low,
              close: bar.close,
              volume: BigInt(Math.trunc(bar.volume)),
            },
            create: {
              stockId: stock.id,
              date,
              open: bar.open,
              high: bar.high,
              low: bar.low,
              close: bar.close,
              volume: BigInt(Math.trunc(bar.volume)),
            },
          });
          saved++;
        }

        results.push({ ticker: stock.ticker, bars: saved });
      } catch (error: any) {
        results.push({ ticker: stock.ticker, bars: 0, error: error.message || 'Erro' });
      }

      await new Promise((resolve) => setTimeout(resolve, 2500));
    }

    const totalBars = results.reduce((s, r) => s + r.bars, 0);

    await logAudit({
      userId: req.userId,
      action: 'SYNC_MONTH_PRICES',
      entity: 'stock_prices',
      details: `${results.length} tickers, ${totalBars} barras, mês ${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`,
      ip: req.ip,
    });

    res.json({
      message: `Sincronização mensal concluída`,
      month: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`,
      tickers: results.length,
      totalBars,
      details: results,
    });
  } catch (error) {
    console.error('Sync month error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
