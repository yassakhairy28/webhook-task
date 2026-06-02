import type { Request, Response } from "express";
import { WebhookEventModel } from "../DB/models/webhook.event.model.js";
import type { PaymobWebhookEvent } from "../types/webhook.types.js";
import { webhookService } from "../services/webhook.service.js";

export async function handlePaymobWebhook(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const payload = req.body as PaymobWebhookEvent;

    const eventId = payload.id || (req.body.obj && req.body.obj.id)?.toString();
    const tenantId = (req.headers["x-tenant-id"] as string) || "default_tenant";
    const eventType = payload.type;

    if (!eventId) {
      res.status(400).json({ error: "Bad Request: Missing Event ID" });
      return;
    }

    const newEvent = new WebhookEventModel({
      eventId,
      tenantId,
      type: eventType,
      payload,
      status: "pending",
      retryCount: 0,
      nextRetryAt: new Date(),
    });

    await newEvent.save();

    res.status(202).json({ success: true, message: "Queued" });

    webhookService.processPendingEvents().catch((err) => {
      console.error("Background processing error:", err);
    });
  } catch (error: unknown) {
    const mongoError = error as { code?: number };
    if (mongoError.code === 11000) {
      console.warn(
        `[Idempotency Warning]: Duplicate event detected and ignored: ${req.body.id}`,
      );
      res.status(200).json({
        success: true,
        message: "Duplicate event ignored (already processed or processing).",
      });
      return;
    }

    console.error("System Error in Webhook Controller:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
