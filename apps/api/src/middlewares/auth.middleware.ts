import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../lib/jwt';
import { prisma } from '../lib/prisma';
import { AppError } from './error.middleware';
import { UserRole } from '@vuka/shared';

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload & {
        dbUser?: any;
      };
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Autenticação necessária. Token não fornecido.', 401, 'UNAUTHORIZED');
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { publisherMembers: true }
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new AppError('Utilizador inválido ou inativo.', 401, 'USER_INACTIVE');
    }

    // Attach user info to request
    const publisherMember = user.publisherMembers[0];
    req.user = {
      ...payload,
      publisherId: publisherMember ? publisherMember.publisherId : payload.publisherId,
      dbUser: user
    };

    next();
  } catch (error: any) {
    if (error instanceof AppError) return next(error);
    return next(new AppError('Token inválido ou expirado.', 401, 'INVALID_TOKEN'));
  }
}

export function optionalAuthenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  try {
    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);
    req.user = payload;
  } catch {
    // Ignore invalid optional token
  }
  next();
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Acesso não autenticado.', 401, 'UNAUTHORIZED'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError('Permissão insuficiente para aceder a este recurso.', 403, 'FORBIDDEN'));
    }

    next();
  };
}

export function requirePublisherAccess(paramName = 'publisherId') {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Acesso não autenticado.', 401, 'UNAUTHORIZED'));
    }

    // Global admin can access all publishers
    if (req.user.role === UserRole.ADMIN) {
      return next();
    }

    const targetPublisherId = req.params[paramName] || req.body[paramName] || req.query[paramName];

    if (!targetPublisherId || req.user.publisherId !== targetPublisherId) {
      return next(
        new AppError('Acesso negado: não tem permissão para gerir esta editora.', 403, 'PUBLISHER_ACCESS_DENIED')
      );
    }

    next();
  };
}
