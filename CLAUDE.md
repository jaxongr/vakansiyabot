# CLAUDE.md — Telegram Vakansiya Agregator
# Bu fayl Master Project Rules (CLAUDE.md — Master) ning DAVOMI.
# Master qoidalar 100% amal qiladi. Bu yerda faqat loyihaga xos qo'shimchalar.
# Yangi pattern/qoida qo'shilsa — DARHOL yangilang.

---

## 🎯 LOYIHA MAQSADI

Telegramdagi vakansiya kanallari/guruhlarini real vaqtda kuzatish, e'lonlarni
tahlil qilish, viloyat va kategoriyalarga ajratish, dublikatlarni BITTA unikal
vakansiyaga birlashtirish va:
- **Bot (guruh admini)** → forum-guruhda har viloyat uchun MAVZU (topic) ni
  O'ZI yaratadi va har unikal vakansiyani tegishli viloyat mavzusiga joylaydi
- Foydalanuvchilarga → **Telegram Mini App** (filtrlash, qidiruv, saqlash)
- Adminlarga → **Dashboard** (statistika, kanal boshqaruvi, moderatsiya)

---

## 🏗️ TECH STACK (Master'ga moslangan)

| Layer     | Stack                                                       |
|-----------|-------------------------------------------------------------|
| Backend   | NestJS + Prisma + PostgreSQL + Redis (Master bo'yicha)      |
| Collector | **GramJS** (MTProto userbot) — NestJS modul ichida           |
| Publisher | **grammY** (Bot API) — forum topics yaratish + e'lon joylash |
| Queue     | **BullMQ** (Redis ustida) — analyze/dedup pipeline           |
| LLM       | Anthropic SDK (claude-haiku) — faqat regex yetmaganda        |
| Dashboard | Vite + React + AntD + Styled-components + TS (Master)        |
| Mini App  | Vite + React + TS + **@telegram-apps/sdk** — Admin qoidalari amal qiladi |
| Auth      | Mini App: initData → JWT \| Dashboard: Telegram Login + RBAC |

⚠️ Mobil ilova YO'Q (hozircha). Mini App — web, Admin panel qoidalariga bo'ysunadi.
⚠️ Collector uchun Bot API EMAS — bot a'zo bo'lmagan kanalni o'qiy olmaydi.
   GramJS userbot session ishlatiladi (StringSession, .env da).

---

## 🏗️ BACKEND MODUL STRUKTURASI

```
src/
├── modules/
│   ├── collector/        ← GramJS client, NewMessage handler
│   │   ├── collector.module.ts
│   │   ├── collector.service.ts    ← ulanish, kuzatish, raw_post yozish
│   │   └── channels.manager.ts     ← join/leave, FloodWait himoya
│   ├── analyzer/         ← BullMQ worker
│   │   ├── analyzer.processor.ts   ← queue consumer
│   │   ├── rules.service.ts        ← regex: telefon, maosh, viloyat
│   │   ├── llm.service.ts          ← Anthropic API, strict JSON + zod
│   │   └── dictionaries/           ← shahar→viloyat, kategoriya keywords
│   ├── dedup/
│   │   ├── normalize.service.ts    ← emoji/link/imzo tozalash
│   │   └── matcher.service.ts      ← hash + phone + simhash
│   ├── publisher/        ← grammY bot, guruh admini
│   │   ├── publisher.module.ts
│   │   ├── bot.service.ts          ← bot lifecycle, komandalar
│   │   ├── topics.service.ts       ← viloyat mavzularini yaratish/sync
│   │   ├── publish.processor.ts    ← BullMQ 'publish' queue consumer
│   │   └── templates.ts            ← vakansiya post formati (HTML)
│   ├── vacancies/        ← public API (Mini App)
│   ├── channels/         ← admin API
│   ├── stats/            ← admin API
│   ├── auth/             ← initData validate, Telegram Login, JWT
│   └── users/
├── common/               ← Master bo'yicha (filters, guards, decorators...)
├── config/
└── prisma/
```

Controller/Service/Repository/DTO qoidalari — Master'dagi kabi, istisnosiz.

---

## 🗄️ PRISMA MODELLAR (asosiy)

Master qoidalar: uuid id, createdAt/updatedAt, deletedAt (soft delete), indexlar.

```prisma
model Channel {
  id          String    @id @default(uuid())
  tgId        BigInt    @unique
  username    String?
  title       String
  type        ChannelType          // CHANNEL | GROUP
  status      ChannelStatus        // ACTIVE | PAUSED | BANNED
  postsCount  Int       @default(0)
  // + timestamps, deletedAt
  @@index([status])
}

model RawPost {
  id          String   @id @default(uuid())
  channelId   String
  tgMessageId BigInt
  text        String
  textHash    String               // normalized SHA-256
  postedAt    DateTime
  processed   Boolean  @default(false)
  isVacancy   Boolean?             // analyzer natijasi
  @@unique([channelId, tgMessageId])
  @@index([processed])
  @@index([textHash])
}

model Vacancy {
  id             String   @id @default(uuid())
  title          String
  description    String
  company        String?
  regionId       String
  district       String?
  categoryId     String
  salaryMin      Int?
  salaryMax      Int?
  currency       Currency @default(UZS)
  employmentType EmploymentType      // FULL_TIME | PART_TIME | REMOTE | SHIFT
  phones         String[]
  tgContact      String?
  status         VacancyStatus       // ACTIVE | EXPIRED | HIDDEN
  firstSeenAt    DateTime
  sources        VacancySource[]
  // + timestamps, deletedAt
  @@index([regionId, status, createdAt])
  @@index([categoryId, status])
  @@index([status, createdAt])
}

model VacancySource {  // 1 vakansiya → N kanal posti
  vacancyId String
  rawPostId String
  @@id([vacancyId, rawPostId])
}

model Region {
  id        String  @id @default(uuid())
  nameUz    String                  // "Samarqand"
  nameCyr   String                  // "Самарқанд"
  tgTopicId Int?                    // bot yaratgan forum topic message_thread_id
  // + timestamps
}
model Category { ... }  // seed orqali
model AppUser  { tgUserId BigInt @unique, regionId?, savedVacancies[] ... }

model PublishedPost {  // guruhga joylangan e'lonlar
  id           String  @id @default(uuid())
  vacancyId    String  @unique
  tgChatId     BigInt                // PUBLISH_GROUP_ID
  tgMessageId  Int                   // edit/delete uchun
  tgTopicId    Int                   // qaysi viloyat mavzusiga
  // + timestamps
  @@index([vacancyId])
}
```

Full-text qidiruv: PostgreSQL `tsvector` + GIN index (`title`, `description`),
migration ichida raw SQL bilan (bu — Master'dagi "extreme case" istisnosi, ruxsat).

---

## 🌍 VILOYATLAR — seed data (14 ta)

Toshkent shahri, Toshkent viloyati, Andijon, Farg'ona, Namangan, Samarqand,
Buxoro, Navoiy, Xorazm, Qashqadaryo, Surxondaryo, Jizzax, Sirdaryo,
Qoraqalpog'iston Respublikasi.

`dictionaries/cities.ts` — shahar/tuman → viloyat mapping MAJBURIY:
Chirchiq/Angren/Olmaliq → Toshkent vil. | Nukus → Qoraqalpog'iston |
Marg'ilon/Qo'qon → Farg'ona | Urganch/Xiva → Xorazm | va h.k. (to'liq lug'at).
Kirill va lotin yozuvi IKKALASI ham qo'llab-quvvatlansin ("Самарқанд" = "Samarqand").

## 📂 KATEGORIYALAR — seed data

IT/Dasturlash, Savdo/Sotuv, Haydovchi/Logistika, Qurilish, Ishlab chiqarish,
Ta'lim, Tibbiyot, Ofis/Administrativ, Xizmat ko'rsatish, Buxgalteriya/Moliya,
Marketing/SMM, Uy xizmati, Qo'riqlash, Boshqa.

---

## 🔄 PIPELINE — qat'iy oqim

```
GramJS NewMessage
  → RawPost yozish (textHash bilan)
  → BullMQ 'analyze' queue
      → 1. textHash dublikatmi? → ha: VacancySource qo'sh, STOP
      → 2. rules.service (regex): telefon, maosh, viloyat, kategoriya
      → 3. yetmasa → llm.service (claude-haiku, strict JSON, zod validate)
      → 4. isVacancy=false? ("ish izlayman", reklama, yangilik) → STOP
  → BullMQ 'dedup' queue
      → phone+title match → birlashtirish
      → simhash similarity > 0.92 → birlashtirish
      → 0.85–0.92 → DedupReview jadvaliga (admin qo'lda tasdiqlaydi)
      → aks holda → yangi Vacancy
  → BullMQ 'publish' queue
      → Region.tgTopicId topiladi (yo'q bo'lsa topics.service yaratadi)
      → templates.ts formatida guruh mavzusiga yuboriladi
      → PublishedPost yoziladi (keyin edit/delete uchun)
```

Qoidalar:
```
❌ LLM ni har post uchun chaqirish — regex birinchi, LLM fallback
❌ Dublikatni o'chirish — faqat VacancySource ga birlashtiriladi
✅ LLM javobi zod schema bilan validate, parse fail → retry 1 marta → DLQ
✅ FloodWait: kanalga join orasida 30–60s, error.seconds ga rioya
✅ Scheduler (cron): 30 kundan eski ACTIVE → EXPIRED (har kuni 03:00)
✅ Session StringSession sifatida .env da, .session fayl git'da EMAS
```

---

## 🤖 PUBLISHER — bot guruh admini (YANGI MODUL)

### Talablar
```
- Guruh: SUPERGROUP + Topics (forum) YOQILGAN bo'lishi shart
- Bot guruhda ADMIN: "Manage Topics" + "Post/Edit/Delete Messages" huquqlari
- Bot startda o'zini tekshiradi: admin emasmi yoki forum o'chiqmi →
  logger.error + Dashboard /system da qizil badge (crash QILMAYDI)
```

### Mavzularni avtomatik yaratish — topics.service
```
1. Bot start → Region jadvalini o'qiydi
2. tgTopicId = null bo'lgan har viloyat uchun → createForumTopic(nameUz)
   → message_thread_id ni Region.tgTopicId ga saqlaydi
3. Qo'shimcha 2 mavzu ham yaratiladi (Region sifatida seed da):
   "🌐 Masofaviy ish" va "📋 Boshqa / Aniqlanmagan"
4. Idempotent: qayta start → mavjudlarini QAYTA YARATMAYDI
5. Mavzu qo'lda o'chirilgan bo'lsa (TOPIC_DELETED xato) →
   tgTopicId=null qilinadi → keyingi publishda qayta yaratiladi
6. Yaratish orasida 3s delay (FloodWait himoya)
```

### E'lon joylash — publish.processor
```
✅ Format (templates.ts, parse_mode: HTML):
   💼 <b>{title}</b>
   💰 {salaryMin}–{salaryMax} {currency} | 🕘 {employmentType}
   📍 {region}, {district}
   {qisqa tavsif — max 400 belgi, davomi Mini App'da}
   📞 {phone} | ✈️ {tgContact}
   📡 Manba: {kanal nomlari}
   [Inline button: "To'liq ko'rish" → Mini App deep link
    t.me/{BOT_USERNAME}?startapp=vacancy_{id}]

✅ Rate limit: BullMQ limiter — guruhga max 18 msg/min (Bot API ~20 chegara)
✅ Vacancy moderatsiyada o'zgartirilsa → editMessageText
✅ Vacancy HIDDEN/EXPIRED bo'lsa → deleteMessage (PublishedPost orqali)
✅ 429 (Too Many Requests) → retry_after ga rioya, BullMQ backoff
❌ Bitta vakansiyani ikki marta joylash — PublishedPost.vacancyId @unique
```

### Bot komandalar (faqat ADMIN_TG_IDS uchun)
```
/setup_topics  → mavzularni yaratish/sync (qo'lda trigger)
/status        → collector holati, queue depth, oxirgi publish
/stats         → bugungi raqamlar
```

---

## 📡 API — loyihaga xos endpointlar

Master format amal qiladi: `/api/v1/...`, `{data, meta}`, cursor pagination,
E-kodlar, har endpoint integration test.

```
# Public (Mini App, JWT)
GET  /api/v1/vacancies?cursor=&limit=20&regionId=&categoryId=&salaryMin=&employmentType=&q=
GET  /api/v1/vacancies/:id
GET  /api/v1/regions
GET  /api/v1/categories
POST /api/v1/auth/miniapp          ← initData → JWT
GET  /api/v1/me/saved              ← saqlanganlar
POST /api/v1/me/saved/:vacancyId
DELETE /api/v1/me/saved/:vacancyId

# Admin (RBAC: ADMIN)
POST   /api/v1/channels            ← username orqali qo'shish (collector join qiladi)
PATCH  /api/v1/channels/:id        ← pause/resume
DELETE /api/v1/channels/:id
GET    /api/v1/stats/overview      ← kunlik grafik, viloyat/kategoriya taqsimot
GET    /api/v1/stats/channels      ← top kanallar, dublikat %
GET    /api/v1/dedup/review        ← shubhali juftliklar
POST   /api/v1/dedup/review/:id    ← merge | separate
PATCH  /api/v1/vacancies/:id       ← moderatsiya (edit/hide)
GET    /api/v1/system/health       ← collector holati, queue depth
```

Loyihaga xos error kodlar (Master E-kodlarga qo'shimcha):
```
E4001 — Invalid Telegram initData
E4002 — Channel already monitored
E4003 — Channel join failed (FloodWait/private)
E4004 — Collector session invalid
E4005 — Publish group misconfigured (forum o'chiq / bot admin emas)
E4006 — Topic creation failed
```

---

## 🔴 REDIS CACHE — loyihaga xos keylar

Master format: `{module}:{variant}`

```
vacancies:list:{regionId}:{categoryId}:{cursor}  → 120s
vacancies:detail:{id}                            → 600s
regions:all / categories:all                     → 86400s
stats:overview                                   → 300s

Invalidation: yangi Vacancy yaratilganda →
  del vacancies:list:{regionId}:* va stats:overview
```

---

## 🔐 AUTH — loyihaga xos

```
Mini App:
  1. Frontend initData yuboradi → backend HMAC-SHA256 validate (BOT_TOKEN bilan)
  2. auth_date > 1 soat eski → E4001
  3. AppUser upsert → JWT (Master: access 15min + refresh 7d)

Dashboard:
  Telegram Login Widget → validate → tgUserId ∈ ADMIN_TG_IDS → JWT role=ADMIN
  Aks holda → E1002

RBAC: @Roles(Role.ADMIN) har admin endpointda — Master bo'yicha.
```

---

## 🌍 ENV VARIABLES (.env.example da MAJBURIY)

```
DATABASE_URL, REDIS_URL
TG_API_ID, TG_API_HASH, TG_SESSION        ← GramJS StringSession
BOT_TOKEN                                  ← publisher bot + initData validate
BOT_USERNAME                               ← Mini App deep link uchun
PUBLISH_GROUP_ID                           ← forum-supergroup ID (-100...)
ANTHROPIC_API_KEY, LLM_MODEL=claude-haiku-...
JWT_ACCESS_SECRET, JWT_REFRESH_SECRET
ADMIN_TG_IDS                               ← vergul bilan
MINIAPP_URL, DASHBOARD_URL                 ← CORS whitelist
```

---

## 📊 DASHBOARD — sahifalar (Admin qoidalari amal qiladi)

```
/login        ← Telegram Login Widget
/             ← Overview: kunlik vakansiyalar grafigi (AntD Charts),
                viloyat pie, kategoriya bar, dublikat %, collector status badge
/channels     ← jadval (cursor pagination!), qo'shish modal, pause/delete
/vacancies    ← moderatsiya jadvali, filter, edit drawer, hide
/dedup        ← shubhali juftliklar yonma-yon, Merge/Separate tugmalari
/system       ← queue depth, oxirgi xatolar, health
```

React Query hooks MAJBURIY (`useVacancies`, `useChannels`, `useStats`...),
AntD theme tokenlar Master'dagi (#6B46C1 primary, Outfit), Skeleton/Empty/Result.

## 📱 MINI APP — sahifalar (Admin/React qoidalari amal qiladi)

```
Onboarding   ← viloyat tanlash (birinchi kirish), AppUser.regionId saqlanadi
/            ← vakansiyalar ro'yxati: filter bar (viloyat, kategoriya,
               maosh, ish turi) + qidiruv + infinite scroll (cursor!)
/vacancy/:id ← to'liq karta: maosh, viloyat, tavsif, manba kanallar,
               "Bog'lanish" (tel: / t.me link), saqlash tugmasi
/saved       ← saqlanganlar
```

```
✅ @telegram-apps/sdk: themeParams → CSS variables (dark/light mos)
✅ MainButton/BackButton — Telegram native ishlatilsin
✅ Infinite scroll — React Query useInfiniteQuery (cursor-based)
❌ AntD Mini App'da ISHLATILMAYDI (bundle og'ir) — yengil custom
   komponentlar + styled-components. Qolgan barcha React qoidalari amal qiladi.
```

---

## 🧪 TEST — loyihaga xos kritik pathlar

Master: unit har service, integration har endpoint, coverage 70%.
Bu loyihada E2E MAJBURIY bo'lgan flowlar:

```
1. normalize.service  → emoji/link/imzo tozalash (unit, ko'p case)
2. matcher.service    → hash/phone/simhash birlashtirish (unit)
3. rules.service      → viloyat aniqlash: lotin+kirill, shahar→viloyat (unit)
4. pipeline E2E       → fake RawPost → Vacancy yaratilishi → dublikat kelsa
                        VacancySource ga qo'shilishi
5. auth E2E           → initData validate (valid/invalid/expired)
6. topics.service     → idempotent yaratish, TOPIC_DELETED recovery (unit, mock)
7. publish.processor  → to'g'ri mavzuga, ikki marta joylamaslik (integration, mock)
```

grammY va GramJS chaqiruvlari testlarda MOCK qilinadi (real Telegram EMAS),
lekin Master qoida esda: mock data production codeda TAQIQ.

---

## 🚀 ISHLAB CHIQISH BOSQICHLARI — ketma-ket, sakramasdan

```
1. Prisma schema + migratsiyalar + seed (regions, categories) + docker-compose
2. Collector moduli (GramJS) → RawPost yozish + channels CRUD
3. Analyzer (rules → llm) + Dedup + BullMQ pipeline + scheduler
4. Publisher (grammY): topics auto-create + publish queue + komandalar
5. Public API (vacancies, auth/miniapp, saved) + cache
6. Mini App
7. Dashboard
8. Monitoring, deploy
```

Har bosqich oxirida: testlar yashil + qanday qo'lda tekshirish README'da.