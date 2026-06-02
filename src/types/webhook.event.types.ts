import type { Document } from "mongoose";
import type { PaymobWebhookEvent, WebhookStatus } from "./webhook.types.js";

export interface IWebhookEventDocument extends Document {
  eventId: string;
  tenantId: string;
  type: PaymobWebhookEvent["type"];
  payload: PaymobWebhookEvent;
  status: WebhookStatus;
  retryCount: number;
  nextRetryAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}
