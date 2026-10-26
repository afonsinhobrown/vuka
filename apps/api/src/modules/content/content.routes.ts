import { Router } from 'express';
import { ContentController } from './content.controller';
import { authenticate } from '../../middlewares/auth.middleware';

const router = Router();

// 1. Pedir acesso seguro à edição (autenticado com entitlement)
router.get('/editions/:id/access', authenticate, ContentController.requestAccess);

// 2. Stream de conteúdo protegido via token assinado de curta duração
router.get('/content/stream/:token', ContentController.streamProtectedContent);

// 3. Ficheiros públicos (capas)
router.get('/assets/:id', ContentController.servePublicAsset);

export default router;
