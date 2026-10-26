import { Router } from 'express';
import { OfferController } from './offer.controller';
import { authenticate, optionalAuthenticate, requireRole } from '../../middlewares/auth.middleware';
import { UserRole } from '@vuka/shared';

const router = Router();

// Public / client listing of offers
router.get('/', optionalAuthenticate, OfferController.list);
router.get('/:id', optionalAuthenticate, OfferController.getById);

// Admin & Publisher Admin creation/update
router.post(
  '/',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.PUBLISHER_ADMIN),
  OfferController.create
);

router.put(
  '/:id',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.PUBLISHER_ADMIN),
  OfferController.update
);

export default router;
