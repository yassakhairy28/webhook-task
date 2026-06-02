export type EventType = "payment.success" | "payment.failed" | "wallet.payout";

export interface BaseEvent {
  id: string;
  tenantId: string;
  createdAt: string;
}

export interface PaymentSuccessEvent extends BaseEvent {
  type: "payment.success";
  data: {
    transactionId: number;
    amountCents: number;
    currency: string;
    orderId: number;
  };
}

export interface PaymentFailedEvent extends BaseEvent {
  type: "payment.failed";
  data: {
    transactionId: number;
    reason: string;
    orderId: number;
  };
}

export interface WalletPayoutEvent extends BaseEvent {
  type: "wallet.payout";
  data: {
    payoutId: string;
    walletNumber: string;
    amount: number;
  };
}

export type PaymobWebhookEvent =
  | PaymentSuccessEvent
  | PaymentFailedEvent
  | WalletPayoutEvent;

export type WebhookStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "dlq";
