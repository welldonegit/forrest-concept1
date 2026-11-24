/**
 * Апостроф: в контенте сайта — прямой «'» (решение человека 2026-11-24). Скрипт заменяет типографский «’»
 * и «ʼ» между буквами (інтер’єр, developer’s) на «'» во всех документах контента и черновиках.
 * Кавычки (’ не между буквами) не трогает. Одна транзакция, правка только изменённых полей.
 *
 * Запуск (из корня проекта):
 *   npm --prefix studio run -s sanity -- exec import/apostrophe.mjs --with-user-token -- [--dry]
 */
import { getCliClient } from 'sanity/cli';

const dry = process.argv.includes('--dry');
const client = getCliClient({ apiVersion: '2025-02-19' }).withConfig({ perspective: 'raw' });
const docs = await client.fetch('*[!(_id match "_.*") && !(_type match "sanity.*") && !(_type match "system.*")]');
const RE = /(?<=\p{L})[’ʼ](?=\p{L})/gu;

const tx = client.transaction();
let total = 0;
for (const doc of docs) {
  const set = {};
  const walk = (v, path) => {
    if (typeof v === 'string') { const n = v.match(RE)?.length; if (n) { set[path] = v.replace(RE, "'"); total += n; } return; }
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${x?._key ? `_key=="${x._key}"` : i}]`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (!k.startsWith('_')) walk(x, path ? `${path}.${k}` : k);
  };
  walk(doc, '');
  const n = Object.keys(set).length;
  if (!n) continue;
  console.log(`${dry ? '[перевірка] ' : ''}${doc._id}: полів ${n}`);
  tx.patch(client.patch(doc._id).ifRevisionId(doc._rev).set(set));
}
if (!total) { console.log('Типографських апострофів між літерами немає.'); process.exit(0); }
if (dry) { console.log(`Буде замінено: ${total}.`); process.exit(0); }
const res = await tx.commit({ visibility: 'sync' });
console.log(`Готово: замінено ${total}, транзакція ${res.transactionId}.`);
