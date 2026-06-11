# PROMPT.md — Claude Code uchun tayyor buyruqlar
# Har bosqichni ALOHIDA bering. Oldingi bosqich testlari yashil bo'lmaguncha
# keyingisiga o'tmang. Har promptni nusxalab Claude Code'ga tashlang.

---

## 0️⃣ BOSHLASH (birinchi xabar)

```
Loyiha ildizidagi CLAUDE.md (Master qoidalar) va docs/CLAUDE.md (loyiha
qoidalari) fayllarini to'liq o'qib chiq. Hech narsa yozma, faqat:
1. Arxitekturani 5-6 gapda o'z so'zing bilan qaytarib ber
2. Tushunarsiz yoki qarama-qarshi joy bo'lsa savol ber
Men tasdiqlaganimdan keyin Bosqich 1 ni boshlaymiz.
```

---

## 1️⃣ FUNDAMENT — schema, seed, docker

```
Bosqich 1 ni bajar:
- Monorepo: backend/ (NestJS), dashboard/, miniapp/ papkalari (frontend hozircha bo'sh)
- docker-compose.yml: postgres:16 + redis:7, volume'lar bilan
- Prisma schema TO'LIQ: Channel, RawPost, Vacancy, VacancySource, Region,
  Category, AppUser, PublishedPost, DedupReview + barcha enum va indexlar
  (CLAUDE.md dagi sxema bo'yicha, Master qoidalar: uuid, timestamps, soft delete)
- Migratsiya + seed: 14 viloyat (nameUz + nameCyr) + "Masofaviy ish" va
  "Boshqa" maxsus regionlar + kategoriyalar + shahar→viloyat lug'ati
  (dictionaries/cities.ts — kamida 60 ta shahar/tuman, lotin va kirill)
- .env.example (CLAUDE.md dagi barcha keylar)
- NestJS skeleton: config, GlobalExceptionFilter, logger, health endpoint
Tugagach: docker compose up + migratsiya + seed qanday ishga tushirilishini
README.md ga yoz va o'zing tekshirib ko'rsat.
```

---

## 2️⃣ COLLECTOR — kanallarni kuzatish

```
Bosqich 2 ni bajar:
- collector moduli: GramJS client (StringSession .env dan), reconnect logikasi
- NewMessage handler: faqat channels jadvalidagi ACTIVE kanallardan,
  RawPost ga yozish (textHash = normalize qilingan matn SHA-256),
  @@unique([channelId, tgMessageId]) bilan takror yozishdan himoya
- channels.manager: kanal qo'shilganda join (FloodWait: error.seconds ga
  rioya, joinlar orasida 30-60s), o'chirilganda leave
- channels CRUD API: POST/PATCH/DELETE /api/v1/channels (RBAC: ADMIN,
  cursor pagination, Master response format, E4002/E4003 kodlar)
- StringSession olish uchun alohida script: scripts/generate-session.ts
- Testlar: GramJS mock, handler va manager unit testlari
```

---

## 3️⃣ ANALYZER + DEDUP — pipeline

```
Bosqich 3 ni bajar:
- BullMQ: 'analyze' va 'dedup' queue'lar, DLQ bilan
- rules.service: telefon regex (+998 formatlari), maosh parsing
  (3 mln, 3.000.000, 300$, "kelishilgan"), viloyat aniqlash
  (cities.ts lug'ati, lotin+kirill), kategoriya keyword matching
- llm.service: Anthropic SDK, claude-haiku, faqat rules to'liq aniqlay
  olmaganda. System prompt: qat'iy JSON, zod bilan validate, fail → 1 retry → DLQ.
  isVacancy=false holatlarni ham aniqlasin (reklama, "ish izlayman", yangilik)
- normalize.service va matcher.service: CLAUDE.md dagi qoidalar bo'yicha
  (hash → phone+title → simhash >0.92 → merge; 0.85-0.92 → DedupReview)
- Scheduler: har kuni 03:00 da 30 kundan eski ACTIVE → EXPIRED
- Testlar: normalize/matcher/rules uchun keng unit testlar (kamida 30 case,
  real vakansiya matnlariga o'xshash misollar bilan), pipeline integration test
```

---

## 4️⃣ PUBLISHER — bot guruh admini, mavzular ⭐

