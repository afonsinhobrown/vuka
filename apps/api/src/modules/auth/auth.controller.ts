import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';

export class AuthController {
  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { identifier, password } = req.body;
      if (!identifier || !password) {
        return res.status(400).json({
          error: { code: 'MISSING_FIELDS', message: 'Identificador e palavra-passe são obrigatórios.' }
        });
      }

      const result = await AuthService.loginWithPassword(identifier, password);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async readerAuth(req: Request, res: Response, next: NextFunction) {
    try {
      const { phone, otpCode } = req.body;
      if (!phone) {
        return res.status(400).json({
          error: { code: 'MISSING_PHONE', message: 'Número de telefone é obrigatório.' }
        });
      }

      const result = await AuthService.readerPhoneAuth(phone, otpCode);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async me(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user?.userId) {
        return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Não autenticado' } });
      }
      const user = await AuthService.getMe(req.user.userId);
      return res.status(200).json({ user });
    } catch (error) {
      next(error);
    }
  }
}
