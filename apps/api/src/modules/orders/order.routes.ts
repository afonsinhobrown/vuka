import { Router } from 'express';
import { OrderController } from './order.controller';
import { authenticate, optionalAuthenticate, requireRole } from '../../middlewares/auth.middleware';
import { UserRole } from '@vuka/shared';

const router = Router();

// Create order (from WhatsApp bot or web/reader client)
router.post('/', optionalAuthenticate, OrderController.create);

// Get order by public reference or ID
router.get('/:id', optionalAuthenticate, OrderController.getById);

// Admin & publisher staff listing of orders
router.get(
  '/',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.PUBLISHER_ADMIN, UserRole.SUPPORT),
  OrderController.list
);

export default router;
