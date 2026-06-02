import type { Request, Response, NextFunction } from "express";

interface Bucket {
  tokens: number;
  lastRefilled: number; // وقت آخر تحديث بالملي ثانية
}

const storage: Record<string, Bucket> = {};

interface RateLimiterOptions {
  maxTokens: number;
  refillRate: number;
}

export function rateLimiter(options: RateLimiterOptions) {
  const { maxTokens, refillRate } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const tenantId =
      (req.headers["x-tenant-id"] as string) ||
      (req.body.obj && req.body.obj.integration_id)?.toString() ||
      "anonymous";
    const now = Date.now();

    if (!storage[tenantId]) {
      storage[tenantId] = {
        tokens: maxTokens,
        lastRefilled: now,
      };
    }

    const bucket = storage[tenantId];

    const elapsedTimeSeconds = (now - bucket.lastRefilled) / 1000;
    const tokensToAdd = elapsedTimeSeconds * refillRate;

    bucket.tokens = Math.min(maxTokens, bucket.tokens + tokensToAdd);
    bucket.lastRefilled = now;

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;

      res.setHeader("X-RateLimit-Limit", maxTokens);
      res.setHeader("X-RateLimit-Remaining", Math.floor(bucket.tokens));

      next();
    } else {
      res.status(429).json({
        error: "Too Many Requests",
        message: `Rate limit exceeded for tenant: ${tenantId}. Please try again later.`,
      });
    }
  };
}
