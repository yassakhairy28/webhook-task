import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";

export function verifyPaymobSignature(secretKey: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const receivedHmac =
      (req.query.hmac as string) || (req.body.hmac as string);

    if (!receivedHmac) {
      res.status(401).json({ error: "Unauthorized: Missing HMAC signature" });
      return;
    }
    const obj = req.body.obj || req.body;

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
      obj.order?.id || obj.order,
      obj.owner,
      obj.pending,
      obj.source_data?.pan,
      obj.source_data?.sub_type,
      obj.source_data?.type,
      obj.success,
    ].join("");

    const calculatedHmac = crypto
      .createHmac("sha512", secretKey)
      .update(dataString)
      .digest("hex");

    const isMatch = crypto.timingSafeEqual(
      Buffer.from(receivedHmac, "utf-8"),
      Buffer.from(calculatedHmac, "utf-8"),
    );

    if (!isMatch) {
      res.status(401).json({ error: "Unauthorized: Invalid signature" });
      return;
    }

    next();
  };
}