```
Bosqich 4 ni bajar — publisher moduli (CLAUDE.md dagi PUBLISHER bo'limi asosida):

1. bot.service (grammY):
   - BOT_TOKEN bilan ishga tushadi, PUBLISH_GROUP_ID dagi guruhni tekshiradi:
     supergroup mi, forum yoqilganmi, bot admin mi ("Manage Topics" bormi).
     Muammo bo'lsa logger.error + system health'da ko'rsatadi, crash QILMAYDI
   - Komandalar (faqat ADMIN_TG_IDS): /setup_topics, /status, /stats

2. topics.service:
   - Region jadvalidagi tgTopicId=null bo'lganlar uchun createForumTopic
   - message_thread_id → Region.tgTopicId ga saqlash
   - Idempotent: qayta ishga tushganda mavjudini qayta yaratmaydi
   - Yaratishlar orasida 3s delay
   - TOPIC_DELETED xatosi kelsa tgTopicId=null → keyingi safar qayta yaratadi

3. publish.processor (BullMQ 'publish' queue):
   - Yangi unikal Vacancy → templates.ts (HTML) formatida tegishli viloyat
     mavzusiga yuborish, "To'liq ko'rish" inline button
     (t.me/BOT_USERNAME?startapp=vacancy_{id})
   - PublishedPost yozish; vacancyId @unique — ikki marta joylash mumkin emas
   - Rate limit: 18 msg/min, 429 da retry_after ga rioya
   - Vacancy edit → editMessageText, HIDDEN/EXPIRED → deleteMessage

4. Testlar: grammY mock bilan — topics idempotentligi, TOPIC_DELETED recovery,
   to'g'ri thread_id ga yuborish, double-publish himoyasi

Tugagach qo'lda tekshirish yo'riqnomasi: test guruh yaratish, forum yoqish,
botni admin qilish, /setup_topics — README ga yoz.
```

---

## 5️⃣ PUBLIC API

```
Bosqich 5 ni bajar:
- auth moduli: POST /api/v1/auth/miniapp (initData HMAC validate, E4001,
  auth_date 1 soat), JWT access 15min + refresh 7d, refresh rotation
- vacancies: GET ro'yxat (cursor, filtrlar: regionId, categoryId, salaryMin,
  employmentType, q — tsvector full-text), GET /:id, saved CRUD
- regions/categories endpointlari
- Redis cache CLAUDE.md dagi keylar va TTL bilan + invalidation
- Rate limiting Master bo'yicha, Swagger hamma endpointga
- Har endpoint uchun integration test
```

---

## 6️⃣ MINI APP

```
Bosqich 6 ni bajar — miniapp/ (Vite + React + TS):
- @telegram-apps/sdk: init, themeParams → CSS variables, BackButton
- AntD YO'Q — yengil custom komponentlar + styled-components
- Onboarding: viloyat tanlash → saqlash
- Asosiy: filter bar + qidiruv + useInfiniteQuery cursor scroll
- Vakansiya sahifasi: to'liq ma'lumot, manba kanallar, tel:/t.me tugmalar,
  saqlash. startapp=vacancy_{id} deep link shu sahifaga ochilsin
- /saved sahifasi
- React Query hooks majburiy, api/client.ts axios + JWT interceptor
- Bundle < 500KB gzipped tekshir
```

---

## 7️⃣ DASHBOARD

```
Bosqich 7 ni bajar — dashboard/ (Vite + React + AntD + styled-components):
- Master theme tokenlar (#6B46C1, Outfit), React Query hooks
- /login: Telegram Login Widget → ADMIN_TG_IDS tekshiruv
- /: Overview — kunlik vakansiya grafigi, viloyat pie, kategoriya bar,
  dublikat %, collector va bot status badge'lari
- /channels: jadval (cursor), qo'shish modal, pause/delete
- /vacancies: moderatsiya — filter, edit drawer (saqlanganda guruhpost ham
  yangilanadi), hide
- /dedup: shubhali juftliklar yonma-yon, Merge/Separate
- /system: queue depth, oxirgi xatolar, health
- Skeleton/Empty/Result, React.lazy har sahifa, bundle < 500KB
```

---

## 8️⃣ YAKUN

```
Bosqich 8 ni bajar:
- Winston + Sentry, health checks (collector, bot, queues, db, redis)
- docker-compose.prod.yml + nginx config + deploy README (VPS)
- Coverage hisobotini ko'rsat (minimum 70%)
- Butun pipeline E2E: fake post → analyze → dedup → publish → API'da ko'rinishi
```

---

## 🔁 HAR BOSQICHDAN KEYIN (takror buyruq)

```
Testlarni ishga tushir, lint qil, coverage ko'rsat. CLAUDE.md qoidalariga
zid joy qolmadimi — o'zing audit qilib chiq (any, console.log, offset
pagination, hardcoded secret). Topilsa tuzat. Keyin commit xabarlarini
conventional commits formatida taklif qil.
```
