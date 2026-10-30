import { Router } from 'express';
import { ArticlesController } from './articles.controller';
import { authenticate, requireRole } from '../../middlewares/auth.middleware';
import { UserRole } from '@vuka/shared';

const router = Router();

// Público
router.get('/', ArticlesController.listPublic);
router.get('/slug/:slug', ArticlesController.getBySlug);
router.get('/:id/read', authenticate, ArticlesController.readArticle);

// Admin / Gestão
router.get('/admin/list', authenticate, requireRole(UserRole.ADMIN, UserRole.PUBLISHER_ADMIN), ArticlesController.adminList);
router.post('/admin', authenticate, requireRole(UserRole.ADMIN, UserRole.PUBLISHER_ADMIN), ArticlesController.adminCreate);
router.put('/admin/:id', authenticate, requireRole(UserRole.ADMIN, UserRole.PUBLISHER_ADMIN), ArticlesController.adminUpdate);
router.post('/admin/:id/publish', authenticate, requireRole(UserRole.ADMIN, UserRole.PUBLISHER_ADMIN), ArticlesController.adminPublish);
router.delete('/admin/:id', authenticate, requireRole(UserRole.ADMIN), ArticlesController.adminRemove);

export default router;
