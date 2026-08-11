import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { logAudit } from '../utils/auditLog';
import { calculateFixedIncome, RatePeriod, FixedIncomeInput } from '../utils/fixedIncome';
import { getFixedIncomeSummaryForUser } from '../services/fixedIncomeService';

const INVESTMENT_TYPES = ['CDB', 'LCI', 'LCA', 'LC', 'TESOURO', 'DEBENTURE', 'CRI', 'CRA', 'OUTRO'];
const YIELD_TYPES = ['PRE', 'CDI', 'SELIC', 'IPCA'];

function parseDateOnly(value: unknown): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ''));
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return isNaN(date.getTime()) ? null : date;
}

async function loadRatePeriods(): Promise<RatePeriod[]> {
  const rows = await prisma.rateIndex.findMany({ orderBy: { startDate: 'asc' } });
  return rows.map((r) => ({ type: r.type, rate: Number(r.rate), startDate: r.startDate }));
}

function toInput(row: any): FixedIncomeInput {
  return {
    yieldType: row.yieldType,
    rate: Number(row.rate),
    contributions: (row.contributions || []).map((c: any) => ({
      amount: Number(c.amount),
      date: c.date,
    })),
    maturityDate: row.maturityDate,
    taxExempt: row.taxExempt,
    settledAmount: row.settledAmount === null ? null : Number(row.settledAmount),
    settledDate: row.settledDate,
  };
}

function serialize(row: any, periods: RatePeriod[]) {
  const projection = calculateFixedIncome(toInput(row), periods);
  const contributions = [...(row.contributions || [])].sort(
    (a: any, b: any) => a.date.getTime() - b.date.getTime()
  );

  return {
    id: row.id,
    name: row.name,
    investmentType: row.investmentType,
    yieldType: row.yieldType,
    rate: Number(row.rate),
    investedAmount: projection.investedAmount,
    purchaseDate: projection.firstContributionDate
      ? projection.firstContributionDate.toISOString()
      : null,
    maturityDate: row.maturityDate.toISOString(),
    taxExempt: row.taxExempt,
    settledAmount: row.settledAmount === null ? null : Number(row.settledAmount),
    settledDate: row.settledDate ? row.settledDate.toISOString() : null,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    contributions: contributions.map((c: any, idx: number) => {
      const detail = projection.contributions[idx];
      return {
        id: c.id,
        amount: Number(c.amount),
        date: c.date.toISOString(),
        notes: c.notes,
        createdAt: c.createdAt.toISOString(),
        currentGrossValue: detail?.currentGrossValue ?? 0,
        currentTax: detail?.currentTax ?? 0,
        currentTaxRate: detail?.currentTaxRate ?? 0,
        currentNetValue: detail?.currentNetValue ?? 0,
        projectedGrossValue: detail?.projectedGrossValue ?? 0,
        projectedNetValue: detail?.projectedNetValue ?? 0,
        projectedTax: detail?.projectedTax ?? 0,
        taxRate: detail?.taxRate ?? 0,
        days: detail?.days ?? 0,
        daysElapsed: detail?.daysElapsed ?? 0,
      };
    }),
    projection,
  };
}

function validateBody(body: any, partial = false): { error?: string; data?: any } {
  const data: any = {};

  if (!partial || body.name !== undefined) {
    const name = String(body?.name || '').trim();
    if (!name) return { error: 'Nome é obrigatório' };
    if (name.length > 120) return { error: 'Nome deve ter no máximo 120 caracteres' };
    data.name = name;
  }

  if (!partial || body.investmentType !== undefined) {
    const investmentType = String(body?.investmentType || '').toUpperCase();
    if (!INVESTMENT_TYPES.includes(investmentType)) {
      return { error: `Tipo de investimento inválido. Use: ${INVESTMENT_TYPES.join(', ')}` };
    }
    data.investmentType = investmentType;
  }

  if (!partial || body.yieldType !== undefined) {
    const yieldType = String(body?.yieldType || '').toUpperCase();
    if (!YIELD_TYPES.includes(yieldType)) {
      return { error: `Tipo de rendimento inválido. Use: ${YIELD_TYPES.join(', ')}` };
    }
    data.yieldType = yieldType;
  }

  if (!partial || body.rate !== undefined) {
    const rate = Number(body?.rate);
    if (!isFinite(rate) || rate < 0 || rate > 1000) return { error: 'Taxa inválida' };
    data.rate = rate;
  }

  if (!partial || body.maturityDate !== undefined) {
    const maturityDate = parseDateOnly(body?.maturityDate);
    if (!maturityDate) return { error: 'Data de vencimento inválida (use AAAA-MM-DD)' };
    data.maturityDate = maturityDate;
  }

  if (!partial || body.taxExempt !== undefined) {
    data.taxExempt = Boolean(body?.taxExempt);
  }

  if (body?.notes !== undefined) {
    data.notes = body.notes ? String(body.notes) : null;
  }

  return { data };
}

