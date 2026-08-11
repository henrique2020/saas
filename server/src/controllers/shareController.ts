import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { generateConfirmationCode, generateShareToken, getShareExpiry, isExpired } from '../utils/share';
import { getDashboardSummaryForUser } from '../services/portfolioService';
import { calculateUserDividends } from '../services/dividendService';

function frontendBaseUrl() {
  return process.env.FRONTEND_URL || 'http://localhost:5173';
}

async function getAuthorizedShare(shareId: string, targetUserId: number) {
  const share = await prisma.profileShare.findFirst({
    where: {
      id: shareId,
      OR: [{ targetUserId }, { ownerUserId: targetUserId }],
      status: 'AUTHORIZED',
      revokedAt: null,
    },
  });

  if (!share) return null;
  return share;
}

export async function listIncomingShares(req: AuthRequest, res: Response): Promise<void> {
  try {
    const incoming = await prisma.profileShare.findMany({
      where: { targetUserId: req.userId },
      include: {
        ownerUser: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(incoming);
  } catch (error) {
    console.error('List incoming shares error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

export async function listOutgoingShares(req: AuthRequest, res: Response): Promise<void> {
  try {
    const outgoing = await prisma.profileShare.findMany({
      where: { ownerUserId: req.userId },
      include: {
        targetUser: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(outgoing);
  } catch (error) {
    console.error('List outgoing shares error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

export async function createOutgoingShare(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { targetEmail } = req.body;
    if (!targetEmail) {
      res.status(400).json({ error: 'targetEmail é obrigatório' });
      return;
    }

    const targetUser = await prisma.user.findUnique({
      where: { email: String(targetEmail).toLowerCase().trim() },
    });

    if (!targetUser) {
      res.status(404).json({ error: 'Usuário de destino não encontrado' });
      return;
    }
    if (targetUser.id === req.userId) {
      res.status(400).json({ error: 'Você não pode compartilhar com você mesmo' });
      return;
    }

    const token = generateShareToken();
    const confirmationCode = generateConfirmationCode();
    const expiresAt = getShareExpiry(30);

    const created = await prisma.profileShare.create({
      data: {
        ownerUserId: req.userId!,
        targetUserId: targetUser.id,
        token,
        confirmationCode,
        expiresAt,
      },
      include: {
        targetUser: { select: { id: true, name: true, email: true } },
      },
    });

    const confirmLink = `${frontendBaseUrl()}/share/confirm?token=${token}`;
    res.status(201).json({ ...created, confirmLink });
  } catch (error) {
    console.error('Create outgoing share error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

export async function confirmShare(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { token, code } = req.body;
    if (!token || !code) {
      res.status(400).json({ error: 'token e code são obrigatórios' });
      return;
    }

    const share = await prisma.profileShare.findUnique({ where: { token: String(token) } });
    if (!share) {
      res.status(404).json({ error: 'Compartilhamento não encontrado' });
      return;
    }
    if (share.targetUserId !== req.userId) {
      res.status(403).json({ error: 'Este compartilhamento não pertence ao usuário autenticado' });
      return;
    }
    if (share.status !== 'PENDING') {
      res.status(400).json({ error: 'Compartilhamento não está pendente' });
      return;
    }
    if (isExpired(share.expiresAt)) {
      await prisma.profileShare.update({
        where: { id: share.id },
        data: { status: 'EXPIRED' },
      });
      res.status(400).json({ error: 'Link expirado' });
      return;
    }
    if (share.confirmationCode.toUpperCase() !== String(code).toUpperCase()) {
      res.status(400).json({ error: 'Código de confirmação inválido' });
      return;
    }

    const updated = await prisma.profileShare.update({
      where: { id: share.id },
      data: {
        status: 'AUTHORIZED',
        authorizedAt: new Date(),
      },
      include: {
        ownerUser: { select: { id: true, name: true, email: true } },
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Confirm share error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

export async function deleteShare(req: AuthRequest, res: Response): Promise<void> {
  try {
    const shareId = String(req.params.id);
    const share = await prisma.profileShare.findFirst({
      where: {
        id: shareId,
        OR: [{ ownerUserId: req.userId }, { targetUserId: req.userId }],
      },
    });

    if (!share) {
      res.status(404).json({ error: 'Compartilhamento não encontrado' });
      return;
    }

    await prisma.profileShare.update({
      where: { id: share.id },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
      },
    });

    res.status(204).send();
  } catch (error) {
    console.error('Delete share error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

export async function getSharedSummary(req: AuthRequest, res: Response): Promise<void> {
  try {
    const share = await getAuthorizedShare(String(req.params.id), req.userId!);
    if (!share) {
      res.status(403).json({ error: 'Sem acesso a este compartilhamento' });
      return;
    }

    const [summary, owner] = await Promise.all([
      getDashboardSummaryForUser(share.ownerUserId),
      prisma.user.findUnique({ where: { id: share.ownerUserId }, select: { id: true, name: true, email: true } }),
    ]);

    res.json({ owner, ...summary });
  } catch (error) {
    console.error('Shared summary error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

export async function getSharedDividendsMonthly(req: AuthRequest, res: Response): Promise<void> {
  try {
    const share = await getAuthorizedShare(String(req.params.id), req.userId!);
    if (!share) {
      res.status(403).json({ error: 'Sem acesso a este compartilhamento' });
      return;
    }

    const { dividends } = await calculateUserDividends(share.ownerUserId);
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
    console.error('Shared monthly dividends error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

export async function getSharedStockDetail(req: AuthRequest, res: Response): Promise<void> {
  try {
    const share = await getAuthorizedShare(String(req.params.id), req.userId!);
    if (!share) {
      res.status(403).json({ error: 'Sem acesso a este compartilhamento' });
      return;
    }

    const userId = share.ownerUserId;
    const ticker = String(req.params.ticker).toUpperCase();

    const stock = await prisma.stock.findUnique({ where: { ticker } });
    if (!stock) {
      res.status(404).json({ error: 'Ação não encontrada' });
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
    }

    averagePrice = quantity > 0 ? totalInvested / quantity : 0;

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
    for (const d of userDivs) {
      const y = String(new Date(d.paymentDate).getFullYear());
      dividendsByYear[y] = (dividendsByYear[y] || 0) + d.totalAmount;
    }

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
      realizedPnL,
      transactions: transactions.map((tx) => ({
        id: tx.id,
        type: tx.type,
        quantity: Number(tx.quantity),
        price: Number(tx.price),
        date: tx.date.toISOString(),
        fees: Number(tx.fees || 0),
      })),
      dividends: userDivs,
    });
  } catch (error) {
    console.error('Shared stock detail error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
