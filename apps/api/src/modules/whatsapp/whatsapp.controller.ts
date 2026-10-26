import { Request, Response, NextFunction } from 'express';
import { WhatsAppService } from './whatsapp.service';

const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'vuka_whatsapp_webhook_token_2026';

export class WhatsAppController {
  /**
   * Validação de Webhook do WhatsApp (Meta Cloud API standard challenge)
   */
  static verifyWebhook(req: Request, res: Response) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).json({ error: 'Token de verificação inválido.' });
  }

  /**
   * Recebimento de mensagens do WhatsApp
   */
  static async handleWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const { from, text } = req.body;
      const senderPhone = from || req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from;
      const messageText = text || req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.text?.body || 'menu';

      if (!senderPhone) {
        return res.status(400).json({ error: 'Número de telefone remetente não identificado.' });
      }

      const response = await WhatsAppService.handleIncomingMessage(senderPhone, messageText);
      return res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Simulação interativa de pagamento e notificação automática
   */
  static async simulatePayment(req: Request, res: Response, next: NextFunction) {
    try {
      const { orderReference } = req.body;
      if (!orderReference) {
        return res.status(400).json({ error: 'Referência do pedido (orderReference) é obrigatória.' });
      }

      const result = await WhatsAppService.simulatePaymentAndNotify(orderReference);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}
