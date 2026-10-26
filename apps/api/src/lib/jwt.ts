import jwt from 'jsonwebtoken';
import { UserRole } from '@vuka/shared';

const JWT_SECRET = process.env.JWT_SECRET || 'vuka_default_jwt_secret_change_me';
const JWT_EXPIRES_IN = '7d';

export interface JwtPayload {
  userId: string;
  role: UserRole;
  phone?: string | null;
  email?: string | null;
  publisherId?: string | null;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}
