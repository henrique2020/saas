import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { logAudit } from '../utils/auditLog';
import { CDI_SELIC_SPREAD, accumulatedIpca, monthlyToAnnual, RatePeriod } from '../utils/fixedIncome';

export const RATE_TYPES = ['SELIC', 'IPCA'] as const;

const RATE_LIMITS: Record<string, { min: number; max: number; hint: string }> = {
  SELIC: { min: 0, max: 100, hint: 'percentual ao ano entre 0 e 100' },
  IPCA: { min: -20, max: 20, hint: 'variação do mês em %, entre -20 e 20 (aceita negativo)' },
};

function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return isNaN(date.getTime()) ? null : date;
}

function validate(body: any): { error?: string; data?: { type: string; rate: number; startDate: Date; notes: string | null } } {
  const type = String(body?.type || '').toUpperCase();
  if (!RATE_TYPES.includes(type as any)) {
    return { error: `Tipo inválido. Use: ${RATE_TYPES.join(', ')}` };
  }

  const limits = RATE_LIMITS[type];
  const rate = Number(body?.rate);
  if (!isFinite(rate) || rate < limits.min || rate > limits.max) {
    return { error: `Taxa inválida para ${type} (${limits.hint})` };
  }

  const startDate = parseDateOnly(body?.startDate);
  if (!startDate) return { error: 'Data de início inválida (use AAAA-MM-DD)' };

  const notes = body?.notes ? String(body.notes) : null;
  return { data: { type, rate, startDate, notes } };
}

