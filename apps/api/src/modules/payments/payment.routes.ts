import { Router } from 'express';
import { PaymentController } from './payment.controller';
import { authenticate, requireRole } from '../../middlewares/auth.middleware';
import { UserRole } from '@vuka/shared';

const router = Router();

// Iniciar pagamento
router.post('/initiate', PaymentController.initiate);

// Iniciar pagamento via PaySuite (M-Pesa, E-Mola, Cartões)
router.post('/paysuite/initiate', PaymentController.initiatePaySuite);

// Webhook endpoint oficial do PaySuite
router.post('/webhook/paysuite', PaymentController.handlePaySuiteWebhook);

// Webhook endpoint genérico para fornecedores (M-Pesa, E-Mola, Mock Sandbox)
router.post('/webhooks/:provider', PaymentController.handleWebhook);

// Correção manual de pagamentos (Apenas Administrador e Apoio com auditoria)
router.post(
  '/manual-override',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.SUPPORT),
  PaymentController.manualOverride
);

export default router;
