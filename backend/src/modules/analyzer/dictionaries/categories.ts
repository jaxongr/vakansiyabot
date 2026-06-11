/**
 * Kategoriya keyword lug'ati — rules.service kategoriyani shu kalit so'zlar
 * orqali aniqlaydi. Kalitlar lowercase, lotin va kirill aralash.
 */

export interface CategoryDef {
  code: string;
  nameUz: string;
  keywords: string[];
}

export const CATEGORIES: CategoryDef[] = [
  {
    code: 'it',
    nameUz: 'IT/Dasturlash',
    keywords: [
      'dasturchi', 'дастурчи', 'programmist', 'программист', 'developer', 'frontend',
      'backend', 'fullstack', 'flutter', 'react', 'python', 'java ', 'javascript',
      'node.js', 'nodejs', '1c', '1с', 'devops', 'qa engineer', 'tester', 'тестировщик',
      'mobilograf', 'веб-дастурчи', 'it mutaxassis', 'sistem administrator', 'sysadmin',
    ],
  },
  {
    code: 'savdo',
    nameUz: 'Savdo/Sotuv',
    keywords: [
      'sotuvchi', 'сотувчи', 'продавец', 'savdo menejeri', 'савдо', 'sotuv',
      'kassir', 'кассир', 'merchandayzer', 'мерчендайзер', 'supervayzer',
      'sales manager', 'savdo agenti', 'торговый агент', 'консультант', 'konsultant',
    ],
  },
  {
    code: 'haydovchi',
    nameUz: 'Haydovchi/Logistika',
    keywords: [
      'haydovchi', 'ҳайдовчи', 'водитель', 'shofyor', 'шофёр', 'kuryer', 'курьер',
      'yetkazib berish', 'dostavka', 'доставка', 'logist', 'логист', 'ekspeditor',
      'экспедитор', 'yuk tashish', 'fura', 'фура', 'avtobus haydovchisi', 'taksi', 'такси',
    ],
  },
  {
    code: 'qurilish',
    nameUz: 'Qurilish',
    keywords: [
      'quruvchi', 'қурувчи', 'строитель', 'qurilish', 'қурилиш', 'стройка',
      'gipsokarton', 'гипсокартон', 'svarchik', 'сварщик', 'payvandchi', 'пайвандчи',
      'santexnik', 'сантехник', 'elektrik', 'электрик', 'usta', 'уста', 'maler',
      'маляр', 'plitkachi', 'плиточник', 'beton', 'g\'isht teruvchi', 'kafelchi',
    ],
  },
  {
    code: 'ishlab-chiqarish',
    nameUz: 'Ishlab chiqarish',
    keywords: [
      'ishlab chiqarish', 'ишлаб чиқариш', 'производство', 'zavod', 'завод',
      'sex', 'цех', 'operator', 'оператор', 'tikuvchi', 'тикувчи', 'швея',
      'mebel', 'мебель', 'stanok', 'станок', 'upakovka', 'упаковка', 'konveyer',
    ],
  },
  {
    code: 'talim',
    nameUz: "Ta'lim",
    keywords: [
      'oqituvchi', "o'qituvchi", 'ўқитувчи', 'учитель', 'преподаватель', 'repetitor',
      'репетитор', 'mentor', 'tarbiyachi', 'тарбиячи', 'воспитатель', 'maktab',
      'мактаб', 'oquv markaz', "o'quv markaz", 'ўқув марказ', 'ingliz tili', 'matematika',
    ],
  },
  {
    code: 'tibbiyot',
    nameUz: 'Tibbiyot',
    keywords: [
      'shifokor', 'шифокор', 'врач', 'hamshira', 'ҳамшира', 'медсестра', 'farmatsevt',
      'фармацевт', 'dorixona', 'дорихона', 'аптека', 'stomatolog', 'стоматолог',
      'klinika', 'клиника', 'tibbiyot', 'тиббиёт', 'laborant', 'лаборант', 'massajist',
    ],
  },
  {
    code: 'ofis',
    nameUz: 'Ofis/Administrativ',
    keywords: [
      'ofis menejer', 'офис-менеджер', 'kotib', 'котиб', 'секретарь', 'administrator',
      'администратор', 'hr ', 'kadrlar', 'кадрлар', 'resepshn', 'ресепшн', 'receptionist',
      'operator qiz', 'call center', 'kol markaz', 'колл-центр', 'ish yurituvchi',
    ],
  },
  {
    code: 'xizmat',
    nameUz: "Xizmat ko'rsatish",
    keywords: [
      'ofitsiant', 'официант', 'barmen', 'бармен', 'oshpaz', 'ошпаз', 'повар',
      'oshxona', 'ошхона', 'kafe', 'кафе', 'restoran', 'ресторан', 'farrosh',
      'фаррош', 'уборщица', 'tozalovchi', 'sartarosh', 'сартарош', 'парикмахер',
      'barber', 'kosmetolog', 'косметолог', 'go\'zallik saloni', 'salon',
    ],
  },
  {
    code: 'buxgalteriya',
    nameUz: 'Buxgalteriya/Moliya',
    keywords: [
      'buxgalter', 'бухгалтер', 'hisobchi', 'ҳисобчи', 'moliya', 'молия', 'финанс',
      'auditor', 'аудитор', 'iqtisodchi', 'иқтисодчи', 'экономист', 'kredit', 'bank ',
    ],
  },
  {
    code: 'marketing',
    nameUz: 'Marketing/SMM',
    keywords: [
      'marketolog', 'маркетолог', 'smm', 'смм', 'target', 'таргет', 'targetolog',
      'таргетолог', 'kontent', 'контент', 'copywriter', 'kopirayter', 'копирайтер',
      'dizayner', 'дизайнер', 'grafik dizayn', 'reklama', 'реклама', 'brend',
    ],
  },
  {
    code: 'uy-xizmati',
    nameUz: 'Uy xizmati',
    keywords: [
      'enaga', 'энага', 'няня', 'uy ishchisi', 'уй ишчиси', 'домработница',
      'qarovchi', 'қаровчи', 'сиделка', 'bog\'bon', 'боғбон', 'садовник', 'uy bekasi',
    ],
  },
  {
    code: 'qoriqlash',
    nameUz: "Qo'riqlash",
    keywords: [
      'qorovul', 'қоровул', 'охранник', 'охрана', 'soqchi', 'соқчи', 'qo\'riqlash',
      'қўриқлаш', 'security', 'видеонаблюдение', 'post qo\'riqchisi',
    ],
  },
  {
    code: 'boshqa',
    nameUz: 'Boshqa',
    keywords: [],
  },
];
