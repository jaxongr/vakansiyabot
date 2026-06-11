import { InlineKeyboard, Keyboard } from 'grammy';
import { Category, Region } from '@prisma/client';

export const MENU_VACANCY = "➕ E'lon berish — xodim kerak";
export const MENU_RESUME = '📄 Rezyume yuborish — ish izlayapman';
export const MENU_SEARCH_JOB = '🔍 Ish qidirish';
export const MENU_SEARCH_RESUME = '👤 Rezyume qidirish';
export const MENU_HELP = 'ℹ️ Yordam';

export function mainMenu(): Keyboard {
  return new Keyboard()
    .text(MENU_SEARCH_JOB)
    .text(MENU_SEARCH_RESUME)
    .row()
    .text(MENU_VACANCY)
    .row()
    .text(MENU_RESUME)
    .row()
    .text(MENU_HELP)
    .resized()
    .persistent();
}

export function regionsKeyboard(regions: Region[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  regions.forEach((region, i) => {
    kb.text(region.nameUz, `int:reg:${region.code}`);
    if (i % 2 === 1) kb.row();
  });
  kb.row().text('❌ Bekor qilish', 'int:cancel');
  return kb;
}

export function categoriesKeyboard(categories: Category[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  categories.forEach((category, i) => {
    kb.text(category.nameUz, `int:cat:${category.code}`);
    if (i % 2 === 1) kb.row();
  });
  kb.row().text('❌ Bekor qilish', 'int:cancel');
  return kb;
}

export function employmentKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("To'liq stavka", 'int:emp:FULL_TIME')
    .text('Yarim stavka', 'int:emp:PART_TIME')
    .row()
    .text('Masofaviy', 'int:emp:REMOTE')
    .text('Smenali', 'int:emp:SHIFT')
    .row()
    .text('❌ Bekor qilish', 'int:cancel');
}

export function skipKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("O'tkazib yuborish ➡️", 'int:skip')
    .row()
    .text('❌ Bekor qilish', 'int:cancel');
}

export function confirmKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ Tasdiqlash va joylash', 'int:ok')
    .row()
    .text('❌ Bekor qilish', 'int:cancel');
}

export function cancelKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text('❌ Bekor qilish', 'int:cancel');
}
