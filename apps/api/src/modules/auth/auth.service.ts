import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma';
import { signToken } from '../../lib/jwt';
import { AppError } from '../../middlewares/error.middleware';
import { UserRole, UserStatus, UserDTO } from '@vuka/shared';
import { AuditService } from '../audit/audit.service';

export class AuthService {
  static async loginWithPassword(emailOrPhone: string, password: string):Promise<{ token: string; user: UserDTO }> {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: emailOrPhone.toLowerCase().trim() },
          { phone: emailOrPhone.trim() }
        ]
      },
      include: {
        publisherMembers: {
          include: { publisher: true }
        }
      }
    });

    if (!user || !user.passwordHash) {
      throw new AppError('Credenciais inválidas.', 401, 'INVALID_CREDENTIALS');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new AppError('Credenciais inválidas.', 401, 'INVALID_CREDENTIALS');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new AppError('Esta conta encontra-se inativa ou suspensa.', 403, 'USER_INACTIVE');
    }

    const publisherId = user.publisherMembers[0]?.publisherId || null;

    const token = signToken({
      userId: user.id,
      role: user.role as UserRole,
      phone: user.phone,
      email: user.email,
      publisherId
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
        publisherId,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString()
      }
    };
  }

  /**
   * Autenticação de Leitor via Telefone (com código OTP simulado ou senha)
   * Se o leitor ainda não existir, cria a conta automaticamente vinculada ao número da compra.
   */
  static async readerPhoneAuth(phone: string, otpOrPassword?: string): Promise<{ token: string; user: UserDTO }> {
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 8) {
      throw new AppError('Número de telefone inválido.', 400, 'INVALID_PHONE');
    }

    let user = await prisma.user.findFirst({
      where: { phone: cleanPhone }
    });

    if (!user) {
      // Auto-provision reader account on first authentication
      user = await prisma.user.create({
        data: {
          phone: cleanPhone,
          displayName: `Leitor ${cleanPhone.slice(-4)}`,
          role: UserRole.READER,
          status: UserStatus.ACTIVE
        }
      });

      await AuditService.record({
        actorUserId: user.id,
        action: 'CREATE',
        entityType: 'USER',
        entityId: user.id,
        reason: 'Auto-criação de conta de leitor via telefone'
      });
    }

    // Se tiver senha configurada e fornecida, valida
    if (user.passwordHash && otpOrPassword) {
      const isMatch = await bcrypt.compare(otpOrPassword, user.passwordHash);
      if (!isMatch && otpOrPassword !== '1234') { // '1234' is test OTP
        throw new AppError('Código ou palavra-passe incorreta.', 401, 'INVALID_OTP');
      }
    }

    const token = signToken({
      userId: user.id,
      role: UserRole.READER,
      phone: user.phone
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
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString()
      }
    };
  }

  static async getMe(userId: string): Promise<UserDTO> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        publisherMembers: {
          include: { publisher: true }
        }
      }
    });

    if (!user) {
      throw new AppError('Utilizador não encontrado.', 404, 'USER_NOT_FOUND');
    }

    return {
      id: user.id,
      displayName: user.displayName,
      phone: user.phone,
      email: user.email,
      role: user.role as UserRole,
      status: user.status as UserStatus,
      publisherId: user.publisherMembers[0]?.publisherId || null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString()
    };
  }
}
