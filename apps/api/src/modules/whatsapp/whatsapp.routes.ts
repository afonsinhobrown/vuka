import { Router } from 'express';
import { WhatsAppController } from './whatsapp.controller';

const router = Router();

// Webhook oficial WhatsApp (verificação e recebimento)
router.get('/webhook', WhatsAppController.verifyWebhook);
router.post('/webhook', WhatsAppController.handleWebhook);

// Endpoint direto para simulador interativo de WhatsApp
router.post('/message', WhatsAppController.handleWebhook);
router.post('/simulate-payment', WhatsAppController.simulatePayment);

export default router;
