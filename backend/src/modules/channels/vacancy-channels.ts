/**
 * O'zbekiston vakansiya Telegram kanallari — internetdan topilgan (tasdiqlangan).
 * Bulk import uchun: `npm run channels:import` yoki dashboard "Kanal import" tugmasi.
 * Yangi kanallar qo'shish — shu massivga username qo'shing (yoki dashboard'dan).
 */

export interface ChannelSeed {
  username: string;
  title: string;
  region: string;
  note?: string;
}

export const VACANCY_CHANNELS: ChannelSeed[] = [
  // ===== Umumiy (nationwide) =====
  { username: 'Vakansiya_ish_biznes_marketing', title: 'ISH BOR ISH KERAK', region: 'general' },
  { username: 'ish_bor_vakansiyalaruz', title: 'Mehnat.uz', region: 'general' },
  { username: 'Uzb_Vakansiya', title: '🇺🇿 ISH BOR 🇺🇿', region: 'general' },
  { username: 'ishtoparuz_kanal', title: 'Ishtopar.uz', region: 'general', note: 'aggregator' },
  { username: 'vakansiyaa_ishbor', title: "Vakansiya || Bo'sh ish o'rinlari", region: 'general' },
  { username: 'ISH_KERAK_VAKANSIYA_BOR_ISHCHI', title: 'ISH BOR', region: 'general' },
  { username: 'ishbor_vakansiya_bor', title: 'ISH BOR', region: 'general' },
  { username: 'ISHCHI_VAKANSIYA_BOR_KERAK_ISH', title: 'ISH BOR ISH KERAK', region: 'general' },
  { username: 'vakansiyaa_M', title: 'Vakansiya ish kerak М', region: 'general' },
  { username: 'ISHBOR_VAKANSIYA_RABOTA_ISHLAR', title: 'ISHBOR | RABOTA', region: 'general' },
  { username: 'vacancy_argos', title: 'Vacancy.argos.uz', region: 'general', note: 'davlat xizmati' },
  { username: 'Ishkerakuz', title: 'Ish kerak Uzbekistan', region: 'general' },
  { username: 'Ishbor_olx_uz', title: 'OLX.UZ | ISH', region: 'general' },
  { username: 'ish_boru', title: 'BÕSH ISHLAR ELONLAR', region: 'general' },
  { username: 'BOR_ISH', title: 'ISH BOR | Newjobsuz', region: 'general' },
  { username: 'ish_ishchi_vakansiya_bor_kerak', title: 'ISH BOR ISH KERAK', region: 'general' },
  { username: 'tezelon_ish', title: 'TezElon Ish', region: 'general' },
  { username: 'ishtop', title: "ISH TOP | Eng sara bo'sh ish o'rinlari", region: 'general' },
  { username: 'ishga_takliv', title: 'ISHGA TAKLIFLAR', region: 'general' },
  { username: 'ishbor_vakansiya_uz_reklama', title: 'ISHBOR VAKANSIYA UZ', region: 'general' },
  { username: 'ishkerak_vakansiya_ishbor_rabota', title: 'ISHBOR / ishkerak rabota', region: 'general' },
  { username: 'talabalar_uchun_ish', title: 'Talabalar uchun Vakansiyalar', region: 'general' },
  { username: 'Ishga_Taklif_Ishchi_Kerak_ishbor', title: 'ISH BOR | Ishga takliflar', region: 'general' },

  // ===== Toshkent =====
  { username: 'ish_toshkent', title: 'ISH TOSHKENT | Vakansiya', region: 'toshkent' },
  { username: 'Ish_Bormi_Toshkent', title: 'Toshkentda Ish Bor', region: 'toshkent' },
  { username: 'Ish_Toshkent', title: 'ISH TOSHKENT', region: 'toshkent' },
  { username: 'toshkent_ishi', title: 'Toshkent ish bor elonlari', region: 'toshkent' },
  { username: 'vakansiya_vacancy_keremi_ishchi', title: 'TOSHKENT ISHBOR', region: 'toshkent' },
  { username: 'Toshkenda_ish_bor_kerak_elonlar', title: "Ish bor e'lonlar", region: 'toshkent' },
  { username: 'rabota_tashkent_ish_vakansiya_uz', title: 'Ищу работу | Узбекистан', region: 'toshkent' },
  { username: 'bekobodda_ish_bor_ishchi_elonlar', title: 'BEKOBODDA ISH BOR', region: 'toshkent' },
  { username: 'ishga_marxamat_ish_bor', title: 'Yuqori Chirchiq ISHGA MARXAMAT', region: 'toshkent' },
  { username: 'olmaliqhr', title: 'Vakansiya Olmaliq sh', region: 'toshkent' },

  // ===== Samarqand =====
  { username: 'samarqand_ish_bor_elonlari', title: 'Samarqand Ish bor Vakansiya', region: 'samarqand' },
  { username: 'ishborsamarqanduz', title: 'ISH BOR SAMARQAND', region: 'samarqand' },
  { username: 'samarqand_ish_bor_ishchi_elonlar', title: 'Samarqand ish bor elonlari', region: 'samarqand' },

  // ===== Andijon =====
  { username: 'andijon_ish_kerak_vakansiya_bor', title: 'ANDIJON ISH BOR', region: 'andijon' },
  { username: 'andijon_ish_kerak_bor_vakansiya', title: 'Андижон иш бор керак', region: 'andijon' },
  { username: 'andijon_ish_ishchi_bor_kerakmi', title: 'Andijon Ish bor', region: 'andijon' },

  // ===== Farg'ona =====
  { username: 'fargona_ish_bor_rabota_vakansiya', title: "FARG'ONA ISH BOR", region: 'fargona' },

  // ===== Namangan =====
  { username: 'ishbor_vakansiya_rabota', title: 'NAMANGAN ISH', region: 'namangan' },
  { username: 'Namangan_ishbor_rasmiyy', title: 'Namangan ish bor vakansiya', region: 'namangan' },
  { username: 'namangan_ish_bor_vakansiya_eloni', title: 'Namangan ish bor kerak', region: 'namangan' },

  // ===== Buxoro =====
  { username: 'Buxoroda_ish', title: 'Buxoroda ish bor 💼', region: 'buxoro' },

  // ===== Xorazm =====
  { username: 'xorazm_ish', title: 'Xorazm ish | Rasmiy', region: 'xorazm' },

  // ===== Qashqadaryo =====
  { username: 'qarshiunversall', title: 'QARSHI UNIVERSAL ISH', region: 'qashqadaryo' },
  { username: 'qashqadaryo_qarshi_ish_izlab', title: 'QARSHI QASHQADARYO ISH', region: 'qashqadaryo' },
  { username: 'qashqadaryo_ish_elon', title: 'QASHQADARYO ISH ELONLARI', region: 'qashqadaryo' },
  { username: 'uWork_Qashqadaryo', title: 'uWork - Ish Qashqadaryoda', region: 'qashqadaryo' },
  { username: 'qarshi_ish_bor_ishchi_elonlari', title: 'Qashqadaryo ish bor elonlari', region: 'qashqadaryo' },
  { username: 'Qarshijob', title: 'Работа в Карши', region: 'qashqadaryo' },

  // ===== Surxondaryo =====
  { username: 'surxondaryodaishlar', title: 'SURXONDARYO ISH', region: 'surxondaryo' },
  { username: 'XolmurodovI', title: 'TERMIZ ISH BOR / UYBOR', region: 'surxondaryo' },

  // ===== Sirdaryo =====
  { username: 'Sirdaryoishbor1', title: 'Sirdaryo Ish Bor Bandlik', region: 'sirdaryo' },

  // ===== Jizzax =====
  { username: 'ishjizzax', title: 'ISH JIZZAX 🇺🇿 RASMIY', region: 'jizzax' },
  { username: 'Ish_Kerak_Ishchi_Kerak_Jizzax', title: 'Jizzax Ish Bor', region: 'jizzax' },
  { username: 'jizzaxishmehnatuz', title: 'ISH MEHNAT UZ', region: 'jizzax' },

  // ===== Navoiy =====
  { username: 'rabotavuzbekistann', title: 'НАВОИЙ ИШ | NAVOIY ISH', region: 'navoiy' },
  { username: 'navoiyda_ishh', title: 'Navoiyda ish', region: 'navoiy' },
  { username: 'navoiy_ish_elonlar', title: 'Навоий иш | Navoiy ish', region: 'navoiy' },
  { username: 'navoiy_tadbirkorlari', title: 'NAVOIY TADBIRKORLARI', region: 'navoiy' },

  // ===== IT / Freelance / Masofaviy =====
  { username: 'uzpythonjobs', title: 'Python jobs Uzbekistan', region: 'general', note: 'IT' },
  { username: 'UstozShogird', title: 'Ustoz-Shogird', region: 'general', note: 'IT' },
  { username: 'itpark_uz', title: 'IT Park Uzbekistan', region: 'general', note: 'IT' },
  { username: 'freelance_uzb', title: 'Freelance UZB', region: 'general', note: 'freelance' },
  { username: 'freelancer_Uzbek', title: 'Freelancer Uz 🌐', region: 'general', note: 'freelance' },
  { username: 'webfreeuz', title: 'Удаленная работа | Фриланс', region: 'general', note: 'remote' },

  // ===== Tibbiyot =====
  { username: 'uzbek_klinika_ish', title: "O'zbek klinika ish o'rinlari 🏥", region: 'general', note: 'tibbiyot' },
  { username: 'medikuz_vacancy', title: 'Medik.uz', region: 'general', note: 'tibbiyot' },
  { username: 'med_vakansiya', title: 'MED VAKANSIYA', region: 'general', note: 'tibbiyot' },
  { username: 'doctors_uzbekistan', title: "O'zbekiston shifokorlari", region: 'general', note: 'tibbiyot' },

  // ===== Tikuvchilik / boshqa =====
  { username: 'ISH_KERAK_ISHCHI_TIKUVCHI', title: 'TIKUVCHILAR ISH BOR', region: 'general', note: 'tikuvchilik' },
  { username: 'tikuvchi_ish', title: 'Tikuvchiga ish kerak', region: 'general', note: 'tikuvchilik' },
  { username: 'tikuvchi_uchun_ish', title: 'Tikuvchi Chevarlar uchun ish', region: 'general', note: 'tikuvchilik' },
  { username: 'MIGRATSIYA_UZBEKISTAN', title: 'MIGRATSIYA UZBEKISTAN', region: 'general', note: 'migratsiya' },
];
