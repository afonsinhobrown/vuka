import { prisma } from '../../lib/prisma';
import { OrderService } from '../orders/order.service';
import { formatMoney } from '@vuka/shared';
import { PaymentService } from '../payments/payment.service';
import { PaymentProvider } from '@vuka/shared';

export interface ConversationalState {
  step: 'MENU' | 'SELECT_PUBLICATION' | 'SELECT_OFFER' | 'AWAITING_PAYMENT';
  publicationId?: string;
  orderId?: string;
  orderReference?: string;
}

// In-memory session store for WhatsApp conversational bot
const conversationSessions: Map<string, ConversationalState> = new Map();

export class WhatsAppService {
  /**
   * Processa uma mensagem recebida de um leitor pelo canal WhatsApp
   */
  static async handleIncomingMessage(senderPhone: string, rawText: string) {
    const text = rawText.trim().toLowerCase();
    const cleanPhone = senderPhone.replace(/\D/g, '');
    let state = conversationSessions.get(cleanPhone) || { step: 'MENU' };

    // Reset se o utilizador digitar "menu", "ola", "oi", "inicio"
    if (['menu', 'ola', 'olá', 'oi', 'inicio', 'início', 'vuka'].includes(text)) {
      state = { step: 'SELECT_PUBLICATION' };
      conversationSessions.set(cleanPhone, state);

      const publications = await prisma.publication.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { title: 'asc' },
        include: { publisher: true }
      });

      let reply = `📰 *BEM-VINDO À VUKA* 📰\nA sua banca digital de jornais e revistas em Moçambique.\n\nEscolha a publicação que deseja ler:\n\n`;
      publications.forEach((pub, index) => {
        reply += `*${index + 1}* - ${pub.title} (${pub.publisher.name})\n`;
      });
      reply += `\n_Responda com o número correspondente (ex: 1)_`;

      return { to: cleanPhone, reply };
    }

    // Passo 1: Selecionou a Publicação
    if (state.step === 'SELECT_PUBLICATION') {
      const selectionIndex = parseInt(text, 10) - 1;
      const publications = await prisma.publication.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { title: 'asc' }
      });

      if (isNaN(selectionIndex) || selectionIndex < 0 || selectionIndex >= publications.length) {
        return {
          to: cleanPhone,
          reply: `Opção inválida. Por favor responda com o número de 1 a ${publications.length}, ou digite *MENU*.`
        };
      }

      const selectedPub = publications[selectionIndex];
      const offers = await prisma.offer.findMany({
        where: {
          publicationId: selectedPub.id,
          status: 'ACTIVE'
        },
        orderBy: { priceMinorUnits: 'asc' }
      });

      if (offers.length === 0) {
        return {
          to: cleanPhone,
          reply: `De momento não existem ofertas disponíveis para *${selectedPub.title}*. Digite *MENU* para escolher outro jornal.`
        };
      }

      state.publicationId = selectedPub.id;
      state.step = 'SELECT_OFFER';
      conversationSessions.set(cleanPhone, state);

      let reply = `🗞️ *${selectedPub.title}*\nEscolha a sua opção de leitura:\n\n`;
      offers.forEach((offer, index) => {
        const priceFormatted = formatMoney(offer.priceMinorUnits, offer.currency);
        const typeLabel = offer.type === 'SINGLE_EDITION' ? 'Edição Avulsa' : 'Assinatura';
        reply += `*${index + 1}* - ${offer.title} (${typeLabel}): *${priceFormatted}*\n`;
      });
      reply += `\n_Responda com o número da opção desejada._`;

      return { to: cleanPhone, reply };
    }

    // Passo 2: Selecionou a Oferta -> Criar Pedido
    if (state.step === 'SELECT_OFFER') {
      const selectionIndex = parseInt(text, 10) - 1;
      const offers = await prisma.offer.findMany({
        where: {
          publicationId: state.publicationId,
          status: 'ACTIVE'
        },
        orderBy: { priceMinorUnits: 'asc' },
        include: { publication: true }
      });

      if (isNaN(selectionIndex) || selectionIndex < 0 || selectionIndex >= offers.length) {
        return {
          to: cleanPhone,
          reply: `Opção inválida. Digite o número da oferta ou *MENU* para recomeçar.`
        };
      }

      const selectedOffer = offers[selectionIndex];

      // Cria pedido via OrderService com congelamento de preço
      const order = await OrderService.createOrder({
        offerId: selectedOffer.id,
        buyerContact: cleanPhone,
        channel: 'whatsapp'
      });

      state.step = 'AWAITING_PAYMENT';
      state.orderId = order.id;
      state.orderReference = order.publicReference;
      conversationSessions.set(cleanPhone, state);

      const priceFormatted = formatMoney(order.totalMinorUnits, order.currency);

      const reply = `✅ *PEDIDO CRIADO COM SUCESSO!*\n\n` +
        `📦 *Oferta:* ${selectedOffer.title}\n` +
        `🔖 *Referência do Pedido:* *${order.publicReference}*\n` +
        `💰 *Total a pagar:* *${priceFormatted}*\n\n` +
        `📲 *INSTRUÇÕES DE PAGAMENTO (M-Pesa / E-Mola):*\n` +
        `1. Selecione Transferir / Pagar Serviços\n` +
        `2. Número do destinatário / Entidade: *84 000 0000* (VUKA Pay)\n` +
        `3. Referência: *${order.publicReference}*\n` +
        `4. Valor: *${priceFormatted}*\n\n` +
        `Assim que o pagamento for validado, você receberá a confirmação imediata aqui com o link para ler na app!`;

      return {
        to: cleanPhone,
        reply,
        orderId: order.id,
        orderReference: order.publicReference
      };
    }

    return {
      to: cleanPhone,
      reply: `Olá! Digite *MENU* para ver os jornais e edições disponíveis para leitura.`
    };
  }

  /**
   * Simula a confirmação de pagamento para um pedido e notifica o leitor
   */
  static async simulatePaymentAndNotify(orderReference: string) {
    const order = await prisma.order.findUnique({
      where: { publicReference: orderReference },
      include: { offer: true }
    });

    if (!order) {
      throw new Error('Pedido não encontrado.');
    }

    // Executa webhook idempotente
    const result = await PaymentService.processWebhook({
      provider: PaymentProvider.MOCK_SANDBOX,
      externalEventId: `sim_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      orderPublicReference: order.publicReference,
      providerReference: `MOCK_TX_${Math.floor(100000 + Math.random() * 900000)}`,
      amountMinorUnits: order.totalMinorUnits,
      currency: order.currency,
      status: 'CONFIRMED',
      rawPayload: { simulated: true }
    });

    const readerAppUrl = process.env.READER_APP_URL || 'http://localhost:5173';
    const message = `🎉 *PAGAMENTO CONFIRMADO!* 🎉\n\n` +
      `O seu pedido *${order.publicReference}* foi processado com sucesso.\n` +
      `O seu acesso já está ativo na sua biblioteca pessoal!\n\n` +
      `📖 *Aceda à App VUKA para começar a ler:* \n${readerAppUrl}\n\n` +
      `_Inicie sessão com o seu número de telefone (${order.buyerContact}). Boa leitura!_`;

    return {
      orderReference: order.publicReference,
      status: 'PAID',
      messageToUser: message,
      result
    };
  }
}
