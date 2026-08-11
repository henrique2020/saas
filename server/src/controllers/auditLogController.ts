import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

export async function listAuditLogs(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (req.userRole !== 'ADMIN') {
      res.status(403).json({ error: 'Acesso restrito a administradores' });
      return;
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.auditLog.count(),
    ]);

    const userIds = [...new Set(logs.map((l: { userId: number | null }) => l.userId).filter((id): id is number => id !== null))];
    const users = userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const userMap = Object.fromEntries(users.map((u: { id: number; name: string; email: string }) => [u.id, u]));

    const enriched = logs.map((log: { userId: number | null; [key: string]: any }) => ({
      ...log,
      user: log.userId ? userMap[log.userId] || null : { name: 'Sistema', email: 'cron' },
    }));

    res.json({ logs: enriched, total, page, limit });
  } catch (error) {
    console.error('Audit logs error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
