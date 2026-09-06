# Akwam Stream — Next.js + Netlify Functions

مشروع واجهة عربية RTL مبني على Next.js ويستخدم Netlify Functions كطبقة API.

> استخدمه فقط مع مصادر ومحتوى تملك حق الوصول إليه وتشغيله. لا يتضمن المشروع أي آلية لتجاوز أنظمة الحماية أو القيود التقنية للمصادر.

## أهم التغييرات

- دالة `playStreamDirectly(mediaLink, title, item)` في الواجهة.
- عند نجاح `/api/stream-link` يتم إنشاء:
  `streamLinks: [{ quality, url }]`
  ثم فتح مشغل الفيديو فوراً.
- دعم أكثر من مصدر جودة عندما يعيد المصدر عناصر `<source>` متعددة.
- حفظ المفضلة في `localStorage`.
- بحث وأفلام ومسلسلات ونافذة تفاصيل.
- Netlify Functions بدون Express.

## تشغيل محلياً

```bash
npm install
npm run dev
```

للاختبار مع Netlify Functions:

```bash
npm install -g netlify-cli
netlify dev
```

## إعداد البيئة

انسخ `.env.example` إلى `.env.local` واضبط:

```env
AKWAM_BASE_URL=https://example.com
NEXT_PUBLIC_API_URL=
```

غيّر `AKWAM_BASE_URL` إلى المصدر الذي تملك حق استخدامه.

## API

- `GET /api/health`
- `GET /api/media?q=&type=movies&page=1`
- `GET /api/series-episodes?url=...`
- `GET /api/stream-link?url=...`

مثال استجابة التشغيل:

```json
{
  "success": true,
  "streamUrl": "https://example.com/video.mp4",
  "streamLinks": [
    {
      "quality": "1080p",
      "url": "https://example.com/video.mp4"
    }
  ],
  "direct": true
}
```

## Netlify

Build command:

```text
npm run build
```

Publish directory:

```text
.next
```

Functions directory:

```text
netlify/functions
```
