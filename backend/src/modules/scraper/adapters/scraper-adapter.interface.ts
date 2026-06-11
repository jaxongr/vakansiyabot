/** Tashqi sayt adapteri uchun umumiy interfeys */
export interface ScrapedItem {
  /** Saytdagi noyob id (URL yoki e'lon id) — takrorlanmaslik uchun */
  externalId: string;
  externalUrl: string;
  /** Analyzer pipeline'ga beriladigan to'liq matn (sarlavha + tavsif birga) */
  text: string;
  postedAt: Date;
}

export interface ScraperAdapter {
  readonly type: string;
  /** Listing URL'dan e'lonlar ro'yxatini oladi */
  fetch(url: string): Promise<ScrapedItem[]>;
}
