# Idempotent Webhook Processing Service

مشروع Node.js + TypeScript لاستقبال ومعالجة ويبهوكس آمن وموثوق.

## نظرة عامة

- يستقبل endpoint ويبهوكس على `POST /api/webhooks`.
- يستخدم `HMAC SHA-512` للتحقق من التوقيع قبل المعالجة.
- يضمن idempotency عن طريق `eventId` فريد في قاعدة البيانات.
- يحفظ الأحداث في MongoDB حتى لو توقف السيرفيس ثم عاد.
- يعالج الأحداث عبر خدمة downstream محاكاة تفشل عشوائياً بنسبة 30%.
- يدعم retry مع exponential backoff + jitter.
- بعد حد معين من المحاولات، يُنقل الحدث إلى DLQ (Dead Letter Queue).
- يدعم rate limiting لكل tenant عبر Token Bucket.
- يوجد graceful shutdown يغلق السيرفر ويتأكد من إغلاق اتصال MongoDB.

## تشغيل المشروع

1. ثبّت الحزم:
   ```bash
   npm install
   ```
2. أنشئ ملف `.env` في جذر المشروع واضف القيم التالية:
   ```env
   MONGODB_URI=mongodb://localhost:27017/webhook-task
   PAYMOB_SECRET_KEY=secret_hmac_key
   PORT=5000
   ```
3. شغّل السيرفر:
   ```bash
   npm run build
   npm start
   ```
4. للتجربة المباشرة أثناء التطوير:
   ```bash
   npm test
   ```

## القرارات المعمارية

- **Persistence**: استخدمت MongoDB عبر Mongoose لتخزين الأحداث المستلمة وحالة المعالجة. هذا يضمن durability ويمكّن السيرفيس من مواصلة المعالجة بعد إعادة التشغيل.
- **Idempotency**: مخطط `WebhookEvent` يحوي `eventId` فريد. إذا وصل نفس الحدث مرتين، يتم اعتراض خطأ `11000` وإرسال رد `200 Duplicate event ignored`.
- **Signature verification**: middleware `verifyPaymobSignature` يتحقق من HMAC باستخدام `PAYMOB_SECRET_KEY` قبل الوصول للـ controller.
- **Retry strategy**: `WebhookService.calculateNextRetry` يحسب تأخيرًا أسيًا مع jitter، ويدعم الحد الأقصى من المحاولات قبل تحويل الحدث إلى `dlq`.
- **Rate limiting**: `rateLimiter.middleware.ts` ينفذ Token Bucket لكل tenant عبر `x-tenant-id`.
- **Graceful shutdown**: `index.ts` يستمع لإشارات `SIGTERM` و `SIGINT` ويغلق HTTP server ثم اتصال MongoDB.

## هيكل المشروع

- `index.ts` - نقطة البداية و graceful shutdown.
- `src/app.controller.ts` - تهيئة التطبيق وربط الميدل وير.
- `src/routes/webhook.routes.ts` - تعريف المسار.
- `src/controllers/webhook.controller.ts` - استقبال الحدث وحفظه.
- `src/services/webhook.service.ts` - منطق معالجة الأحداث، retry، DLQ.
- `src/DB/models/webhook.event.model.ts` - مخطط Mongoose والأحداث.
- `src/middlewares/paymobAuth.middleware.ts` - التحقق من التوقيع.
- `src/middlewares/rateLimiter.middleware.ts` - تحديد معدل الطلبات.
- `src/tests/webhook.test.ts` - اختبارات idempotency، retry، rate limiting.

## اختبارات

- `npm test`
- يحتوي على اختبارات التحقق من:
  - عدم معالجة نفس الحدث مرتين
  - عمل retry/backoff
  - عمل rate limiting

##  نقاط يجب الانتباه لها

- المسار الفعلي للويبهوكس هو `/api/webhooks`.
- التوقيع يعتمد على الحقول في payload ويُحسب بالترتيب المحدد في الميدل وير.
- يمكن تغيير تفاصيل أنواع الأحداث في `src/types/webhook.types.ts` باستخدام discriminated unions.

## ملاحظات

- المشروع يلتزم بـ `strict: true` في `tsconfig.json` ولا يستخدم `any` في الملفات الأساسية.
- إذا أردت تحويل التخزين من MongoDB إلى SQLite أو Postgres، يمكن تعديل طبقة `DB/DB_Connection.ts` وموديل `WebhookEventModel` بما يناسب.
