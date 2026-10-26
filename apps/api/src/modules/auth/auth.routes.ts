import { Router } from 'express';
import { AuthController } from './auth.controller';
import { authenticate } from '../../middlewares/auth.middleware';

const router = Router();

router.post('/login', AuthController.login);
router.post('/reader-auth', AuthController.readerAuth);
router.get('/me', authenticate, AuthController.me);

export default router;
