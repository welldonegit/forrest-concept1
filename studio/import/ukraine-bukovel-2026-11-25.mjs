/**
 * Блоки «Переваги інвестування в Україну», «Фото між блоками», «Буковель» (выгрузка 2026-11-25,
 * design-export/updates/2026-11-25/ukraine-bukovel/) → документ landing, сразу после блока «Цифри» (stats).
 * У всех трёх «Мови, на яких показувати блок» = en: на украинской главной их нет.
 * Тексты — studio/import/ukraine-bukovel-2026-11-25-texts.mjs (uk — выгрузка, en — перевод, НЕ УТВЕРЖДЁН).
 * Фото — оригинал из выгрузки (сайт сам готовит размеры).
 *
 * Только добавляет: блок с таким _key уже есть — не трогает (--force — заменить). Безопасно и до слияния кода:
 * старый код неизвестные блоки пропускает. Опубликованный документ и черновик (если есть), резервная копия
 * в ~/forrest-backups/, одна транзакция. --dry — показать изменения без записи.
 *
 *   npm --prefix studio run -s sanity -- exec import/ukraine-bukovel-2026-11-25.mjs --with-user-token -- [--dry] [--force]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { getCliClient } from 'sanity/cli';
import { UKRAINE, PHOTO, BUKOVEL, LANGUAGES } from './ukraine-bukovel-2026-11-25-texts.mjs';

const dry = process.argv.includes('--dry');
const force = process.argv.includes('--force');
const IMG = new URL('../../design-export/updates/2026-11-25/ukraine-bukovel/img/', import.meta.url);
const client = getCliClient({ apiVersion: '2025-02-19' }).withConfig({ perspective: 'raw' });

const str = (byLang) => Object.entries(byLang).filter(([, v]) => v).map(([language, value]) => ({ _key: language, _type: 'internationalizedArrayStringValue', language, value }));
const txt = (byLang) => Object.entries(byLang).map(([language, value]) => ({ _key: language, _type: 'internationalizedArrayTextValue', language, value }));
const group = (type, byLang) => Object.entries(byLang).map(([language, value]) => ({
  _key: language, _type: `internationalizedArray${type[0].toUpperCase()}${type.slice(1)}Value`, language,
  value: { _type: type, ...Object.fromEntries(Object.entries(value).filter(([, v]) => v)) },
}));
const lines = (title) => title.map((l, n) => ({ _key: `t${n + 1}`, _type: 'whyTitleLine', text: str({ uk: l.uk, en: l.en }), muted: Boolean(l.muted) }));

let photoRef;
async function photo() {
  photoRef ??= dry ? `(${PHOTO.file})` : (await client.assets.upload('image', readFileSync(new URL(PHOTO.file, IMG)), { filename: PHOTO.file }))._id;
  return {
    _type: 'photo', asset: { _type: 'reference', _ref: photoRef },
    hotspot: { _type: 'sanity.imageHotspot', ...PHOTO.hotspot, width: 1, height: 1 },
    decorative: false, alt: str(PHOTO.alt),
  };
}

async function blocks() {
  return [
    {
      _key: 'whyUkraine', _type: 'whyUkraine', hidden: false, languages: LANGUAGES, anchor: UKRAINE.anchor,
      title: lines(UKRAINE.title),
      texts: group('whyUkraineTexts', { uk: { lead: UKRAINE.lead.uk }, en: { lead: UKRAINE.lead.en } }),
      cards: UKRAINE.cards.map((c) => ({
        _key: c.key, _type: 'whyUkraineCard', ...(c.value ? { value: c.value } : {}),
        texts: group('whyUkraineCardTexts', { uk: c.uk, en: c.en }),
        visual: c.visual, ...(c.barPercent !== undefined ? { barPercent: c.barPercent } : {}), dark: Boolean(c.dark),
      })),
    },
    { _key: 'photoBand', _type: 'photoBand', hidden: false, languages: LANGUAGES, image: await photo() },
    {
      _key: 'whyBukovel', _type: 'whyBukovel', hidden: false, languages: LANGUAGES, anchor: BUKOVEL.anchor,
      title: lines(BUKOVEL.title),
      texts: group('whyBukovelTexts', { uk: { lead: BUKOVEL.lead.uk }, en: { lead: BUKOVEL.lead.en } }),
      rows: BUKOVEL.rows.map((r) => ({ _key: r.key, _type: 'whyBukovelRow', value: r.value, texts: group('whyBukovelRowTexts', { uk: r.uk, en: r.en }) })),
    },
  ];
}

const docs = await client.fetch('*[_id in ["landing", "drafts.landing"]]');
if (!docs.find((d) => d._id === 'landing')) throw new Error('Документ landing не знайдено');

const tx = client.transaction();
const log = [];
for (const doc of docs) {
  const have = new Set((doc.blocks ?? []).map((b) => b._key));
  const todo = (await blocks()).filter((b) => force || !have.has(b._key));
  if (!todo.length) continue;
  if (!have.has('stats')) throw new Error(`${doc._id}: немає блоку stats — нікуди вставити`);
  tx.patch(doc._id, (p) => {
    let q = p.ifRevisionId(doc._rev);
    if (force) q = q.unset(todo.filter((b) => have.has(b._key)).map((b) => `blocks[_key=="${b._key}"]`));
    return q.insert('after', 'blocks[_key=="stats"]', todo);
  });
  for (const b of todo) log.push(`${doc._id} · після «Цифри»: ${b._type} (мови: ${b.languages.join(', ')})`);
}

log.forEach((s) => console.log(`${dry ? '[перевірка] ' : ''}${s}`));
if (!log.length) { console.log('Змін немає.'); process.exit(0); }
if (dry) { console.log('--dry: запису немає.'); process.exit(0); }

const dir = path.join(homedir(), 'forrest-backups');
mkdirSync(dir, { recursive: true });
const backup = path.join(dir, `landing-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}-before-ukraine-bukovel.json`);
writeFileSync(backup, JSON.stringify(docs, null, 2));
console.log(`Резервна копія: ${backup}`);
const res = await tx.commit();
console.log(`Записано, транзакція ${res.transactionId}.`);
