import prisma from '../lib/prisma';

interface AuditEntry {
  userId?: number | null;
  action: string;
  entity: string;
  entityId?: string | number;
  details?: string;
  ip?: string | string[] | undefined;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const ipStr = Array.isArray(entry.ip) ? entry.ip[0] : (entry.ip || null);
    await prisma.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId != null ? String(entry.entityId) : null,
        details: entry.details || null,
        ip: ipStr,
      },
    });
  } catch (err) {
    console.error('Audit log write failed:', err);
  }
}
