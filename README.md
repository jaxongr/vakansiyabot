# Vakansiya Agregator

Telegram kanallari, **bot orqali topshirilgan e'lonlar** va **tashqi vakansiya
saytlari** (RSS/HTML)dan e'lonlarni real vaqtda yig'ish, aqlli tahlil qilish
(viloyat, kategoriya, maosh, telefon — VACANCY/RESUME/OTHER), dublikatlarni
birlashtirish va forum-guruh mavzulariga (viloyatlar + rezyumelar) avtomatik
joylash tizimi.

## Imkoniyatlar

- **Collector** (GramJS) — kanallarni real vaqtda kuzatish
- **Bot intake** (grammY) — ish beruvchi e'lon, ish izlovchi mukammal rezyume topshiradi
- **Web scraper** — ish.uz/OLX/hh.uz (HTML) va istalgan RSS/Atom feed
- **Analyzer** — regex (telefon/maosh/viloyat/kategoriya) + LLM fallback (claude-haiku)
- **Dedup** — hash + phone/title + simhash; shubhalilar admin review'ga
- **Publisher** — har viloyat uchun forum topic, rezyumelar alohida topic
- **Mini App** — vakansiya/rezyume ro'yxati, qidiruv, saqlash, deep-link
- **Dashboard** — statistika, kanal/sayt boshqaruvi, moderatsiya, dedup review

## Tarkib

| Papka        | Tavsif                                              |
|--------------|-----------------------------------------------------|
| `backend/`   | NestJS + Prisma + PostgreSQL + Redis + BullMQ       |
| `dashboard/` | Admin panel (Vite + React + AntD)                   |
| `miniapp/`   | Telegram Mini App (Vite + React, yengil)            |
| `deploy/`    | nginx config + VPS deploy yo'riqnomasi              |

## Talablar

- Node.js >= 20
- PostgreSQL 16 va Redis >= 6.2 — **ikkita yo'l bilan**:
  - **Docker**: `docker compose up -d` (postgres:16 + redis:7)
  - **Lokal (Windows, Docker'siz)**: PostgreSQL 16 Windows service +
    Redis WSL ichida (`wsl -u root redis-server --daemonize yes --bind 0.0.0.0 --protected-mode no`)

## Ishga tushirish (backend)

```bash
cd backend
cp .env.example .env        # qiymatlarni to'ldiring
npm install
npx prisma migrate dev      # migratsiyalar
npx prisma db seed          # 16 region + 14 kategoriya
npm run start:dev           # http://localhost:3000
```

Tekshirish:

- Health: `GET http://localhost:3000/api/v1/system/health`
- Swagger: `http://localhost:3000/docs`

## Muhit o'zgaruvchilari

`backend/.env.example` dagi barcha keylar izoh bilan. Demo rejimda
`TG_API_ID/TG_API_HASH/TG_SESSION` (collector) va `ANTHROPIC_API_KEY` (LLM)
bo'sh qoldirilsa — tegishli modul graceful o'chadi, qolgan tizim ishlayveradi.

## Testlar

```bash
cd backend
npm test            # unit
npm run test:e2e    # integration/e2e (vakansiya_test bazasi kerak)
npm run test:cov    # coverage (maqsad: 70%+)
```