function parseContributions(body: any): { error?: string; data?: Array<{ amount: number; date: Date; notes: string | null }> } {
  const raw = Array.isArray(body?.contributions) && body.contributions.length > 0
    ? body.contributions
    : [{ amount: body?.investedAmount, date: body?.purchaseDate }];

  const list: Array<{ amount: number; date: Date; notes: string | null }> = [];

  for (const item of raw) {
    const amount = Number(item?.amount);
    if (!isFinite(amount) || amount <= 0) {
      return { error: 'Valor do aporte deve ser maior que zero' };
    }
    const date = parseDateOnly(item?.date);
    if (!date) return { error: 'Data do aporte inválida (use AAAA-MM-DD)' };
    list.push({ amount, date, notes: item?.notes ? String(item.notes) : null });
  }

  return { data: list };
}

async function respondWithInvestment(id: string, res: Response, status = 200): Promise<void> {
  const [row, periods] = await Promise.all([
    prisma.fixedIncome.findUnique({ where: { id }, include: { contributions: true } }),
    loadRatePeriods(),
  ]);
  res.status(status).json(serialize(row, periods));
}

export async function listFixedIncome(req: AuthRequest, res: Response): Promise<void> {
  try {
    const [rows, periods] = await Promise.all([
      prisma.fixedIncome.findMany({
        where: { userId: req.userId },
        include: { contributions: true },
        orderBy: [{ maturityDate: 'asc' }],
      }),
      loadRatePeriods(),
    ]);

    const items = rows.map((row) => serialize(row, periods));
    const summary = await getFixedIncomeSummaryForUser(req.userId!);

    res.json({ items, summary });
  } catch (error) {
    console.error('List fixed income error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

export async function createFixedIncome(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { error, data } = validateBody(req.body);
    if (error) {
      res.status(400).json({ error });
      return;
    }

    const { error: contribError, data: contributions } = parseContributions(req.body);
    if (contribError || !contributions) {
      res.status(400).json({ error: contribError });
      return;
    }

    const lastContribution = Math.max(...contributions.map((c) => c.date.getTime()));
    if (data.maturityDate.getTime() <= lastContribution) {
      res.status(400).json({ error: 'A data de vencimento deve ser posterior à data dos aportes' });
      return;
    }

    const row = await prisma.fixedIncome.create({
      data: {
        ...data,
        userId: req.userId!,
        contributions: { create: contributions },
      },
      include: { contributions: true },
    });

    await logAudit({
      userId: req.userId,
      action: 'FIXED_INCOME_CREATE',
      entity: 'FixedIncome',
      entityId: row.id,
      details: `${data.name} - ${data.investmentType} ${data.yieldType} ${data.rate}`,
      ip: req.ip,
    });

    const periods = await loadRatePeriods();
    res.status(201).json(serialize(row, periods));
  } catch (error) {
    console.error('Create fixed income error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

export async function importFixedIncomeCsv(req: AuthRequest, res: Response): Promise<void> {
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

    if (lines.length === 0) {
      res.status(400).json({ error: 'CSV vazio' });
      return;
    }

    const firstLine = lines[0].toLowerCase();
    const startIdx =
      firstLine.includes('nome') || firstLine.includes('indexador') || firstLine.includes('vencimento')
        ? 1
        : 0;

    const errors: string[] = [];
    type Group = {
      base: any;
      contributions: Array<{ amount: number; date: Date; notes: string | null }>;
    };
    const groups = new Map<string, Group>();

    for (let i = startIdx; i < lines.length; i++) {
      const parts = lines[i].split(';').map((p) => p.trim());
      if (parts.length < 7) {
        errors.push(
          `Linha ${i + 1}: formato inválido (esperado Nome;Tipo;Indexador;Taxa;Valor;Data-aporte;Vencimento[;Isento])`
        );
        continue;
      }

      const [name, investmentType, yieldType, rateStr, amountStr, dateStr, maturityStr, exemptStr] = parts;

      const exempt = ['SIM', 'S', 'TRUE', '1', 'ISENTO'].includes(String(exemptStr || '').toUpperCase());
      const { error, data } = validateBody({
        name,
        investmentType,
        yieldType,
        rate: rateStr.replace(',', '.'),
        maturityDate: maturityStr,
        taxExempt: exempt,
      });

      if (error || !data) {
        errors.push(`Linha ${i + 1}: ${error}`);
        continue;
      }

      const amount = Number(amountStr.replace(',', '.'));
      if (!isFinite(amount) || amount <= 0) {
        errors.push(`Linha ${i + 1}: valor do aporte inválido "${amountStr}"`);
        continue;
      }

      const date = parseDateOnly(dateStr);
      if (!date) {
        errors.push(`Linha ${i + 1}: data do aporte inválida "${dateStr}" (use AAAA-MM-DD)`);
        continue;
      }

      if (date.getTime() >= data.maturityDate.getTime()) {
        errors.push(`Linha ${i + 1}: o aporte deve ser anterior ao vencimento`);
        continue;
      }

      const key = `${data.name.toLowerCase()}|${data.maturityDate.getTime()}`;
      const group = groups.get(key);
      if (group) {
        group.contributions.push({ amount, date, notes: null });
      } else {
        groups.set(key, { base: data, contributions: [{ amount, date, notes: null }] });
      }
    }

    if (groups.size === 0) {
      res.status(400).json({ error: 'Nenhuma linha válida encontrada', details: errors });
      return;
    }

    let created = 0;
    let contributionsAdded = 0;

    for (const group of groups.values()) {
      const existing = await prisma.fixedIncome.findFirst({
        where: {
          userId: req.userId,
          name: group.base.name,
          maturityDate: group.base.maturityDate,
        },
      });

      if (existing) {
        await prisma.fixedIncomeContribution.createMany({
          data: group.contributions.map((c) => ({ ...c, fixedIncomeId: existing.id })),
        });
      } else {
        await prisma.fixedIncome.create({
          data: {
            ...group.base,
            userId: req.userId!,
            contributions: { create: group.contributions },
          },
        });
        created++;
      }
      contributionsAdded += group.contributions.length;
    }

    await logAudit({
      userId: req.userId,
      action: 'FIXED_INCOME_IMPORT_CSV',
      entity: 'FixedIncome',
      details: `${created} investimento(s), ${contributionsAdded} aporte(s)`,
      ip: req.ip,
    });

    res.status(201).json({
      message: `${created} investimento(s) criado(s) e ${contributionsAdded} aporte(s) importado(s)`,
      created,
      contributions: contributionsAdded,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Import fixed income CSV error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

export async function updateFixedIncome(req: AuthRequest, res: Response): Promise<void> {
  try {
    const existing = await prisma.fixedIncome.findFirst({
      where: { id: String(req.params.id), userId: req.userId },
      include: { contributions: true },
    });
    if (!existing) {
      res.status(404).json({ error: 'Investimento não encontrado' });
      return;
    }

    const { error, data } = validateBody(req.body, true);
    if (error) {
      res.status(400).json({ error });
      return;
    }

    const maturityDate = data.maturityDate ?? existing.maturityDate;
    const lastContribution = existing.contributions.reduce(
      (max, c) => Math.max(max, c.date.getTime()),
      0
    );
    if (lastContribution > 0 && maturityDate.getTime() <= lastContribution) {
      res.status(400).json({ error: 'A data de vencimento deve ser posterior à data dos aportes' });
      return;
    }

    const row = await prisma.fixedIncome.update({
      where: { id: existing.id },
      data,
      include: { contributions: true },
    });

    await logAudit({
      userId: req.userId,
      action: 'FIXED_INCOME_UPDATE',
      entity: 'FixedIncome',
      entityId: row.id,
      details: `${row.name} - ${row.investmentType} ${row.yieldType} ${Number(row.rate)}`,
      ip: req.ip,
    });

    const periods = await loadRatePeriods();
    res.json(serialize(row, periods));
  } catch (error) {
    console.error('Update fixed income error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

export async function settleFixedIncome(req: AuthRequest, res: Response): Promise<void> {
  try {
    const existing = await prisma.fixedIncome.findFirst({
      where: { id: String(req.params.id), userId: req.userId },
      include: { contributions: true },
    });
    if (!existing) {
      res.status(404).json({ error: 'Investimento não encontrado' });
      return;
    }

    if (req.body?.settledAmount === null) {
      const reopened = await prisma.fixedIncome.update({
        where: { id: existing.id },
        data: { settledAmount: null, settledDate: null },
        include: { contributions: true },
      });
      const periods = await loadRatePeriods();
      res.json(serialize(reopened, periods));
      return;
    }

    const settledAmount = Number(req.body?.settledAmount);
    if (!isFinite(settledAmount) || settledAmount < 0) {
      res.status(400).json({ error: 'Valor recebido inválido' });
      return;
    }

    const settledDate = req.body?.settledDate ? parseDateOnly(req.body.settledDate) : new Date();
    if (!settledDate) {
      res.status(400).json({ error: 'Data de encerramento inválida (use AAAA-MM-DD)' });
      return;
    }

    const firstContribution = existing.contributions.reduce(
      (min, c) => (min === 0 ? c.date.getTime() : Math.min(min, c.date.getTime())),
      0
    );
    if (firstContribution > 0 && settledDate.getTime() < firstContribution) {
      res.status(400).json({ error: 'A data de encerramento não pode ser anterior ao primeiro aporte' });
      return;
    }

    const row = await prisma.fixedIncome.update({
      where: { id: existing.id },
      data: { settledAmount, settledDate },
      include: { contributions: true },
    });

    await logAudit({
      userId: req.userId,
      action: 'FIXED_INCOME_SETTLE',
      entity: 'FixedIncome',
      entityId: row.id,
      details: `Valor recebido: ${settledAmount}`,
      ip: req.ip,
    });

    const periods = await loadRatePeriods();
    res.json(serialize(row, periods));
  } catch (error) {
    console.error('Settle fixed income error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

export async function addContribution(req: AuthRequest, res: Response): Promise<void> {
  try {
    const investment = await prisma.fixedIncome.findFirst({
      where: { id: String(req.params.id), userId: req.userId },
    });
    if (!investment) {
      res.status(404).json({ error: 'Investimento não encontrado' });
      return;
    }

    const amount = Number(req.body?.amount);
    if (!isFinite(amount) || amount <= 0) {
      res.status(400).json({ error: 'Valor do aporte deve ser maior que zero' });
      return;
    }

    const date = parseDateOnly(req.body?.date);
    if (!date) {
      res.status(400).json({ error: 'Data do aporte inválida (use AAAA-MM-DD)' });
      return;
    }

    if (date.getTime() >= investment.maturityDate.getTime()) {
      res.status(400).json({ error: 'O aporte deve ser anterior à data de vencimento' });
      return;
    }

    const contribution = await prisma.fixedIncomeContribution.create({
      data: {
        fixedIncomeId: investment.id,
        amount,
        date,
        notes: req.body?.notes ? String(req.body.notes) : null,
      },
    });

    await logAudit({
      userId: req.userId,
      action: 'FIXED_INCOME_CONTRIBUTION_CREATE',
      entity: 'FixedIncomeContribution',
      entityId: contribution.id,
      details: `${investment.name}: aporte de ${amount}`,
      ip: req.ip,
    });

    await respondWithInvestment(investment.id, res, 201);
  } catch (error) {
    console.error('Create contribution error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

export async function updateContribution(req: AuthRequest, res: Response): Promise<void> {
  try {
    const investment = await prisma.fixedIncome.findFirst({
      where: { id: String(req.params.id), userId: req.userId },
    });
    if (!investment) {
      res.status(404).json({ error: 'Investimento não encontrado' });
      return;
    }

    const existing = await prisma.fixedIncomeContribution.findFirst({
      where: { id: String(req.params.contributionId), fixedIncomeId: investment.id },
    });
    if (!existing) {
      res.status(404).json({ error: 'Aporte não encontrado' });
      return;
    }

    const data: any = {};

    if (req.body?.amount !== undefined) {
      const amount = Number(req.body.amount);
      if (!isFinite(amount) || amount <= 0) {
        res.status(400).json({ error: 'Valor do aporte deve ser maior que zero' });
        return;
      }
      data.amount = amount;
    }

    if (req.body?.date !== undefined) {
      const date = parseDateOnly(req.body.date);
      if (!date) {
        res.status(400).json({ error: 'Data do aporte inválida (use AAAA-MM-DD)' });
        return;
      }
      if (date.getTime() >= investment.maturityDate.getTime()) {
        res.status(400).json({ error: 'O aporte deve ser anterior à data de vencimento' });
        return;
      }
      data.date = date;
    }

    if (req.body?.notes !== undefined) {
      data.notes = req.body.notes ? String(req.body.notes) : null;
    }

    const updated = await prisma.fixedIncomeContribution.update({
      where: { id: existing.id },
      data,
    });

    await logAudit({
      userId: req.userId,
      action: 'FIXED_INCOME_CONTRIBUTION_UPDATE',
      entity: 'FixedIncomeContribution',
      entityId: existing.id,
      details: `${investment.name}: aporte de ${Number(existing.amount)} -> ${Number(updated.amount)} em ${updated.date.toISOString().slice(0, 10)}`,
      ip: req.ip,
    });

    await respondWithInvestment(investment.id, res);
  } catch (error) {
    console.error('Update contribution error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

export async function deleteContribution(req: AuthRequest, res: Response): Promise<void> {
  try {
    const investment = await prisma.fixedIncome.findFirst({
      where: { id: String(req.params.id), userId: req.userId },
      include: { contributions: true },
    });
    if (!investment) {
      res.status(404).json({ error: 'Investimento não encontrado' });
      return;
    }

    const existing = investment.contributions.find(
      (c) => c.id === String(req.params.contributionId)
    );
    if (!existing) {
      res.status(404).json({ error: 'Aporte não encontrado' });
      return;
    }

    if (investment.contributions.length === 1) {
      res.status(400).json({
        error: 'O investimento precisa ter ao menos um aporte. Exclua o investimento se desejar removê-lo.',
      });
      return;
    }

    await prisma.fixedIncomeContribution.delete({ where: { id: existing.id } });

    await logAudit({
      userId: req.userId,
      action: 'FIXED_INCOME_CONTRIBUTION_DELETE',
      entity: 'FixedIncomeContribution',
      entityId: existing.id,
      details: `${investment.name}: aporte de ${Number(existing.amount)}`,
      ip: req.ip,
    });

    await respondWithInvestment(investment.id, res);
  } catch (error) {
    console.error('Delete contribution error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

export async function deleteFixedIncome(req: AuthRequest, res: Response): Promise<void> {
  try {
    const existing = await prisma.fixedIncome.findFirst({
      where: { id: String(req.params.id), userId: req.userId },
    });
    if (!existing) {
      res.status(404).json({ error: 'Investimento não encontrado' });
      return;
    }

    await prisma.fixedIncome.delete({ where: { id: existing.id } });
    await logAudit({
      userId: req.userId,
      action: 'FIXED_INCOME_DELETE',
      entity: 'FixedIncome',
      entityId: existing.id,
      details: existing.name,
      ip: req.ip,
    });

    res.status(204).send();
  } catch (error) {
    console.error('Delete fixed income error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
