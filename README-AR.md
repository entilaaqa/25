# انطلاقة — قالب React على Render

| | |
|---|---|
| **النوع** | قالب تطبيق React |
| **التصنيف** | Layout |
| **مبني بـ** | React · CSS · GSAP |
| **الاعتماديات** | 3 من npm، تُثبَّت بـ `npm install` (`react` · `react-dom` · `gsap`) |

## البنية
- `client/` — تطبيق React بالكامل: `src/pages/*.jsx` (Landing · Login · Dashboard)، `src/hooks/*.js` (حركات GSAP)، `src/styles.css`، `src/api.js`.
- `server/` — واجهة API على Express + PostgreSQL (اعتماديات مستقلة داخل `server/package.json`).

## التشغيل محلياً
```bash
cp .env.example .env
npm install && npm run install:server
npm run dev:server   # الطرفية 1
npm run dev          # الطرفية 2 → http://localhost:5173
```

## النشر على Render
New → Blueprint → اختر المستودع (يقرأ `render.yaml`). أدخل `DATABASE_URL` و`ADMIN_EMAIL` و`ADMIN_PASSWORD`. الفحص: `/healthz`.
