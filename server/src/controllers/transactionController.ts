import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { detectCategory } from '../utils/stockCategory';

function detectMarket(ticker: string): string {
  if (/\d+$/.test(ticker) && ticker.length <= 6) return 'BR';
  return 'US';
}

export async function listTransactions(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { portfolioId, stockId } = req.query;

    const where: any = { userId: req.userId };
    if (portfolioId) where.portfolioId = Number(portfolioId);
    if (stockId) where.stockId = Number(stockId);

    const transactions = await prisma.transaction.findMany({
      where,
      include: { stock: true, portfolio: true },
      orderBy: { date: 'desc' },
    });

    res.json(transactions);
  } catch (error) {
    console.error('List transactions error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

export async function createTransaction(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { portfolioId, ticker, type, quantity, price, fees, date, notes } = req.body;

    if (!ticker || !type || !quantity || !price || !date) {
      res.status(400).json({ error: 'Campos obrigatórios: ticker, type, quantity, price, date' });
      return;
    }

    if (!['BUY', 'SELL'].includes(type)) {
      res.status(400).json({ error: 'Type deve ser BUY ou SELL' });
      return;
    }

    let stock = await prisma.stock.findUnique({ where: { ticker: ticker.toUpperCase() } });
    if (!stock) {
      const market = detectMarket(ticker);
      stock = await prisma.stock.create({
        data: { ticker: ticker.toUpperCase(), name: ticker.toUpperCase(), market, category: detectCategory(ticker.toUpperCase(), market) },
      });
    }

    let targetPortfolioId = portfolioId;
    if (!targetPortfolioId) {
      const defaultPortfolio = await prisma.portfolio.findFirst({
        where: { userId: req.userId },
      });
      targetPortfolioId = defaultPortfolio!.id;
    }

    const transaction = await prisma.transaction.create({
      data: {
        userId: req.userId!,
        portfolioId: targetPortfolioId,
        stockId: stock.id,
        type,
        quantity,
        price,
        fees: fees || 0,
        date: new Date(date),
        notes,
      },
      include: { stock: true, portfolio: true },
    });

    res.status(201).json(transaction);
  } catch (error) {
    console.error('Create transaction error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

export async function updateTransaction(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { type, quantity, price, fees, date, notes } = req.body;

    const existing = await prisma.transaction.findFirst({
      where: { id: String(id), userId: req.userId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Transação não encontrada' });
      return;
    }

    const transaction = await prisma.transaction.update({
      where: { id: String(id) },
      data: {
        ...(type && { type }),
        ...(quantity && { quantity }),
        ...(price && { price }),
        ...(fees !== undefined && { fees }),
        ...(date && { date: new Date(date) }),
        ...(notes !== undefined && { notes }),
      },
      include: { stock: true, portfolio: true },
    });

    res.json(transaction);
  } catch (error) {
    console.error('Update transaction error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

export async function deleteTransaction(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const existing = await prisma.transaction.findFirst({
      where: { id: String(id), userId: req.userId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Transação não encontrada' });
      return;
    }

    await prisma.transaction.delete({ where: { id: String(id) } });
    res.status(204).send();
  } catch (error) {
    console.error('Delete transaction error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

export async function importTransactionsCsv(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { csv } = req.body;

    if (!csv || typeof csv !== 'string') {
      res.status(400).json({ error: 'Campo "csv" é obrigatório (string com conteúdo do CSV)' });
      return;
    }

    const lines = csv
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const firstLine = lines[0].toLowerCase();
    const startIdx = firstLine.includes('ticker') || firstLine.includes('operação') || firstLine.includes('operacao') ? 1 : 0;

    const errors: string[] = [];
    const toCreate: Array<{ ticker: string; type: string; quantity: number; price: number; date: Date }> = [];

    for (let i = startIdx; i < lines.length; i++) {
      const parts = lines[i].split(';').map((p) => p.trim());
      if (parts.length < 5) {
        errors.push(`Linha ${i + 1}: formato inválido (esperado 5 colunas separadas por ;)`);
        continue;
      }

      const [ticker, cotasStr, operacao, valorStr, dataStr] = parts;
      const cotas = Number(cotasStr.replace(',', '.'));
      const valor = Number(valorStr.replace(',', '.'));

      if (!ticker) { errors.push(`Linha ${i + 1}: ticker vazio`); continue; }
      if (isNaN(cotas) || cotas <= 0) { errors.push(`Linha ${i + 1}: cotas inválidas "${cotasStr}"`); continue; }
      if (isNaN(valor) || valor <= 0) { errors.push(`Linha ${i + 1}: valor inválido "${valorStr}"`); continue; }

      const op = operacao.toUpperCase();
      let type: string;
      if (op === 'COMPRA' || op === 'BUY') type = 'BUY';
      else if (op === 'VENDA' || op === 'SELL') type = 'SELL';
      else { errors.push(`Linha ${i + 1}: operação inválida "${operacao}" (use COMPRA ou VENDA)`); continue; }

      const parsedDate = new Date(dataStr);
      if (isNaN(parsedDate.getTime())) { errors.push(`Linha ${i + 1}: data inválida "${dataStr}" (use AAAA-MM-DD)`); continue; }

      toCreate.push({ ticker: ticker.toUpperCase(), type, quantity: cotas, price: valor, date: parsedDate });
    }

    if (toCreate.length === 0) {
      res.status(400).json({ error: 'Nenhuma linha válida encontrada', details: errors });
      return;
    }

    const defaultPortfolio = await prisma.portfolio.findFirst({
      where: { userId: req.userId },
    });
    if (!defaultPortfolio) {
      res.status(400).json({ error: 'Nenhum portfolio encontrado. Registre uma movimentação primeiro.' });
      return;
    }

    let created = 0;
    for (const item of toCreate) {
      let stock = await prisma.stock.findUnique({ where: { ticker: item.ticker } });
      if (!stock) {
        const market = detectMarket(item.ticker);
        stock = await prisma.stock.create({
          data: { ticker: item.ticker, name: item.ticker, market, category: detectCategory(item.ticker, market) },
        });
      }

      await prisma.transaction.create({
        data: {
          userId: req.userId!,
          portfolioId: defaultPortfolio.id,
          stockId: stock.id,
          type: item.type,
          quantity: item.quantity,
          price: item.price,
          fees: 0,
          date: item.date,
        },
      });
      created++;
    }

    res.status(201).json({
      message: `${created} movimentação(ões) importada(s) com sucesso`,
      created,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Import CSV error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
