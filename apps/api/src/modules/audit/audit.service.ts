import { prisma } from '../../lib/prisma';
import { AuditEventAction } from '@vuka/shared';

export interface RecordAuditParams {
  actorUserId?: string | null;
  publisherId?: string | null;
  action: AuditEventAction | string;
  entityType: string;
  entityId: string;
  reason?: string | null;
  metadata?: Record<string, any> | null;
}

export class AuditService {
  static async record(params: RecordAuditParams) {
    try {
      return await prisma.auditEvent.create({
        data: {
          actorUserId: params.actorUserId || null,
          publisherId: params.publisherId || null,
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId,
          reason: params.reason || null,
          metadata: params.metadata || undefined
        }
      });
    } catch (error) {
      console.error('[AuditService] Falha ao gravar evento de auditoria:', error);
      // Non-blocking in case of audit failure, but logged
      return null;
    }
  }

  static async listEvents(options: {
    publisherId?: string;
    entityType?: string;
    limit?: number;
    offset?: number;
  }) {
    const { publisherId, entityType, limit = 50, offset = 0 } = options;
    const where: any = {};
    if (publisherId) where.publisherId = publisherId;
    if (entityType) where.entityType = entityType;

    const [items, total] = await Promise.all([
      prisma.auditEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          actor: {
            select: { id: true, displayName: true, email: true, phone: true }
          },
          publisher: {
            select: { id: true, name: true, slug: true }
          }
        }
      }),
      prisma.auditEvent.count({ where })
    ]);

    return { items, total };
  }
}
