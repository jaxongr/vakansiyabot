import { PrismaClient } from '@prisma/client';
import { CATEGORIES } from '../src/modules/analyzer/dictionaries/categories';

const prisma = new PrismaClient();

interface RegionSeed {
  code: string;
  nameUz: string;
  nameCyr: string;
  sortOrder: number;
  special?: boolean;
}

const REGIONS: RegionSeed[] = [
  { code: 'toshkent-shahri', nameUz: 'Toshkent shahri', nameCyr: 'Тошкент шаҳри', sortOrder: 1 },
  { code: 'toshkent-viloyati', nameUz: 'Toshkent viloyati', nameCyr: 'Тошкент вилояти', sortOrder: 2 },
  { code: 'andijon', nameUz: 'Andijon', nameCyr: 'Андижон', sortOrder: 3 },
  { code: 'fargona', nameUz: "Farg'ona", nameCyr: 'Фарғона', sortOrder: 4 },
  { code: 'namangan', nameUz: 'Namangan', nameCyr: 'Наманган', sortOrder: 5 },
  { code: 'samarqand', nameUz: 'Samarqand', nameCyr: 'Самарқанд', sortOrder: 6 },
  { code: 'buxoro', nameUz: 'Buxoro', nameCyr: 'Бухоро', sortOrder: 7 },
  { code: 'navoiy', nameUz: 'Navoiy', nameCyr: 'Навоий', sortOrder: 8 },
  { code: 'xorazm', nameUz: 'Xorazm', nameCyr: 'Хоразм', sortOrder: 9 },
  { code: 'qashqadaryo', nameUz: 'Qashqadaryo', nameCyr: 'Қашқадарё', sortOrder: 10 },
  { code: 'surxondaryo', nameUz: 'Surxondaryo', nameCyr: 'Сурхондарё', sortOrder: 11 },
  { code: 'jizzax', nameUz: 'Jizzax', nameCyr: 'Жиззах', sortOrder: 12 },
  { code: 'sirdaryo', nameUz: 'Sirdaryo', nameCyr: 'Сирдарё', sortOrder: 13 },
  {
    code: 'qoraqalpogiston',
    nameUz: "Qoraqalpog'iston Respublikasi",
    nameCyr: 'Қорақалпоғистон Республикаси',
    sortOrder: 14,
  },
  // Maxsus regionlar — publisher ular uchun ham forum topic yaratadi
  { code: 'remote', nameUz: '🌐 Masofaviy ish', nameCyr: '🌐 Масофавий иш', sortOrder: 15, special: true },
  { code: 'other', nameUz: '📋 Boshqa / Aniqlanmagan', nameCyr: '📋 Бошқа / Аниқланмаган', sortOrder: 16, special: true },
  // Ish izlovchilar rezyumelari uchun alohida topic
  { code: 'resumes', nameUz: '📄 Rezyumelar — ish izlovchilar', nameCyr: '📄 Резюмелар — иш изловчилар', sortOrder: 17, special: true },
];

async function main() {
  for (const region of REGIONS) {
    await prisma.region.upsert({
      where: { code: region.code },
      update: {
        nameUz: region.nameUz,
        nameCyr: region.nameCyr,
        sortOrder: region.sortOrder,
        special: region.special ?? false,
      },
      create: { ...region, special: region.special ?? false },
    });
  }
  console.log(`Seeded ${REGIONS.length} regions`);

  let order = 1;
  for (const cat of CATEGORIES) {
    await prisma.category.upsert({
      where: { code: cat.code },
      update: { nameUz: cat.nameUz, sortOrder: order },
      create: { code: cat.code, nameUz: cat.nameUz, sortOrder: order },
    });
    order += 1;
  }
  console.log(`Seeded ${CATEGORIES.length} categories`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
