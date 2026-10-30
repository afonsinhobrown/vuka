import { Router } from 'express';
import { CatalogController } from './catalog.controller';
import { authenticate, optionalAuthenticate, requireRole } from '../../middlewares/auth.middleware';
import { UserRole } from '@vuka/shared';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const STORAGE_DIR = process.env.STORAGE_DIR || './storage';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const isPublic = req.body.isPublic === 'true' || file.mimetype.startsWith('image/');
    const targetFolder = isPublic ? path.join(STORAGE_DIR, 'public') : path.join(STORAGE_DIR, 'private');
    cb(null, targetFolder);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max
});

const router = Router();

// Public endpoints
router.get('/', CatalogController.getPublicCatalog);
router.get('/publications/:id', optionalAuthenticate, CatalogController.getPublicationById);

// Protected management endpoints (isolated by publisher)
router.get(
  '/manage/publications',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.PUBLISHER_ADMIN, UserRole.PUBLISHER_EDITOR),
  CatalogController.getManageableCatalog
);

// Protected endpoints for editors and admins
router.post(
  '/publications',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.PUBLISHER_ADMIN),
  CatalogController.createPublication
);
router.put(
  '/publications/:id',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.PUBLISHER_ADMIN),
  CatalogController.updatePublication
);

router.post(
  '/editions',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.PUBLISHER_ADMIN, UserRole.PUBLISHER_EDITOR),
  CatalogController.createEdition
);
router.post(
  '/editions/:id/publish',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.PUBLISHER_ADMIN),
  CatalogController.publishEdition
);
router.post(
  '/editions/:id/withdraw',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.PUBLISHER_ADMIN),
  CatalogController.withdrawEdition
);

// File uploads
// Upload directo para object storage (R2): 1) presign 2) PUT do browser 3) complete
router.post(
  '/upload/presign',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.PUBLISHER_ADMIN, UserRole.PUBLISHER_EDITOR),
  CatalogController.presignUpload
);
router.post(
  '/upload/complete',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.PUBLISHER_ADMIN, UserRole.PUBLISHER_EDITOR),
  CatalogController.completeUpload
);

// Upload multipart local (fallback de desenvolvimento, sem R2 configurado)
router.post(
  '/upload',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.PUBLISHER_ADMIN, UserRole.PUBLISHER_EDITOR),
  upload.single('file'),
  CatalogController.uploadAsset
);

export default router;
