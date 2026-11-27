/**
 * Google Search Console: код подтверждения (метатег google-site-verification) → «Налаштування сайту» →
 * «Технічне» → «Аналітика» → «Код підтвердження Google Search Console» (2026-11-27).
 * Безопасно до слияния: старый код поле не читает. Метатег появится на сайте после сборки с новым кодом.
 * Уже заполненное другое значение не меняется (--force — заменить).
 *
 * Опубликованный документ и черновик (если есть), резервная копия JSON в ~/forrest-backups/,
 * запись одной транзакцией, повторный запуск ничего не меняет. --dry — показать изменения без записи.
 *
 *   npm --prefix studio run -s sanity -- exec import/google-verification-2026-11-27.mjs --with-user-token -- [--dry]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { getCliClient } from 'sanity/cli';

const CODE = 'j9e2jpOwmgbj1HZEBOA02p33SdKb0JH6NQv8WwVzQSg';
const dry = process.argv.includes('--dry');
const force = process.argv.includes('--force');
const client = getCliClient({ apiVersion: '2025-02-19' }).withConfig({ perspective: 'raw' });
const docs = await client.fetch('*[_id in ["siteSettings", "drafts.siteSettings"]]');
if (!docs.find((d) => d._id === 'siteSettings')) throw new Error('Документ siteSettings не знайдено');

const tx = client.transaction();
const log = [];
for (const doc of docs) {
  const cur = doc.analytics?.googleSiteVerification?.trim() ?? '';
  if (cur === CODE || (cur && !force)) continue;
  tx.patch(doc._id, (p) => p.ifRevisionId(doc._rev).setIfMissing({ analytics: {} }).set({ 'analytics.googleSiteVerification': CODE }));
  log.push(`${doc._id} аналітика · код Google Search Console: «${cur}» → ${CODE}`);
}

log.forEach((s) => console.log(`${dry ? '[перевірка] ' : ''}${s}`));
if (!log.length) { console.log('Змін немає.'); process.exit(0); }
if (dry) { console.log(`--dry: змін ${log.length}. Запису немає.`); process.exit(0); }

const dir = path.join(homedir(), 'forrest-backups');
mkdirSync(dir, { recursive: true });
const backup = path.join(dir, `siteSettings-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}-before-google-verification.json`);
writeFileSync(backup, JSON.stringify(docs, null, 2));
console.log(`Резервна копія: ${backup}`);
const res = await tx.commit();
console.log(`Записано: ${log.length} змін, транзакція ${res.transactionId}.`);
