# Deploy — VPS (Docker Compose)

Production'da butun tizim `docker-compose.prod.yml` orqali ishga tushadi:
postgres + redis + backend (migratsiya + NestJS) + nginx (Mini App, Dashboard, API proxy).

## 1. Talablar (VPS)

- Ubuntu 22.04+ / Debian, 2 vCPU, 4GB RAM (50K+ user uchun 4 vCPU/8GB tavsiya)
- Docker + Docker Compose plugin
- Domen (masalan `vakansiya.uz`) A-record VPS IP ga yo'naltirilgan

## 2. Sozlash

```bash
git clone https://github.com/jaxongr/vakansiyabot.git
cd vakansiyabot

# backend muhit o'zgaruvchilari
cp backend/.env.example backend/.env
nano backend/.env   # quyidagilarni to'ldiring:
```

`backend/.env` da MAJBURIY to'ldiriladi:

| Kalit | Tavsif |
|-------|--------|
| `DATABASE_URL` | `postgresql://postgres:KUCHLI_PAROL@postgres:5432/vakansiya` |
| `REDIS_URL` | `redis://redis:6379` |
| `TG_API_ID`, `TG_API_HASH`, `TG_SESSION` | GramJS collector (`npm run session:generate`) |
| `BOT_TOKEN`, `BOT_USERNAME` | BotFather'dan |
| `PUBLISH_GROUP_ID` | forum-supergroup ID (`-100...`) |
| `ANTHROPIC_API_KEY` | LLM fallback (ixtiyoriy) |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | tasodifiy uzun satrlar |
| `ADMIN_TG_IDS` | admin tg id lar, vergul bilan |
| `MINIAPP_URL`, `DASHBOARD_URL` | `https://vakansiya.uz`, `https://vakansiya.uz/admin` |
| `SENTRY_DSN` | xato kuzatuvi (ixtiyoriy) |

> ⚠️ `docker-compose.prod.yml` uchun `.env`da `POSTGRES_PASSWORD` ni ham bering
> (compose root'idagi postgres servisi shuni o'qiydi).

## 3. Frontendlarni build qilish

nginx `miniapp/dist` va `dashboard/dist` ni serve qiladi:

```bash
# Mini App
cd miniapp && cp .env.example .env
echo "VITE_API_URL=https://vakansiya.uz/api/v1" > .env
npm ci && npm run build && cd ..

# Dashboard
cd dashboard
printf "VITE_API_URL=https://vakansiya.uz/api/v1\nVITE_BOT_USERNAME=BOT_USERNAME\n" > .env
npm ci && npm run build && cd ..
```

## 4. Ishga tushirish

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f backend   # migratsiya + start
```

Backend konteyneri startda `prisma migrate deploy` ni avtomatik bajaradi.
Seed (regions/categories) bir marta:

```bash
docker compose -f docker-compose.prod.yml exec backend npx prisma db seed
```

## 5. Bot mavzularini sozlash

1. Telegram'da supergroup yarating, **Topics (forum)** ni yoqing
2. Botni guruhga admin qiling: *Manage Topics* + *Post/Edit/Delete Messages*
3. Bot DM'da `/setup_topics` (faqat `ADMIN_TG_IDS`) — har viloyat + rezyume mavzusi yaratiladi

## 6. HTTPS (Let's Encrypt)

`deploy/certs/` ga sertifikat joylang yoki certbot + nginx companion ishlating.
Eng oddiy yo'l — VPS'da `caddy` yoki `nginx-proxy + acme-companion`.

## 7. Monitoring & backup

- Health: `https://vakansiya.uz/api/v1/system/health`
- Loglar: `docker compose logs backend` (Winston → stdout + `logs/`)
- Sentry: `SENTRY_DSN` berilsa kutilmagan xatolar yuboriladi
- Backup (cron):
  ```bash
  docker compose -f docker-compose.prod.yml exec -T postgres \
    pg_dump -U postgres vakansiya | gzip > backup_$(date +%F).sql.gz
  ```

## 8. Yangilash

```bash
git pull
cd miniapp && npm run build && cd ../dashboard && npm run build && cd ..
docker compose -f docker-compose.prod.yml up -d --build backend nginx
```
