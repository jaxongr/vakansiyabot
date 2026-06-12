# Biznes strategiya — Vakansiya Agregator

> "Agar bu mening mahsulotim bo'lsa, qanday yo'lga solardim" — to'liq strategiya.

O'zbekistonda ish izlash hali ham **Telegram kanallari** orqali, tarqoq va
tartibsiz kechadi. Bizning ustunligimiz: **hamma manbani bitta aqlli tizimga
yig'ish, tozalash, viloyat/kasb bo'yicha tartiblash va 3 ta interfeysda berish**
(Telegram guruh + Mini App + bot). hh.uz / OLX bilan farqimiz — biz odamlar
allaqachon turgan joyda (Telegram) ishlaymiz.

---

## 1. Vakansiyalarni qayerdan olamiz (manbalar)

Ko'p kanalli "ingestion" — bitta manbaga bog'lanib qolmaymiz:

| Manba | Holati | Tavsif |
|-------|--------|--------|
| **Telegram kanallar** (GramJS userbot) | ✅ | 75+ kanal, real vaqtda. Avto-kashfiyot bilan yuzlab kanalga o'sadi |
| **Avto-kashfiyot** | ✅ | Yig'ilgan postlardagi @mention/t.me havolalar → yangi kanal nomzodlari → admin tasdiqlaydi |
| **Web scraper** (RSS + HTML) | ✅ | ish.uz, OLX, hh.uz JobPosting, har qanday RSS |
| **hh.uz / HeadHunter API** | ✅ adapter | Rasmiy API orqali strukturali vakansiyalar |
| **Bot intake** (ish beruvchi) | ✅ | Kompaniyalar to'g'ridan-to'g'ri e'lon beradi (eng sifatli, bepul lead) |
| **Hamkor API / webhook** | 🔜 | Yirik kompaniyalar/HR tizimlari push qiladi |
| **Email-to-vacancy** | 🔜 | Kompaniya e'lonni emailga yuboradi → parse |

**Strategiya:** kanal/scraper — hajm uchun (kunlik minglab post), bot intake +
hamkor API — sifat va eksklyuziv kontent uchun. Avto-kashfiyot manba bazasini
qo'lsiz kengaytiradi — bu eng muhim "moat" (kim ko'p manbaga ega — yutadi).

---

## 2. Monetizatsiya modellari

### A. Ish beruvchi (B2B) — asosiy daromad
1. **Featured / Promote** — e'lonni viloyat mavzusida tepaga chiqarish, ajratib
   ko'rsatish, qayta joylash (per-post to'lov). Bot orqali "💎 Ko'tarish".
2. **Recruiter obuna** (EMPLOYER_BASIC / PRO) — oyiga N ta e'lon, statistika,
   prioritet joylash.
3. **Rezyume bazasiga kirish** — ish beruvchi ish izlovchilarning kontaktini
   ko'rish uchun to'laydi (hh.uz modeli). Bepul foydalanuvchi cheklangan ko'radi.

### B. Ish izlovchi (B2C) — freemium
- **Bepul**: ko'rish, qidirish, saqlash.
- **PREMIUM_SEEKER**: yangi mos vakansiyalardan **birinchi xabar** (SMS/push
  alert), kengaytirilgan filtrlar, saqlangan qidiruvlar, reklamasiz.

### C. Reklama
- Mini App va kanallarda sponsor postlar, banner.
- Kurslar/ta'lim platformalariga yo'naltirish (CPA/komissiya).

### Narxlar (boshlang'ich, UZS)
| Mahsulot | Narx |
|----------|------|
| Featured e'lon (7 kun) | 30 000 |
| Premium seeker (oylik) | 19 000 |
| Employer Basic (oylik, 20 e'lon) | 99 000 |
| Employer Pro (oylik, cheksiz + rezyume bazasi) | 299 000 |

To'lov: **Payme / Click** (O'zbekiston) — provider abstraksiya, hozir MANUAL
(admin tasdiqlaydi), keyin Payme/Click kalitlari sozlanadi.

---

## 3. Go-to-market

1. **Seed bosqich**: 75+ kanaldan kontent yig'ib, viloyat guruhini to'ldiramiz →
   bepul qiymat → organik o'sish (odamlar guruhga taklif qiladi).
2. **Ish izlovchilar**ni Mini App'ga olib o'tamiz (qulay qidiruv, saqlash, alert).
3. **Ish beruvchilar** bepul e'lon beradi (intake) → ko'rinish ko'rgach Featured/
   obunaga o'tadi (paid conversion).
4. **Rezyume bazasi** to'lgach — recruiterlarga sotamiz (eng yuqori marja).

**Metrikalar:** kunlik yangi vakansiya, faol foydalanuvchi (Mini App), e'lon →
ko'rish → kontakt funnel, paid conversion %, MRR.

---

## 4. Texnik tayanch (mavjud)

- Aqlli pipeline: regex + LLM klassifikatsiya (VACANCY/RESUME/OTHER), dedup
- 3 interfeys: guruh (forum topics), Mini App, bot (intake + qidiruv)
- Monetizatsiya: Plan/Subscription/Payment, featured/promote
- Skalalanish: BullMQ, Redis cache, cursor pagination, indexlar (50K+ user)
- Boshqaruv: dashboard (analitika, moderatsiya, SMS, Telegram ulash, to'lovlar)
