import { Router } from 'express';
import { PublisherController } from './publisher.controller';
import { authenticate, optionalAuthenticate, requireRole, requirePublisherAccess } from '../../middlewares/auth.middleware';
import { UserRole } from '@vuka/shared';

const router = Router();

// Planos de subscrição (público) — tabela de preços
router.get('/plans', PublisherController.listPlans);

// Subscrição do próprio jornal
router.get('/me/subscription', authenticate, PublisherController.getMySubscription);
router.get('/me/invoices', authenticate, PublisherController.listMyInvoices);

// Renovação automática (cron diário da Vercel ou administrador)
router.get('/subscriptions/run-renewals', optionalAuthenticate, PublisherController.runRenewals);

// Marcar factura como paga (confirmação manual, ADMIN)
router.post('/invoices/:id/mark-paid', authenticate, requireRole(UserRole.ADMIN), PublisherController.markInvoicePaid);

// Auto-registo de um jornal (público, mas exige código de convite)
router.post('/register', PublisherController.register);

// Convites de registo (apenas administrador do sistema)
router.get('/invites', authenticate, requireRole(UserRole.ADMIN), PublisherController.listInvites);
router.post('/invites', authenticate, requireRole(UserRole.ADMIN), PublisherController.createInvite);
router.delete(
  '/invites/:id',
  authenticate,
  requireRole(UserRole.ADMIN),
  PublisherController.revokeInvite
);

// Public/authenticated listing
router.get('/', authenticate, PublisherController.list);
router.get('/:id', authenticate, requirePublisherAccess('id'), PublisherController.getById);

// Admin only: create publisher
router.post('/', authenticate, requireRole(UserRole.ADMIN), PublisherController.create);

// Update publisher: Global Admin or Publisher Admin of that publisher
router.put('/:id', authenticate, requireRole(UserRole.ADMIN, UserRole.PUBLISHER_ADMIN), requirePublisherAccess('id'), PublisherController.update);

// List members of publisher
router.get('/:id/members', authenticate, requirePublisherAccess('id'), PublisherController.listMembers);

// Subscrição de uma editora (apenas administrador)
router.get('/:id/subscription', authenticate, requireRole(UserRole.ADMIN), PublisherController.getSubscription);
router.put(
  '/:id/subscription',
  authenticate,
  requireRole(UserRole.ADMIN),
  PublisherController.updateSubscription
);

// Facturas de uma editora (apenas administrador)
router.get('/:id/invoices', authenticate, requireRole(UserRole.ADMIN), PublisherController.listInvoices);
router.post('/:id/invoices', authenticate, requireRole(UserRole.ADMIN), PublisherController.createInvoice);

export default router;
