import { Router } from 'express';
import { LibraryController } from './library.controller';
import { authenticate } from '../../middlewares/auth.middleware';

const router = Router();

// Endpoint do leitor autenticado: /api/v1/me/library
router.get('/', authenticate, LibraryController.getMyLibrary);

export default router;
