/**
 * Hero: кнопка презентации открывает видео (2026-11-25) → «Головна сторінка» → «Перший екран» → «Відео презентації».
 *
 *   --stage add  — записывает адрес YouTube в поле presentationVideoUrl блока hero: то же видео, что сейчас
 *                  в блоке «Дохідність 365 днів на рік» (season → videoUrl), берётся из того же документа.
 *                  Уже заполненное поле не меняется (--force — заменить). Код кнопки и попапа уже на сайте
 *                  (4.17), поэтому запись безопасна до слияния: после ближайшей сборки кнопка откроет видео.
 *                  Второго этапа нет — удалять нечего.
 *
 * Опубликованный документ и черновик (если есть), резервная копия JSON в ~/forrest-backups/,
 * запись одной транзакцией, повторный запуск ничего не меняет. --dry — показать изменения без записи.
 *
 *   npm --prefix studio run -s sanity -- exec import/hero-video-2026-11-25.mjs --with-user-token -- --stage add [--dry]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { getCliClient } from 'sanity/cli';

const dry = process.argv.includes('--dry');
const force = process.argv.includes('--force');
const arg = (name) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined);
if (arg('--stage') !== 'add') throw new Error('Вкажіть --stage add (другого етапу немає)');

const client = getCliClient({ apiVersion: '2025-02-19' }).withConfig({ perspective: 'raw' });
const docs = await client.fetch('*[_id in ["landing", "drafts.landing"]]');
if (!docs.find((d) => d._id === 'landing')) throw new Error('Документ landing не знайдено');

const tx = client.transaction();
const log = [];
for (const doc of docs) {
  const hero = doc.blocks?.find((b) => b._type === 'hero');
  const season = doc.blocks?.find((b) => b._type === 'season');
  if (!hero) throw new Error(`${doc._id}: блоку «Перший екран» немає`);
  const url = season?.videoUrl?.trim();
  if (!url) throw new Error(`${doc._id}: у блоці «Дохідність 365 днів на рік» немає відео — нема чого копіювати`);
  if (hero.presentationVideoUrl && !force) continue;
  tx.patch(doc._id, (p) => p.ifRevisionId(doc._rev).set({ [`blocks[_key=="${hero._key}"].presentationVideoUrl`]: url }));
  log.push(`${doc._id} перший екран · відео презентації: ${hero.presentationVideoUrl ? `«${hero.presentationVideoUrl}» → ` : ''}${url}`);
}

log.forEach((s) => console.log(`${dry ? '[перевірка] ' : ''}${s}`));
if (!log.length) { console.log('Змін немає.'); process.exit(0); }
if (dry) { console.log(`--dry: змін ${log.length}. Запису немає.`); process.exit(0); }

const dir = path.join(homedir(), 'forrest-backups');
mkdirSync(dir, { recursive: true });
const backup = path.join(dir, `landing-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}-before-hero-video.json`);
writeFileSync(backup, JSON.stringify(docs, null, 2));
console.log(`Резервна копія: ${backup}`);
const res = await tx.commit();
console.log(`Записано: ${log.length} змін, транзакція ${res.transactionId}.`);
