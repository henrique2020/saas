import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { detectCategory } from '../utils/stockCategory';
import { logAudit } from '../utils/auditLog';
import { getExDate } from '../utils/dateBR';
import { calculateUserDividends } from '../services/dividendService';

export async function listStockDividends(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { stockId, ticker } = req.query;

    const where: any = {};
    if (stockId) where.stockId = Number(stockId);
    if (ticker) {
      const stock = await prisma.stock.findUnique({ where: { ticker: String(ticker).toUpperCase() } });
      if (stock) where.stockId = stock.id;
    }

    const dividends = await prisma.stockDividend.findMany({
      where,
      include: { stock: true },
      orderBy: { paymentDate: 'desc' },
    });

    const withExDate = dividends.map((d) => ({ ...d, exDate: getExDate(d.comDate) }));

    res.json(withExDate);
  } catch (error) {
    console.error('List stock dividends error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

export async function createStockDividend(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (req.userRole !== 'ADMIN') {
      res.status(403).json({ error: 'Apenas administradores podem cadastrar dividendos centrais' });
      return;
    }

    const { ticker, amountPerShare, comDate, paymentDate, type } = req.body;

    if (!ticker || !amountPerShare || !comDate || !paymentDate || !type) {
      res.status(400).json({ error: 'Campos obrigatórios: ticker, amountPerShare, comDate, paymentDate, type' });
      return;
    }

    if (!['DIVIDENDO', 'JCP', 'RENDIMENTO'].includes(type)) {
      res.status(400).json({ error: 'Type deve ser DIVIDENDO, JCP ou RENDIMENTO' });
      return;
    }

    let stock = await prisma.stock.findUnique({ where: { ticker: ticker.toUpperCase() } });
    if (!stock) {
      const market = /\d+$/.test(ticker) && ticker.length <= 6 ? 'BR' : 'US';
      stock = await prisma.stock.create({
        data: { ticker: ticker.toUpperCase(), name: ticker.toUpperCase(), market, category: detectCategory(ticker.toUpperCase(), market) },
      });
    }

    const parsedComDate = new Date(comDate);
    const parsedPaymentDate = new Date(paymentDate);
    if (isNaN(parsedComDate.getTime()) || isNaN(parsedPaymentDate.getTime())) {
      res.status(400).json({ error: 'Datas inválidas (use AAAA-MM-DD)' });
      return;
    }

    const dividend = await prisma.stockDividend.create({
      data: {
        stockId: stock.id,
        amountPerShare,
        comDate: parsedComDate,
        paymentDate: parsedPaymentDate,
        type,
      },
      include: { stock: true },
    });

    await logAudit({
      userId: req.userId!,
      action: 'CREATE',
      entity: 'StockDividend',
      entityId: dividend.id,
      details: `Dividendo central: ${ticker} ${type} ${amountPerShare}`,
      ip: req.ip,
    });

    res.status(201).json({ ...dividend, exDate: getExDate(dividend.comDate) });
  } catch (error) {
    console.error('Create stock dividend error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

export async function updateStockDividend(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (req.userRole !== 'ADMIN') {
      res.status(403).json({ error: 'Apenas administradores podem editar dividendos centrais' });
      return;
    }

    const { id } = req.params;
    const { amountPerShare, comDate, paymentDate, type } = req.body;

    const existing = await prisma.stockDividend.findUnique({ where: { id: String(id) } });
    if (!existing) {
      res.status(404).json({ error: 'Dividendo não encontrado' });
      return;
    }

    const newComDate = comDate ? new Date(comDate) : undefined;

    const updated = await prisma.stockDividend.update({
      where: { id: String(id) },
      data: {
        ...(amountPerShare !== undefined && { amountPerShare }),
        ...(newComDate && { comDate: newComDate }),
        ...(paymentDate && { paymentDate: new Date(paymentDate) }),
        ...(type && { type }),
      },
      include: { stock: true },
    });

    await logAudit({
      userId: req.userId!,
      action: 'UPDATE',
      entity: 'StockDividend',
      entityId: String(id),
      details: `Dividendo central editado: ${updated.stock.ticker} ${updated.type} R$${Number(updated.amountPerShare).toFixed(4)} pgto ${new Date(updated.paymentDate).toISOString().slice(0, 10)}`,
      ip: req.ip,
    });

    res.json({ ...updated, exDate: getExDate(updated.comDate) });
  } catch (error) {
    console.error('Update stock dividend error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

export async function deleteStockDividend(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (req.userRole !== 'ADMIN') {
      res.status(403).json({ error: 'Apenas administradores podem remover dividendos centrais' });
      return;
    }

    const { id } = req.params;
    const existing = await prisma.stockDividend.findUnique({
      where: { id: String(id) },
      include: { stock: true },
    });

    if (!existing) {
      res.status(404).json({ error: 'Dividendo não encontrado' });
      return;
    }

    await prisma.stockDividend.delete({ where: { id: String(id) } });

    await logAudit({
      userId: req.userId!,
      action: 'DELETE',
      entity: 'StockDividend',
      entityId: String(id),
      details: `Dividendo central removido: ${existing.stock.ticker} ${existing.type} R$${Number(existing.amountPerShare).toFixed(4)}`,
      ip: req.ip,
    });

    res.status(204).send();
  } catch (error) {
    console.error('Delete stock dividend error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

export async function importStockDividendsCsv(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (req.userRole !== 'ADMIN') {
      res.status(403).json({ error: 'Apenas administradores podem importar dividendos centrais' });
      return;
    }

    const { csv } = req.body;
    if (!csv || typeof csv !== 'string') {
      res.status(400).json({ error: 'Campo "csv" é obrigatório (string com conteúdo do CSV)' });
      return;
    }

    const lines = csv
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      res.status(400).json({ error: 'CSV vazio' });
      return;
    }

    const firstLine = lines[0].toLowerCase();
    const startIdx = firstLine.includes('ticker') ? 1 : 0;

    const errors: string[] = [];
    const toCreate: Array<{
      ticker: string;
      comDate: Date;
      paymentDate: Date;
      type: 'DIVIDENDO' | 'JCP' | 'RENDIMENTO';
      amountPerShare: number;
    }> = [];

    for (let i = startIdx; i < lines.length; i++) {
      const parts = lines[i].split(';').map((p) => p.trim());
      if (parts.length < 5) {
        errors.push(`Linha ${i + 1}: formato inválido (esperado 5 colunas separadas por ;)`);
        continue;
      }

      const [tickerRaw, comDateRaw, paymentDateRaw, typeRaw, amountRaw] = parts;
      const ticker = tickerRaw.toUpperCase();
      const amountPerShare = Number(amountRaw.replace(',', '.'));
      const comDate = new Date(comDateRaw);
      const paymentDate = new Date(paymentDateRaw);
      const type = typeRaw.toUpperCase() as 'DIVIDENDO' | 'JCP' | 'RENDIMENTO';

      if (!ticker) {
        errors.push(`Linha ${i + 1}: ticker vazio`);
        continue;
      }
      if (isNaN(comDate.getTime())) {
        errors.push(`Linha ${i + 1}: Data-com inválida "${comDateRaw}" (use AAAA-MM-DD)`);
        continue;
      }
      if (isNaN(paymentDate.getTime())) {
        errors.push(`Linha ${i + 1}: Data-pagamento inválida "${paymentDateRaw}" (use AAAA-MM-DD)`);
        continue;
      }
      if (!['DIVIDENDO', 'JCP', 'RENDIMENTO'].includes(type)) {
        errors.push(`Linha ${i + 1}: Tipo inválido "${typeRaw}" (use DIVIDENDO, JCP ou RENDIMENTO)`);
        continue;
      }
      if (isNaN(amountPerShare) || amountPerShare <= 0) {
        errors.push(`Linha ${i + 1}: Valor inválido "${amountRaw}"`);
        continue;
      }

      toCreate.push({ ticker, comDate, paymentDate, type, amountPerShare });
    }

    if (toCreate.length === 0) {
      res.status(400).json({ error: 'Nenhuma linha válida encontrada', details: errors });
      return;
    }

    let created = 0;
    for (const [index, item] of toCreate.entries()) {
      try {
        let stock = await prisma.stock.findUnique({ where: { ticker: item.ticker } });
        if (!stock) {
          const market = /\d+$/.test(item.ticker) && item.ticker.length <= 6 ? 'BR' : 'US';
          stock = await prisma.stock.create({
            data: { ticker: item.ticker, name: item.ticker, market, category: detectCategory(item.ticker, market) },
          });
        }

        await prisma.stockDividend.create({
          data: {
            stockId: stock.id,
            amountPerShare: item.amountPerShare,
            comDate: item.comDate,
            paymentDate: item.paymentDate,
            type: item.type,
          },
        });
        created++;
      } catch (rowError) {
        const message = rowError instanceof Error ? rowError.message : 'erro desconhecido';
        errors.push(`Linha ${startIdx + index + 1}: não foi possível salvar (${message})`);
      }
    }

    if (created === 0) {
      res.status(400).json({ error: 'Nenhum dividendo foi importado', details: errors });
      return;
    }

    res.status(201).json({
      message: `${created} dividendo(s) importado(s) com sucesso`,
      created,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Import stock dividends CSV error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

export async function listManualUserDividends(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { stockId } = req.query;

    const where: any = { userId: req.userId };
    if (stockId) where.stockId = Number(stockId);

    const dividends = await prisma.userDividend.findMany({
      where,
      include: { stock: true },
      orderBy: { paymentDate: 'desc' },
    });

    const withExDate = dividends.map((d) => ({ ...d, exDate: getExDate(d.comDate) }));

    res.json(withExDate);
  } catch (error) {
    console.error('List user dividends error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

export async function createManualUserDividend(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { ticker, amount, comDate, paymentDate, type, notes } = req.body;

    if (!ticker || !amount || !comDate || !paymentDate || !type) {
      res.status(400).json({ error: 'Campos obrigatórios: ticker, amount, comDate, paymentDate, type' });
      return;
    }

    if (!['DIVIDENDO', 'JCP', 'RENDIMENTO'].includes(type)) {
      res.status(400).json({ error: 'Type deve ser DIVIDENDO, JCP ou RENDIMENTO' });
      return;
    }

    let stock = await prisma.stock.findUnique({ where: { ticker: ticker.toUpperCase() } });
    if (!stock) {
      const market = /\d+$/.test(ticker) && ticker.length <= 6 ? 'BR' : 'US';
      stock = await prisma.stock.create({
        data: { ticker: ticker.toUpperCase(), name: ticker.toUpperCase(), market, category: detectCategory(ticker.toUpperCase(), market) },
      });
    }

    const dividend = await prisma.userDividend.create({
      data: {
        userId: req.userId!,
        stockId: stock.id,
        amount,
        comDate: new Date(comDate),
        paymentDate: new Date(paymentDate),
        type,
        notes,
      },
      include: { stock: true },
    });

    res.status(201).json({ ...dividend, exDate: getExDate(dividend.comDate) });
  } catch (error) {
    console.error('Create user dividend error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

export async function updateManualUserDividend(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { amount, comDate, paymentDate, type, notes } = req.body;

    const existing = await prisma.userDividend.findFirst({
      where: { id: String(id), userId: req.userId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Dividendo não encontrado' });
      return;
    }

    const updated = await prisma.userDividend.update({
      where: { id: String(id) },
      data: {
        ...(amount !== undefined && { amount }),
        ...(comDate && { comDate: new Date(comDate) }),
        ...(paymentDate && { paymentDate: new Date(paymentDate) }),
        ...(type && { type }),
        ...(notes !== undefined && { notes }),
      },
      include: { stock: true },
    });

    res.json({ ...updated, exDate: getExDate(updated.comDate) });
  } catch (error) {
    console.error('Update user dividend error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

export async function deleteManualUserDividend(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const existing = await prisma.userDividend.findFirst({
      where: { id: String(id), userId: req.userId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Dividendo não encontrado' });
      return;
    }

    await prisma.userDividend.delete({ where: { id: String(id) } });
    res.status(204).send();
  } catch (error) {
    console.error('Delete user dividend error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

export async function getUserDividends(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { stockId } = req.query;

    const calculated = await calculateUserDividends(userId, stockId ? Number(stockId) : undefined);
    res.json(calculated);
  } catch (error) {
    console.error('Get user dividends error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
