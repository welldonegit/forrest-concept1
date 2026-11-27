/**
 * Infrastructure, карточка «Конференц-зали» (items[_key=="i5"]), en (2026-11-27): заглушка «CONFERENCE HALLS FOR
 * [FACT: N] PEOPLE» → перевод украинского текста, который стоит на сайте (числа мест нет и в uk).
 * Меняются только два значения en: заголовок и текст. uk не меняется: если в uk не тот текст, с которого
 * сделан перевод, скрипт останавливается и показывает оба варианта. Код не меняется — безопасно в любой момент.
 *
 * Опубликованный документ и черновик (если есть), резервная копия JSON в ~/forrest-backups/,
 * запись одной транзакцией, повторный запуск ничего не меняет. --dry — показать изменения без записи.
 *
 *   npm --prefix studio run -s sanity -- exec import/infrastructure-en-2026-11-27.mjs --with-user-token -- [--dry]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { getCliClient } from 'sanity/cli';

const ITEM = 'i5';
const UK = {
  title: 'КОНФЕРЕНЦ-ЗАЛИ',
  text: 'Залу можна розставити як театр, клас, банкет або круглий стіл. Поруч 4–6 переговорних і коворкінг.',
};
const EN = {
  title: 'CONFERENCE HALLS',
  text: 'The hall can be set up theatre-style, classroom-style, for a banquet or as a round table. 4–6 meeting rooms and a coworking space are next door.',
};

const dry = process.argv.includes('--dry');
const client = getCliClient({ apiVersion: '2025-02-19' }).withConfig({ perspective: 'raw' });
const docs = await client.fetch('*[_id in ["landing", "drafts.landing"]]');
if (!docs.find((d) => d._id === 'landing')) throw new Error('Документ landing не знайдено');

const tx = client.transaction();
const log = [];
for (const doc of docs) {
  const id = doc._id;
  const block = doc.blocks?.find((b) => b._type === 'infrastructure');
  const item = block?.items?.find((i) => i._key === ITEM);
  if (!item) throw new Error(`${id}: у блоці «Інфраструктура» немає картки ${ITEM}`);
  const uk = item.texts?.find((t) => t.language === 'uk')?.value ?? {};
  const en = item.texts?.find((t) => t.language === 'en');
  if (!en) throw new Error(`${id}: у картці ${ITEM} немає en`);
  for (const k of ['title', 'text']) {
    if (uk[k] !== UK[k]) throw new Error(`${id}: uk ${k} відрізняється від тексту, з якого зроблено переклад:\n  у Sanity: «${uk[k]}»\n  очікувано: «${UK[k]}»\nНічого не записано.`);
  }
  const set = {};
  const base = `blocks[_key=="${block._key}"].items[_key=="${ITEM}"].texts[_key=="${en._key}"].value`;
  for (const k of ['title', 'text']) {
    if (en.value?.[k] === EN[k]) continue;
    set[`${base}.${k}`] = EN[k];
    log.push(`${id} інфраструктура · ${ITEM} (en) · ${k}: «${en.value?.[k] ?? ''}» → «${EN[k]}»`);
  }
  if (Object.keys(set).length) tx.patch(id, (p) => p.ifRevisionId(doc._rev).set(set));
}

log.forEach((s) => console.log(`${dry ? '[перевірка] ' : ''}${s}`));
if (!log.length) { console.log('Змін немає.'); process.exit(0); }
if (dry) { console.log(`--dry: змін ${log.length}. Запису немає.`); process.exit(0); }

const dir = path.join(homedir(), 'forrest-backups');
mkdirSync(dir, { recursive: true });
const backup = path.join(dir, `landing-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}-before-infrastructure-en.json`);
writeFileSync(backup, JSON.stringify(docs, null, 2));
console.log(`Резервна копія: ${backup}`);
const res = await tx.commit();
console.log(`Записано: ${log.length} змін, транзакція ${res.transactionId}.`);
