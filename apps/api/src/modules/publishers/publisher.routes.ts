import { Router } from 'express';
import { PublisherController } from './publisher.controller';
import { authenticate, requireRole, requirePublisherAccess } from '../../middlewares/auth.middleware';
import { UserRole } from '@vuka/shared';

const router = Router();

// Public/authenticated listing
router.get('/', authenticate, PublisherController.list);
router.get('/:id', authenticate, requirePublisherAccess('id'), PublisherController.getById);

// Admin only: create publisher
router.post('/', authenticate, requireRole(UserRole.ADMIN), PublisherController.create);

// Update publisher: Global Admin or Publisher Admin of that publisher
router.put('/:id', authenticate, requireRole(UserRole.ADMIN, UserRole.PUBLISHER_ADMIN), requirePublisherAccess('id'), PublisherController.update);

// List members of publisher
router.get('/:id/members', authenticate, requirePublisherAccess('id'), PublisherController.listMembers);

export default router;
