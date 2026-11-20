/**
 * Перенос ОДНОГО поля документа из результата импорта (import/out/content.ndjson,
 * собирается `npm run import:build` из src/content-fixtures/) в Sanity — без полной
 * замены документа (dataset import --replace перезаписал бы правки, сделанные в Studio).
 *
 * Запуск (из studio/, нужен вход в Sanity):
 *   npm run import:build && npx sanity exec import/patch-field.mjs --with-user-token -- <id документа> <поле> [--force] [--dry]
 * Пример: … -- siteSettings notFoundPage
 *
 * По умолчанию поле записывается, только если его в Sanity ещё нет (правки из Studio
 * не затираются); --force — перезаписать; --dry — только показать, что будет записано.
 * Правится опубликованный документ и черновик, если он есть.
 */
import { readFileSync } from 'node:fs';
import { getCliClient } from 'sanity/cli';

const args = process.argv.slice(2).filter((a) => a !== '--');
const flags = new Set(args.filter((a) => a.startsWith('--')));
const [docId, field] = args.filter((a) => !a.startsWith('--'));
if (!docId || !field) {
  console.error('Нужно: <id документа> <поле>, например siteSettings notFoundPage');
  process.exit(1);
}

const source = new URL('./out/content.ndjson', import.meta.url);
const doc = readFileSync(source, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((d) => d._id === docId);
const value = doc?.[field];
if (value === undefined) {
  console.error(`В import/out/content.ndjson нет ${docId}.${field} — сначала npm run import:build`);
  process.exit(1);
}

const client = getCliClient({ apiVersion: '2025-02-19' }).withConfig({ perspective: 'raw' });
const docs = await client.fetch('*[_id in $ids]{_id, _rev, "current": @[$field]}', { ids: [docId, `drafts.${docId}`], field });
if (!docs.length) {
  console.error(`В Sanity нет документа ${docId}`);
  process.exit(1);
}

const tx = client.transaction();
let changes = 0;
for (const d of docs) {
  if (d.current != null && !flags.has('--force')) {
    console.log(`${d._id}.${field}: уже заполнено — пропуск (--force, чтобы перезаписать)`);
    continue;
  }
  console.log(`${d._id}.${field}: ${flags.has('--dry') ? 'будет записано' : 'записываю'}`);
  tx.patch(d._id, (p) => p.ifRevisionId(d._rev).set({ [field]: value }));
  changes++;
}
if (flags.has('--dry')) {
  console.log(JSON.stringify(value, null, 1));
} else if (changes) {
  await tx.commit();
  console.log('Готово. Сайт пересоберётся по Deploy Hook, если он настроен; иначе — Retry deployment в Workers Builds.');
}
