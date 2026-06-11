/**
 * Demo: backend ishga tushgan holatda (workerlar faol) soxta postlarni
 * analyze queue'ga qo'shadi. Pipeline: analyze -> dedup -> Vacancy/Resume.
 * Publish bot sozlanmagan bo'lsa o'tkazib yuboriladi, lekin Vacancy yaratiladi
 * va API'da ko'rinadi.
 *
 * Ishlatish: backend ishga tushgach -> npm run demo:pipeline
 */
import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';
import { createHash } from 'crypto';

const prisma = new PrismaClient();
const redisUrl = new URL(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379');
const analyzeQueue = new Queue('analyze', {
  connection: { host: redisUrl.hostname, port: Number(redisUrl.port || 6379) },
});

const SAMPLE_POSTS = [
  `💼 Oshpaz kerak!\nSamarqand shahridagi milliy taomlar restoraniga tajribali oshpaz kerak.\nIsh vaqti 9:00-19:00. Maosh 6 mln so'm.\nTel: +998 91 234 56 78`,
  `Frontend dasturchi izlaymiz (React, TypeScript)\nMasofaviy ish, oylik 1000-1500$.\nPortfolio bilan murojaat: @hr_itcompany`,
  `Toshkent shahri Chilonzor tumaniga SOTUVCHI qiz kerak.\nYosh 18-30. Ish haqi 4 mln + bonus.\nAloqa: +998901112233`,
  `Haydovchi kerak! Fura, xalqaro yo'nalish.\nAndijon. Maosh kelishilgan holda.\nMurojaat: +998935554411`,
  // takrorlangan post (dedup tekshiruvi uchun — birinchisiga o'xshash)
  `Oshpaz kerak! Samarqanddagi milliy taomlar restoraniga tajribali oshpaz kerak. Maosh 6 mln. Tel: +998 91 234 56 78`,
  // rezyume
  `Ish izlayapman. Men Jasur, 28 yosh, Toshkentda yashayman.\nHaydovchilik guvohnomam bor (B,C), 6 yil tajriba.\nTel: +998901119988`,
  // reklama (OTHER — vakansiya yaratilmaydi)
  `🎉 AKSIYA! Bizning kanalga obuna bo'ling va 50% chegirmaga ega bo'ling!`,
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .trim();
}

async function main() {
  // demo kanal
  const channel = await prisma.channel.upsert({
    where: { tgId: BigInt(-1009999) },
    update: {},
    create: { tgId: BigInt(-1009999), title: 'Demo Kanal', username: 'demo_kanal', type: 'CHANNEL' },
  });

  let added = 0;
  for (let i = 0; i < SAMPLE_POSTS.length; i++) {
    const text = SAMPLE_POSTS[i];
    try {
      const rawPost = await prisma.rawPost.create({
        data: {
          origin: 'CHANNEL',
          channelId: channel.id,
          tgMessageId: BigInt(Date.now() + i),
          text,
          textHash: createHash('sha256').update(normalize(text)).digest('hex'),
          postedAt: new Date(),
        },
        select: { id: true },
      });
      await analyzeQueue.add('analyze', { rawPostId: rawPost.id });
      added++;
      console.log(`[${i + 1}] queued: ${text.slice(0, 50).replace(/\n/g, ' ')}...`);
    } catch (e) {
      console.log(`[${i + 1}] skip (dublikat): ${(e as Error).message.slice(0, 40)}`);
    }
  }

  console.log(`\n✅ ${added} ta post analyze queue'ga qo'shildi.`);
  console.log("Workerlar qayta ishlagach 'GET /api/v1/vacancies' da natijani ko'ring.");

  await analyzeQueue.close();
  await prisma.$disconnect();
  process.exit(0);
}

void main();