export async function listRates(req: AuthRequest, res: Response): Promise<void> {
  try {
    const type = req.query.type ? String(req.query.type).toUpperCase() : undefined;
    const rates = await prisma.rateIndex.findMany({
      where: type ? { type } : { type: { in: [...RATE_TYPES] } },
      orderBy: [{ type: 'asc' }, { startDate: 'desc' }],
    });
    res.json(rates);
  } catch (error) {
    console.error('List rates error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

export async function getCurrentRates(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const today = new Date();
    const rates = await prisma.rateIndex.findMany({
      where: { startDate: { lte: today } },
      orderBy: { startDate: 'desc' },
    });

    const current: Record<string, {
      rate: number;
      startDate: string;
      derived?: boolean;
      unit: 'ANNUAL' | 'MONTHLY';
      annualized?: number;
      accumulated12m?: number;
    }> = {};

    for (const r of rates) {
      if (!current[r.type]) {
        current[r.type] = {
          rate: Number(r.rate),
          startDate: r.startDate.toISOString(),
          unit: r.type === 'IPCA' ? 'MONTHLY' : 'ANNUAL',
        };
      }
    }

    if (current['IPCA']) {
      const periods: RatePeriod[] = rates.map((r) => ({
        type: r.type,
        rate: Number(r.rate),
        startDate: r.startDate,
      }));
      current['IPCA'].annualized = monthlyToAnnual(current['IPCA'].rate);
      current['IPCA'].accumulated12m = accumulatedIpca(periods, 12, today) ?? 0;
    }

    if (current['SELIC']) {
      current['CDI'] = {
        rate: Math.max(0, current['SELIC'].rate - CDI_SELIC_SPREAD),
        startDate: current['SELIC'].startDate,
        derived: true,
        unit: 'ANNUAL',
      };
    } else {
      delete current['CDI'];
    }

    res.json(current);
  } catch (error) {
    console.error('Current rates error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

export async function importRatesCsv(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (req.userRole !== 'ADMIN') {
      res.status(403).json({ error: 'Acesso restrito a administradores' });
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
    const startIdx =
      firstLine.includes('tipo') || firstLine.includes('taxa') || firstLine.includes('índice')
        ? 1
        : 0;

    const errors: string[] = [];
    const parsed: Array<{ type: string; rate: number; startDate: Date; notes: string | null }> = [];

    for (let i = startIdx; i < lines.length; i++) {
      const parts = lines[i].split(';').map((p) => p.trim());
      if (parts.length < 3) {
        errors.push(`Linha ${i + 1}: formato inválido (esperado Tipo;Data;Taxa)`);
        continue;
      }

      const [typeStr, dateStr, rateStr, notesStr] = parts;
      const { error, data } = validate({
        type: typeStr,
        startDate: dateStr,
        rate: rateStr.replace(',', '.'),
        notes: notesStr || null,
      });

      if (error || !data) {
        errors.push(`Linha ${i + 1}: ${error}`);
        continue;
      }
      parsed.push(data);
    }

    if (parsed.length === 0) {
      res.status(400).json({ error: 'Nenhuma linha válida encontrada', details: errors });
      return;
    }

    let created = 0;
    let updated = 0;

    for (const item of parsed) {
      const existing = await prisma.rateIndex.findFirst({
        where: { type: item.type, startDate: item.startDate },
      });

      if (existing) {
        await prisma.rateIndex.update({
          where: { id: existing.id },
          data: { rate: item.rate, notes: item.notes },
        });
        updated++;
      } else {
        await prisma.rateIndex.create({ data: item });
        created++;
      }
    }

    await logAudit({
      userId: req.userId,
      action: 'RATE_IMPORT_CSV',
      entity: 'RateIndex',
      details: `${created} criada(s), ${updated} atualizada(s)`,
      ip: req.ip,
    });

    res.status(201).json({
      message: `${created} taxa(s) criada(s) e ${updated} atualizada(s)`,
      created,
      updated,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Import rates CSV error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

export async function createRate(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (req.userRole !== 'ADMIN') {
      res.status(403).json({ error: 'Acesso restrito a administradores' });
      return;
    }

    const { error, data } = validate(req.body);
    if (error || !data) {
      res.status(400).json({ error });
      return;
    }

    const duplicate = await prisma.rateIndex.findFirst({
      where: { type: data.type, startDate: data.startDate },
    });
    if (duplicate) {
      res.status(409).json({ error: 'Já existe uma taxa desse tipo com essa data de início' });
      return;
    }

    const rate = await prisma.rateIndex.create({ data });
    await logAudit({
      userId: req.userId,
      action: 'RATE_CREATE',
      entity: 'RateIndex',
      entityId: rate.id,
      details: `${data.type} ${data.rate}% a partir de ${data.startDate.toISOString().split('T')[0]}`,
      ip: req.ip,
    });

    res.status(201).json(rate);
  } catch (error) {
    console.error('Create rate error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

export async function updateRate(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (req.userRole !== 'ADMIN') {
      res.status(403).json({ error: 'Acesso restrito a administradores' });
      return;
    }

    const id = Number(req.params.id);
    const existing = await prisma.rateIndex.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Taxa não encontrada' });
      return;
    }

    const { error, data } = validate(req.body);
    if (error || !data) {
      res.status(400).json({ error });
      return;
    }

    const duplicate = await prisma.rateIndex.findFirst({
      where: { type: data.type, startDate: data.startDate, NOT: { id } },
    });
    if (duplicate) {
      res.status(409).json({ error: 'Já existe uma taxa desse tipo com essa data de início' });
      return;
    }

    const rate = await prisma.rateIndex.update({ where: { id }, data });
    await logAudit({
      userId: req.userId,
      action: 'RATE_UPDATE',
      entity: 'RateIndex',
      entityId: id,
      details: `${data.type} ${data.rate}%`,
      ip: req.ip,
    });

    res.json(rate);
  } catch (error) {
    console.error('Update rate error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

export async function deleteRate(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (req.userRole !== 'ADMIN') {
      res.status(403).json({ error: 'Acesso restrito a administradores' });
      return;
    }

    const id = Number(req.params.id);
    const existing = await prisma.rateIndex.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Taxa não encontrada' });
      return;
    }

    await prisma.rateIndex.delete({ where: { id } });
    await logAudit({
      userId: req.userId,
      action: 'RATE_DELETE',
      entity: 'RateIndex',
      entityId: id,
      details: `${existing.type} ${Number(existing.rate)}%`,
      ip: req.ip,
    });

    res.status(204).send();
  } catch (error) {
    console.error('Delete rate error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
