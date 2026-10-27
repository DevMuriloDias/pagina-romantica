export type ProviderStatus =
  | "pending"
  | "approved"
  | "authorized"
  | "in_process"
  | "in_mediation"
  | "rejected"
  | "cancelled"
  | "refunded"
  | "charged_back";

export interface ProviderPayment {
  id: string;
  status: ProviderStatus;
  statusDetail: string | null;
  externalReference: string | null;
  amountCents: number;
  method: "pix" | "card";
  qrCode?: string | null;
  qrBase64?: string | null;
  expiresAt?: Date | null;
}

export interface CreatePixInput {
  amountCents: number;
  description: string;
  email: string;
  idempotencyKey: string;
  externalReference: string;
  expiresAt: Date;
  notificationUrl?: string;
}

export interface CreateCardInput {
  amountCents: number;
  description: string;
  token: string;
  paymentMethodId: string;
  issuerId?: string;
  installments: number;
  payer: { email: string; identification?: { type: string; number: string } };
  idempotencyKey: string;
  externalReference: string;
  notificationUrl?: string;
}

export interface PaymentProvider {
  name: "mercadopago" | "mock";
  createPix(input: CreatePixInput): Promise<ProviderPayment>;
  createCard(input: CreateCardInput): Promise<ProviderPayment>;
  getPayment(id: string): Promise<ProviderPayment>;
  refund(id: string): Promise<void>;
}
