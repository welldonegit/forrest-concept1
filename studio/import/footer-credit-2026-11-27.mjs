/**
 * Футер «Створено з душею» (2026-11-27): «Налаштування сайту» → «Футер» → «Студія-розробник» → «Посилання»
 * = https://well-done.com.ua/ (было «#»). Поле одно для всех языков (uk и en). Внешняя ссылка — новая вкладка,
 * rel="noopener" (код футера уже это делает). Код не меняется — безопасно в любой момент, на сайте после сборки.
 * Меняется только «#» или пустое значение (--force — заменить любое).
 *
 * Опубликованный документ и черновик (если есть), резервная копия JSON в ~/forrest-backups/,
 * запись одной транзакцией, повторный запуск ничего не меняет. --dry — показать изменения без записи.
 *
 *   npm --prefix studio run -s sanity -- exec import/footer-credit-2026-11-27.mjs --with-user-token -- [--dry]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { getCliClient } from 'sanity/cli';

const HREF = 'https://well-done.com.ua/';
const dry = process.argv.includes('--dry');
const force = process.argv.includes('--force');
const client = getCliClient({ apiVersion: '2025-02-19' }).withConfig({ perspective: 'raw' });
const docs = await client.fetch('*[_id in ["siteSettings", "drafts.siteSettings"]]');
if (!docs.find((d) => d._id === 'siteSettings')) throw new Error('Документ siteSettings не знайдено');

const tx = client.transaction();
const log = [];
for (const doc of docs) {
  const cur = doc.footer?.credit?.href?.trim() ?? '';
  if (cur === HREF || (cur && cur !== '#' && !force)) continue;
  tx.patch(doc._id, (p) => p.ifRevisionId(doc._rev).setIfMissing({ footer: {} }).setIfMissing({ 'footer.credit': {} }).set({ 'footer.credit.href': HREF }));
  log.push(`${doc._id} футер · студія-розробник · посилання: «${cur}» → ${HREF}`);
}

log.forEach((s) => console.log(`${dry ? '[перевірка] ' : ''}${s}`));
if (!log.length) { console.log('Змін немає.'); process.exit(0); }
if (dry) { console.log(`--dry: змін ${log.length}. Запису немає.`); process.exit(0); }

const dir = path.join(homedir(), 'forrest-backups');
mkdirSync(dir, { recursive: true });
const backup = path.join(dir, `siteSettings-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}-before-footer-credit.json`);
writeFileSync(backup, JSON.stringify(docs, null, 2));
console.log(`Резервна копія: ${backup}`);
const res = await tx.commit();
console.log(`Записано: ${log.length} змін, транзакція ${res.transactionId}.`);
