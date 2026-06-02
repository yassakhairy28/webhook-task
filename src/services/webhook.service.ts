import { WebhookEventModel } from "../DB/models/webhook.event.model.js";
import type { IWebhookEventDocument } from "../types/webhook.event.types.js";

export class WebhookService {
  private async mockDownstreamService(
    event: IWebhookEventDocument,
  ): Promise<void> {
    const randomNumber = Math.random();
    console.log(
      `[Downstream] Processing event ${event.eventId}. Random threshold: ${randomNumber.toFixed(2)}`,
    );

    if (randomNumber < 0.3) {
      throw new Error(
        "Downstream service internal failure (30% chance triggered)",
      );
    }

    // لو نجح، بنعتبره خلص بنجاح
    console.log(`[Downstream] Event ${event.eventId} processed successfully!`);
  }

  private calculateNextRetry(retryCount: number): Date {
    const baseDelay = 1000;
    const maxDelay = 60000;

    const exponentialDelay = Math.min(
      maxDelay,
      baseDelay * Math.pow(2, retryCount),
    );

    const jitter = Math.random() * 1000;

    return new Date(Date.now() + exponentialDelay + jitter);
  }

  public async processPendingEvents(): Promise<void> {
    const now = new Date();
    const eventsToProcess = await WebhookEventModel.find({
      status: { $in: ["pending", "failed"] },
      $or: [{ nextRetryAt: null }, { nextRetryAt: { $lte: now } }],
    }).limit(10);

    for (const event of eventsToProcess) {
      try {
        event.status = "processing";
        await event.save();

        // إرسال للـ Downstream
        await this.mockDownstreamService(event);

        event.status = "completed";
        event.errorMessage = null;
        await event.save();
      } catch (error: unknown) {
        const err = error as Error;
        console.error(
          `[Worker Error] Event ${event.eventId} failed. Attempt #${event.retryCount + 1}`,
        );

        event.retryCount += 1;

        if (event.retryCount >= 5) {
          event.status = "dlq"; // Dead Letter Queue
          event.errorMessage = `Max retries reached. Original Error: ${err.message}`;
          event.nextRetryAt = null;
        } else {
          event.status = "failed";
          event.errorMessage = err.message;
          event.nextRetryAt = this.calculateNextRetry(event.retryCount);
        }

        await event.save();
      }
    }
  }
}

// تصدير نسخة واحدة من السيرفيس (Singleton) لضمان اتساق البيانات
export const webhookService = new WebhookService();
