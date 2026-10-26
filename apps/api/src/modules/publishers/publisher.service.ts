import { prisma } from '../../lib/prisma';
import { AppError } from '../../middlewares/error.middleware';
import { PublisherStatus, UserRole, PublisherDTO } from '@vuka/shared';
import { AuditService } from '../audit/audit.service';

export class PublisherService {
  static async listPublishers(userRole?: UserRole, userPublisherId?: string | null): Promise<PublisherDTO[]> {
    const where: any = {};
    
    // Multi-tenant check: if publisher admin/editor, only return their own publisher
    if (userRole && userRole !== UserRole.ADMIN && userPublisherId) {
      where.id = userPublisherId;
    }

    const publishers = await prisma.publisher.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { publications: true }
        }
      }
    });

    return publishers.map((p: any) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      contactEmail: p.contactEmail,
      contactPhone: p.contactPhone,
      status: p.status as PublisherStatus,
      createdAt: p.createdAt.toISOString(),
      publicationsCount: p._count.publications
    }));
  }

  static async getPublisherById(id: string): Promise<PublisherDTO> {
    const p = await prisma.publisher.findUnique({
      where: { id },
      include: {
        _count: { select: { publications: true } }
      }
    });

    if (!p) {
      throw new AppError('Editora não encontrada.', 404, 'PUBLISHER_NOT_FOUND');
    }

    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      contactEmail: p.contactEmail,
      contactPhone: p.contactPhone,
      status: p.status as PublisherStatus,
      createdAt: p.createdAt.toISOString(),
      publicationsCount: p._count.publications
    };
  }

  static async createPublisher(
    actorUserId: string,
    data: { name: string; slug: string; contactEmail?: string; contactPhone?: string }
  ): Promise<PublisherDTO> {
    const existing = await prisma.publisher.findUnique({
      where: { slug: data.slug.toLowerCase().trim() }
    });

    if (existing) {
      throw new AppError('Já existe uma editora com este slug/identificador.', 409, 'SLUG_ALREADY_EXISTS');
    }

    const publisher = await prisma.publisher.create({
      data: {
        name: data.name.trim(),
        slug: data.slug.toLowerCase().trim(),
        contactEmail: data.contactEmail?.trim(),
        contactPhone: data.contactPhone?.trim(),
        status: PublisherStatus.ACTIVE
      }
    });

    await AuditService.record({
      actorUserId,
      publisherId: publisher.id,
      action: 'CREATE',
      entityType: 'PUBLISHER',
      entityId: publisher.id,
      reason: `Criação da editora ${publisher.name}`
    });

    return {
      id: publisher.id,
      name: publisher.name,
      slug: publisher.slug,
      contactEmail: publisher.contactEmail,
      contactPhone: publisher.contactPhone,
      status: publisher.status as PublisherStatus,
      createdAt: publisher.createdAt.toISOString()
    };
  }

  static async updatePublisher(
    actorUserId: string,
    id: string,
    data: { name?: string; contactEmail?: string; contactPhone?: string; status?: PublisherStatus }
  ): Promise<PublisherDTO> {
    const publisher = await prisma.publisher.findUnique({ where: { id } });
    if (!publisher) {
      throw new AppError('Editora não encontrada.', 404, 'PUBLISHER_NOT_FOUND');
    }

    const updated = await prisma.publisher.update({
      where: { id },
      data: {
        name: data.name !== undefined ? data.name.trim() : undefined,
        contactEmail: data.contactEmail !== undefined ? data.contactEmail?.trim() : undefined,
        contactPhone: data.contactPhone !== undefined ? data.contactPhone?.trim() : undefined,
        status: data.status !== undefined ? data.status : undefined
      }
    });

    await AuditService.record({
      actorUserId,
      publisherId: id,
      action: 'UPDATE',
      entityType: 'PUBLISHER',
      entityId: id,
      reason: `Atualização de metadados da editora`
    });

    return {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      contactEmail: updated.contactEmail,
      contactPhone: updated.contactPhone,
      status: updated.status as PublisherStatus,
      createdAt: updated.createdAt.toISOString()
    };
  }

  static async listMembers(publisherId: string) {
    const members = await prisma.publisherMember.findMany({
      where: { publisherId },
      include: {
        user: {
          select: { id: true, displayName: true, email: true, phone: true, role: true, status: true }
        }
      }
    });

    return members.map((m: any) => ({
      id: m.id,
      userId: m.userId,
      user: m.user,
      role: m.role,
      createdAt: m.createdAt.toISOString()
    }));
  }
}
