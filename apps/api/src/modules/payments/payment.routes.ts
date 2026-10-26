import { Router } from 'express';
import { PaymentController } from './payment.controller';
import { authenticate, requireRole } from '../../middlewares/auth.middleware';
import { UserRole } from '@vuka/shared';

const router = Router();

// Iniciar pagamento
router.post('/initiate', PaymentController.initiate);

// Webhook endpoint para fornecedores (M-Pesa, E-Mola, Mock Sandbox)
// Suporta /api/v1/payments/webhooks/:provider e /api/v1/webhooks/payments/:provider
router.post('/webhooks/:provider', PaymentController.handleWebhook);

// Correção manual de pagamentos (Apenas Administrador e Apoio com auditoria)
router.post(
  '/manual-override',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.SUPPORT),
  PaymentController.manualOverride
);

export default router;
