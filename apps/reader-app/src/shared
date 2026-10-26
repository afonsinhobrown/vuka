import {
  UserRole,
  UserStatus,
  PublisherStatus,
  PublicationStatus,
  EditionStatus,
  OfferType,
  OfferStatus,
  OrderStatus,
  PaymentStatus,
  PaymentProvider,
  EntitlementStatus,
  AssetVisibility,
  AuditEventAction
} from './enums';

// ----------------------------------------------------
// AUTH & USERS
// ----------------------------------------------------
export interface UserDTO {
  id: string;
  displayName: string | null;
  phone: string | null;
  email: string | null;
  role: UserRole;
  status: UserStatus;
  publisherId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LoginDTO {
  identifier: string; // phone or email
  password?: string;
  otpCode?: string;
}

export interface AuthResponseDTO {
  token: string;
  user: UserDTO;
}

// ----------------------------------------------------
// PUBLISHERS & PUBLICATIONS
// ----------------------------------------------------
export interface PublisherDTO {
  id: string;
  name: string;
  slug: string;
  contactEmail: string | null;
  contactPhone: string | null;
  status: PublisherStatus;
  createdAt: string;
  publicationsCount?: number;
}

export interface PublicationDTO {
  id: string;
  publisherId: string;
  publisherName?: string;
  title: string;
  slug: string;
  description: string | null;
  coverAssetId: string | null;
  coverUrl?: string | null;
  status: PublicationStatus;
  createdAt: string;
  updatedAt: string;
  editionsCount?: number;
}

export interface EditionDTO {
  id: string;
  publicationId: string;
  publicationTitle?: string;
  publisherName?: string;
  title: string;
  editionDate: string; // YYYY-MM-DD
  contentAssetId: string;
  coverAssetId: string | null;
  coverUrl?: string | null;
  status: EditionStatus;
  publishedAt: string | null;
  createdAt: string;
  offersCount?: number;
}

// ----------------------------------------------------
// OFFERS
// ----------------------------------------------------
export interface OfferDTO {
  id: string;
  publisherId: string | null;
  publisherName?: string | null;
  type: OfferType;
  title: string;
  description: string | null;
  priceMinorUnits: number;
  currency: string;
  validityDays: number | null;
  editionId?: string | null;
  publicationId?: string | null;
  status: OfferStatus;
  createdAt: string;
}

// ----------------------------------------------------
// ORDERS & CHECKOUT
// ----------------------------------------------------
export interface CreateOrderDTO {
  offerId: string;
  buyerContact: string; // Phone number or email
  buyerName?: string;
  channel?: 'whatsapp' | 'web' | 'app';
  idempotencyKey?: string;
}

export interface OrderDTO {
  id: string;
  publicReference: string; // Ex: VUKA-9X2A8K
  userId: string | null;
  offerId: string;
  offerTitle: string;
  buyerContact: string;
  status: OrderStatus;
  currency: string;
  totalMinorUnits: number;
  offerSnapshot: Record<string, any>;
  expiresAt: string;
  createdAt: string;
  paidAt: string | null;
}

// ----------------------------------------------------
// PAYMENTS & WEBHOOKS
// ----------------------------------------------------
export interface InitiatePaymentDTO {
  orderId: string;
  provider: PaymentProvider;
  phoneNumber?: string;
}

export interface PaymentDTO {
  id: string;
  orderId: string;
  provider: PaymentProvider;
  providerReference: string | null;
  status: PaymentStatus;
  amountMinorUnits: number;
  currency: string;
  idempotencyKey: string;
  createdAt: string;
  confirmedAt: string | null;
}

export interface PaymentWebhookPayload {
  provider: PaymentProvider;
  externalEventId: string;
  orderPublicReference: string;
  providerReference: string;
  amountMinorUnits: number;
  currency: string;
  status: 'CONFIRMED' | 'FAILED';
  signature?: string;
  rawPayload?: Record<string, any>;
}

// ----------------------------------------------------
// ENTITLEMENTS & LIBRARY
// ----------------------------------------------------
export interface EntitlementDTO {
  id: string;
  userId: string;
  orderId: string | null;
  editionId: string | null;
  publicationId: string | null;
  startsAt: string;
  endsAt: string | null; // null = lifetime access to that edition
  status: EntitlementStatus;
  createdAt: string;
}

export interface LibraryItemDTO {
  entitlementId: string;
  editionId: string;
  title: string;
  editionDate: string;
  publicationTitle: string;
  publisherName: string;
  coverUrl: string | null;
  accessStatus: EntitlementStatus;
  endsAt: string | null;
  isExpired: boolean;
}

export interface SecureReadAccessDTO {
  editionId: string;
  title: string;
  readUrl: string;
  expiresInSeconds: number;
}

// ----------------------------------------------------
// AUDIT & REPORTS
// ----------------------------------------------------
export interface AuditEventDTO {
  id: string;
  actorUserId: string | null;
  actorName?: string | null;
  publisherId: string | null;
  action: AuditEventAction;
  entityType: string;
  entityId: string;
  reason: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
}

export interface SalesReportDTO {
  totalRevenueMinorUnits: number;
  totalOrders: number;
  paidOrders: number;
  currency: string;
  byPublisher: Array<{
    publisherId: string;
    publisherName: string;
    ordersCount: number;
    revenueMinorUnits: number;
  }>;
  byPublication: Array<{
    publicationId: string;
    publicationTitle: string;
    ordersCount: number;
    revenueMinorUnits: number;
  }>;
  byPeriod: Array<{
    date: string;
    revenueMinorUnits: number;
    ordersCount: number;
  }>;
}

// ----------------------------------------------------
// WHATSAPP CONVERSATIONAL
// ----------------------------------------------------
export interface WhatsAppMessage {
  from: string; // Phone number e.g. "258841234567"
  text?: string;
  interactiveButtonId?: string;
}

export interface WhatsAppResponse {
  to: string;
  text: string;
  buttons?: Array<{ id: string; title: string }>;
  paymentInstructions?: {
    reference: string;
    amountFormatted: string;
    provider: string;
  };
}
