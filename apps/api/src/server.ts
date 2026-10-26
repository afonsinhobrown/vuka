import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

import authRoutes from './modules/auth/auth.routes';
import publisherRoutes from './modules/publishers/publisher.routes';
import catalogRoutes from './modules/catalog/catalog.routes';
import offerRoutes from './modules/offers/offer.routes';
import orderRoutes from './modules/orders/order.routes';
import paymentRoutes from './modules/payments/payment.routes';
import libraryRoutes from './modules/library/library.routes';
import contentRoutes from './modules/content/content.routes';
import whatsappRoutes from './modules/whatsapp/whatsapp.routes';
import reportRoutes from './modules/reports/report.routes';
import { errorMiddleware } from './middlewares/error.middleware';

const app = express();
const PORT = process.env.PORT || 4000;

// Security and utility middlewares
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'vuka-api',
    version: '1.0.0'
  });
});

// API Routes Mounting
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/publishers', publisherRoutes);
app.use('/api/v1/catalog', catalogRoutes);
app.use('/api/v1/offers', offerRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/webhooks/payments', paymentRoutes);
app.use('/api/v1/me/library', libraryRoutes);
app.use('/api/v1', contentRoutes);
app.use('/api/v1/whatsapp', whatsappRoutes);
app.use('/api/v1/admin/reports', reportRoutes);

// Error Middleware (Standard RFC format for VUKA)
app.use(errorMiddleware);

app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`🚀 VUKA Core API rodando na porta ${PORT}`);
  console.log(`📍 Endpoint base: http://localhost:${PORT}/api/v1`);
  console.log(`🟢 Base de Dados: PostgreSQL (Neon Cloud)`);
  console.log(`=========================================`);
});

export default app;
