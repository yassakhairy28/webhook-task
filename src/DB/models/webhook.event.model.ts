import { Schema, model } from "mongoose";
import type { IWebhookEventDocument } from "../../types/webhook.event.types.js";

const WebhookEventSchema = new Schema<IWebhookEventDocument>(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
    },
    tenantId: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: ["payment.success", "payment.failed", "wallet.payout"],
    },
    payload: { type: Schema.Types.Mixed, required: true },
    status: {
      type: String,
      required: true,
      enum: ["pending", "processing", "completed", "failed", "dlq"],
      default: "pending",
    },
    retryCount: { type: Number, required: true, default: 0 },
    nextRetryAt: { type: Date, default: null },
    errorMessage: { type: String, default: null },
  },
  {
    timestamps: true,
  },
);

WebhookEventSchema.index({ status: 1, nextRetryAt: 1 });

export const WebhookEventModel = model<IWebhookEventDocument>(
  "WebhookEvent",
  WebhookEventSchema,
);
