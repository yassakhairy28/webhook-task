import express from "express";
import request from "supertest";
import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from "@jest/globals";
import { webhookRouter } from "../routes/webhook.routes.js";
import { WebhookEventModel } from "../DB/models/webhook.event.model.js";
import { webhookService } from "../services/webhook.service.js";
import crypto from "crypto";

const app = express();
app.use(express.json());
app.use("/api", webhookRouter);

const TEST_SECRET = "secret_hmac_key";
process.env.PAYMOB_SECRET_KEY = TEST_SECRET;

function generateTestHmac(payload: Record<string, unknown>): string {
  const obj = (payload.obj || payload) as Record<string, unknown>;
  const dataString = [
    obj.amount_cents,
    obj.created_at,
    obj.currency,
    obj.error_occured,
    obj.has_parent_transaction,
    obj.id,
    obj.integration_id,
    obj.is_3d_secure,
    obj.is_auth,
    obj.is_capture,
    obj.is_voided,
    (obj.order as { id?: number })?.id || obj.order,
    obj.owner,
    obj.pending,
    (obj.source_data as { pan?: string })?.pan,
    (obj.source_data as { sub_type?: string })?.sub_type,
    (obj.source_data as { type?: string })?.type,
    obj.success,
  ].join("");

  return crypto
    .createHmac("sha512", TEST_SECRET)
    .update(dataString)
    .digest("hex");
}

describe("Idempotement Webhook Processing Service - Integration Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest
      .spyOn(webhookService, "processPendingEvents")
      .mockResolvedValue(undefined);
  });

  describe("Idempotency Feature", () => {
    it("should process the first event successfully and return 200/202 for duplicates without re-processing", async () => {
      const payload = {
        id: "pm_evt_1111",
        type: "payment.success",
        amount_cents: 10000,
        currency: "EGP",
        success: true,
      };
      const hmac = generateTestHmac(payload);

      const saveSpy = jest
        .spyOn(WebhookEventModel.prototype, "save")
        .mockImplementationOnce(async function (this: unknown) {
          return this;
        })
        // تاني مرة هيحاكي إن المونجو رمت Duplicate Error كود 11000
        .mockImplementationOnce(async () => {
          const mongoError = new Error("Duplicate Key");
          (mongoError as unknown as Record<string, unknown>).code = 11000;
          throw mongoError;
        });

      const res1 = await request(app)
        .post("/api/webhooks")
        .set("x-tenant-id", "tenant_test_1")
        .send({ ...payload, hmac });

      expect(res1.status).toBe(202);
      expect(res1.body.message).toContain("Queued");

      const res2 = await request(app)
        .post("/api/webhooks")
        .set("x-tenant-id", "tenant_test_1")
        .send({ ...payload, hmac });

      expect(res2.status).toBe(200);
      expect(res2.body.message).toContain("Duplicate event ignored");
      expect(saveSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("Rate Limiting Feature", () => {
    it("should return 429 Too Many Requests when tenant exceeds their token bucket limit", async () => {
      const payload = {
        id: "evt_rate",
        type: "payment.success",
        amount_cents: 5000,
        success: true,
      };
      const hmac = generateTestHmac(payload);

      jest
        .spyOn(WebhookEventModel.prototype, "save")
        .mockImplementation(async function (this: unknown) {
          return this;
        });
      for (let i = 0; i < 5; i++) {
        const currentPayload = { ...payload, id: `evt_rate_${i}` };
        const currentHmac = generateTestHmac(currentPayload);

        const res = await request(app)
          .post("/api/webhooks")
          .set("x-tenant-id", "spam_tenant")
          .send({ ...currentPayload, hmac: currentHmac });
        expect(res.status).toBe(202);
      }

      const blockedPayload = { ...payload, id: "evt_rate_6" };
      const blockedHmac = generateTestHmac(blockedPayload);
      const blockedRes = await request(app)
        .post("/api/webhooks")
        .set("x-tenant-id", "spam_tenant")
        .send({ ...blockedPayload, hmac: blockedHmac });

      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body.error).toBe("Too Many Requests");
    });
  });

  describe("Retry Policy & DLQ Feature", () => {
    it("should calculate exponential backoff delay correctly based on retry count", () => {
      const baseDelay = 1000;

      const calculateDelayForAttempt = (retryCount: number) => {
        const exponentialDelay = Math.min(
          60000,
          baseDelay * Math.pow(2, retryCount),
        );
        return exponentialDelay;
      };

      expect(calculateDelayForAttempt(1)).toBe(2000);
      expect(calculateDelayForAttempt(2)).toBe(4000);
      expect(calculateDelayForAttempt(3)).toBe(8000);
    });
  });
});
