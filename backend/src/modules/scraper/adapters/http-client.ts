/** Oddiy fetch wrapper — User-Agent, timeout, rate-limit hurmat */
const DEFAULT_TIMEOUT_MS = 15_000;
const USER_AGENT =
  'Mozilla/5.0 (compatible; VakansiyaBot/1.0; +https://t.me/vakansiya_bot) AppleWebKit/537.36';

export async function httpGet(url: string, accept = 'text/html'): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: accept,
        'Accept-Language': 'uz,ru;q=0.9,en;q=0.8',
      },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}
