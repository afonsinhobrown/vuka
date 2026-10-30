import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../../lib/prisma';
import { signToken } from '../../lib/jwt';
import { AppError } from '../../middlewares/error.middleware';
import { PublisherStatus, UserRole, UserStatus, PublisherDTO, UserDTO } from '@vuka/shared';
import { AuditService } from '../audit/audit.service';

/** Nome do jornal → slug URL-safe. */
function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Código de convite legível: VUKA-XXXX-XXXX (sem 0/O/1/I/L para evitar trocas).
 */
const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateInviteCode(): string {
  const block = (size: number) =>
    Array.from({ length: size }, () => INVITE_ALPHABET[crypto.randomInt(INVITE_ALPHABET.length)]).join('');
  return `VUKA-${block(4)}-${block(4)}`;
}

export interface PublisherInviteDTO {
  id: string;
  code: string;
  note: string | null;
  usedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  status: 'AVAILABLE' | 'USED' | 'EXPIRED';
  publisherId: string | null;
}

export interface RegisterPublisherResult {
  token: string;
  user: UserDTO;
  publisher: PublisherDTO;
}

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

  /* ---------------- Códigos de convite (só ADMIN) ---------------- */

  private static inviteStatus(invite: {
    usedAt: Date | null;
    expiresAt: Date | null;
  }): 'AVAILABLE' | 'USED' | 'EXPIRED' {
    if (invite.usedAt) return 'USED';
    if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) return 'EXPIRED';
    return 'AVAILABLE';
  }

  static async createInvite(
    actorUserId: string,
    data: { note?: string; expiresInDays?: number } = {}
  ): Promise<PublisherInviteDTO> {
    const expiresInDays = Number(data.expiresInDays);
    const expiresAt =
      Number.isFinite(expiresInDays) && expiresInDays > 0
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
        : null;

    let code = generateInviteCode();
    let attempts = 0;
    while (await prisma.publisherInvite.findUnique({ where: { code } })) {
      attempts += 1;
      if (attempts > 5) throw new AppError('Não foi possível gerar um código único.', 500, 'CODE_GENERATION_FAILED');
      code = generateInviteCode();
    }

    const invite = await prisma.publisherInvite.create({
      data: {
        code,
        note: data.note?.trim() || null,
        createdById: actorUserId,
        expiresAt
      }
    });

    await AuditService.record({
      actorUserId,
      action: 'CREATE',
      entityType: 'PUBLISHER_INVITE',
      entityId: invite.id,
      reason: `Convite gerado para criação de jornal (${code})`,
      metadata: { code, expiresAt: expiresAt?.toISOString() || null, note: invite.note }
    });

    return {
      id: invite.id,
      code: invite.code,
      note: invite.note,
      usedAt: invite.usedAt?.toISOString() || null,
      expiresAt: invite.expiresAt?.toISOString() || null,
      createdAt: invite.createdAt.toISOString(),
      status: this.inviteStatus(invite),
      publisherId: invite.publisherId
    };
  }

  static async listInvites(): Promise<PublisherInviteDTO[]> {
    const invites = await prisma.publisherInvite.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    return invites.map((invite: any) => ({
      id: invite.id,
      code: invite.code,
      note: invite.note,
      usedAt: invite.usedAt?.toISOString() || null,
      expiresAt: invite.expiresAt?.toISOString() || null,
      createdAt: invite.createdAt.toISOString(),
      status: this.inviteStatus(invite),
      publisherId: invite.publisherId
    }));
  }

  static async revokeInvite(actorUserId: string, id: string): Promise<void> {
    const invite = await prisma.publisherInvite.findUnique({ where: { id } });
    if (!invite) throw new AppError('Convite não encontrado.', 404, 'INVITE_NOT_FOUND');
    if (invite.usedAt) {
      throw new AppError('Este convite já foi utilizado e não pode ser anulado.', 409, 'INVITE_ALREADY_USED');
    }

    await prisma.publisherInvite.delete({ where: { id } });

    await AuditService.record({
      actorUserId,
      action: 'DELETE',
      entityType: 'PUBLISHER_INVITE',
      entityId: id,
      reason: `Convite anulado (${invite.code})`
    });
  }

  /**
   * Auto-registo de um jornal (sem intervenção do administrador do sistema).
   * Exige um código de convite válido, que é consumido na mesma transação.
   * Cria a editora, a conta do gestor (PUBLISHER_ADMIN) e a associação entre os
   * dois, e devolve já o token para entrar no portal.
   */
  static async registerPublisher(data: {
    publisherName: string;
    slug?: string;
    contactEmail?: string;
    contactPhone?: string;
    adminName: string;
    adminEmail: string;
    adminPhone?: string;
    password: string;
    inviteCode: string;
  }): Promise<RegisterPublisherResult> {
    const publisherName = (data.publisherName || '').trim();
    const adminName = (data.adminName || '').trim();
    const adminEmail = (data.adminEmail || '').toLowerCase().trim();
    const password = data.password || '';
    const inviteCode = (data.inviteCode || '').trim().toUpperCase();

    if (!publisherName || !adminName || !adminEmail || !password) {
      throw new AppError(
        'Nome do jornal, nome do responsável, email e palavra-passe são obrigatórios.',
        400,
        'MISSING_FIELDS'
      );
    }

    if (!inviteCode) {
      throw new AppError(
        'O código de convite é obrigatório. Pede-o à equipa VUKA.',
        400,
        'INVITE_REQUIRED'
      );
    }

    const invite = await prisma.publisherInvite.findUnique({ where: { code: inviteCode } });
    if (!invite) {
      throw new AppError('Código de convite inválido.', 400, 'INVALID_INVITE');
    }
    if (invite.usedAt) {
      throw new AppError('Este código de convite já foi utilizado.', 409, 'INVITE_ALREADY_USED');
    }
    if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
      throw new AppError('Este código de convite expirou. Pede um novo à equipa VUKA.', 410, 'INVITE_EXPIRED');
    }

    if (password.length < 8) {
      throw new AppError('A palavra-passe deve ter pelo menos 8 caracteres.', 400, 'WEAK_PASSWORD');
    }

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adminEmail)) {
      throw new AppError('Email inválido.', 400, 'INVALID_EMAIL');
    }

    const existingUser = await prisma.user.findFirst({ where: { email: adminEmail } });
    if (existingUser) {
      throw new AppError('Já existe uma conta com este email.', 409, 'EMAIL_ALREADY_EXISTS');
    }

    const baseSlug = slugify(data.slug || publisherName) || `jornal-${Date.now()}`;
    let slug = baseSlug;
    let suffix = 1;
    while (await prisma.publisher.findUnique({ where: { slug } })) {
      suffix += 1;
      slug = `${baseSlug}-${suffix}`;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const { publisher, user } = await prisma.$transaction(async (tx: { [key: string]: any }) => {
      const createdPublisher = await tx.publisher.create({
        data: {
          name: publisherName,
          slug,
          contactEmail: (data.contactEmail || adminEmail).trim(),
          contactPhone: data.contactPhone?.trim() || data.adminPhone?.trim() || null,
          status: PublisherStatus.ACTIVE
        }
      });

      const createdUser = await tx.user.create({
        data: {
          displayName: adminName,
          email: adminEmail,
          phone: data.adminPhone?.trim() || null,
          passwordHash,
          role: UserRole.PUBLISHER_ADMIN,
          status: UserStatus.ACTIVE
        }
      });

      await tx.publisherMember.create({
        data: {
          publisherId: createdPublisher.id,
          userId: createdUser.id,
          role: UserRole.PUBLISHER_ADMIN
        }
      });

      // Consome o convite de forma atómica: se outra pessoa o usou entretanto,
      // o updateMany não altera nada e a transação inteira é revertida.
      const consumed = await tx.publisherInvite.updateMany({
        where: { code: inviteCode, usedAt: null },
        data: { usedAt: new Date(), publisherId: createdPublisher.id }
      });

      if (consumed.count !== 1) {
        throw new AppError('Este código de convite já foi utilizado.', 409, 'INVITE_ALREADY_USED');
      }

      return { publisher: createdPublisher, user: createdUser };
    });

    await AuditService.record({
      actorUserId: user.id,
      publisherId: publisher.id,
      action: 'CREATE',
      entityType: 'PUBLISHER',
      entityId: publisher.id,
      reason: `Auto-registo do jornal ${publisher.name} por ${adminEmail} (convite ${inviteCode})`,
      metadata: { inviteCode }
    });

    const token = signToken({
      userId: user.id,
      role: UserRole.PUBLISHER_ADMIN,
      phone: user.phone,
      email: user.email,
      publisherId: publisher.id
    });

    return {
      token,
      user: {
        id: user.id,
        displayName: user.displayName,
        phone: user.phone,
        email: user.email,
        role: user.role as UserRole,
        status: user.status as UserStatus,
        publisherId: publisher.id,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString()
      },
      publisher: {
        id: publisher.id,
        name: publisher.name,
        slug: publisher.slug,
        contactEmail: publisher.contactEmail,
        contactPhone: publisher.contactPhone,
        status: publisher.status as PublisherStatus,
        createdAt: publisher.createdAt.toISOString()
      }
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
