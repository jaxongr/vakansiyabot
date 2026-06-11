/**
 * GramJS StringSession olish:
 *   1. https://my.telegram.org -> API development tools -> api_id va api_hash oling
 *   2. cd backend && npm run session:generate
 *   3. Telefon, kod (va 2FA parol) kiriting
 *   4. Chiqqan stringni .env dagi TG_SESSION ga qo'ying
 */
import * as readline from 'readline';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q: string): Promise<string> =>
  new Promise((resolve) => rl.question(q, (a) => resolve(a.trim())));

async function main() {
  const apiId = Number(await ask('TG_API_ID: '));
  const apiHash = await ask('TG_API_HASH: ');

  const client = new TelegramClient(new StringSession(''), apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: () => ask('Telefon raqam (+998...): '),
    password: () => ask('2FA parol (bo`lmasa Enter): '),
    phoneCode: () => ask('Telegram kelgan kod: '),
    onError: (err) => console.error(err),
  });

  console.log('\n=== TG_SESSION (quyidagini .env ga nusxalang) ===\n');
  console.log(client.session.save());
  console.log();
  await client.disconnect();
  rl.close();
  process.exit(0);
}

void main();
