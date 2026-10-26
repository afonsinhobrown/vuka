import { Router } from 'express';
import { ReportController } from './report.controller';
import { authenticate, requireRole } from '../../middlewares/auth.middleware';
import { UserRole } from '@vuka/shared';

const router = Router();

// Relatórios de vendas (Admin e Gestores de Editora com isolamento)
router.get(
  '/sales',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.PUBLISHER_ADMIN),
  ReportController.getSales
);

// Trilha de auditoria (Admin e Gestores de Editora)
router.get(
  '/audit',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.PUBLISHER_ADMIN, UserRole.SUPPORT),
  ReportController.getAuditEvents
);

export default router;
