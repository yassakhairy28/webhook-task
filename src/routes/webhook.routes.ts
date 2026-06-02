import { Router } from "express";
import { rateLimiter } from "../middlewares/rateLimiter.middleware.js";
import { verifyPaymobSignature } from "../middlewares/paymobAuth.middleware.js";
import { handlePaymobWebhook } from "../controllers/webhook.controller.js";

const router = Router();

const PAYMOB_SECRET_KEY = process.env.PAYMOB_SECRET_KEY || "secret_hmac_key";

router.post(
  "/webhooks",
  rateLimiter({ maxTokens: 5, refillRate: 2 }),
  verifyPaymobSignature(PAYMOB_SECRET_KEY),
  handlePaymobWebhook,
);

export { router as webhookRouter };
