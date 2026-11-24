/**
 * SEO-тексты (этап 6) → Sanity: title и description главной, архива, «Дякуємо» и документов, название сайта.
 * Тексты — import/seo/texts.json (в Git; решение человека 2026-11-24). Английские помечаются «не затверджено».
 *
 * Поле записывается, только если в Sanity оно пустое, равно значению из выгрузки (фикстуры
 * src/content-fixtures/ — первый импорт) или прежнему тексту этого скрипта (texts.json → replaced: заменённые
 * человеком варианты; при замене текста старый вариант добавляется туда). Иначе его заполнили в Studio руками — НЕ перезаписывается,
 * скрипт показывает такие поля (--force — перезаписать). Совпадает с нужным — «без змін».
 * Правится опубликованный документ и черновик, если он есть (тем же правилом).
 * Всё — одной транзакцией: вебхук → Deploy Hook получает вызовы за секунду, Cloudflare делает одну сборку.
 *
 * Запуск (из корня проекта, нужен вход в Sanity CLI):
 *   npm --prefix studio run -s sanity -- exec import/seo-texts.mjs --with-user-token -- [--dry] [--force]
 */
import { readFileSync } from 'node:fs';
import { getCliClient } from 'sanity/cli';

const args = process.argv.slice(2).filter((a) => a !== '--');
const dry = args.includes('--dry');
const force = args.includes('--force');
const read = (rel) => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8'));
const { siteName, unapproved, pages, replaced = [] } = read('./seo/texts.json');
const fixtureSettings = read('../../src/content-fixtures/siteSettings.json');

/** Куда пишется каждая страница: документ, массив переводов, поля title/description, прежнее значение из выгрузки. */
const fx = (obj, field, lang) => obj?.[field]?.find?.((i) => (i.language ?? i._key) === lang)?.value;
const TARGETS = {
  home: { id: 'siteSettings', array: 'seo.texts', type: 'seoTexts', fields: ['title', 'description'], fixture: (f, l) => fx(fixtureSettings.seo, f, l) },
  archive: { id: 'siteSettings', array: 'archivePage.texts', type: 'archivePageTexts', fields: ['seoTitle', 'seoDescription'], fixture: (f, l) => fx(fixtureSettings.archivePage, f, l) },
  thanks: { id: 'siteSettings', array: 'thanksPage.texts', type: 'thanksPageTexts', fields: ['seoTitle', 'seoDescription'], fixture: (f, l) => fx(fixtureSettings.thanksPage, f, l) },
};
for (const id of Object.keys(pages).filter((k) => k.startsWith('legal-'))) {
  TARGETS[id] = { id, array: 'texts', type: 'legalDocumentTexts', fields: ['seoTitle', 'seoDescription'], fixture: () => undefined };
}

const client = getCliClient({ apiVersion: '2025-02-19' }).withConfig({ perspective: 'raw' });
const ids = [...new Set(Object.values(TARGETS).map((t) => t.id))];
const docs = new Map((await client.fetch('*[_id in $ids]', { ids: [...ids, ...ids.map((i) => `drafts.${i}`)] })).map((d) => [d._id, d]));
for (const id of ids) if (!docs.has(id)) throw new Error(`В Sanity нет документа ${id}`);

const get = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);
const kept = [];
const log = [];
const patches = new Map(); // _id → { set: {}, insert: [] }
const patchOf = (id) => { if (!patches.has(id)) patches.set(id, { set: {}, append: [] }); return patches.get(id); };
let changed = 0;

for (const [page, t] of Object.entries(TARGETS)) {
  for (const target of [t.id, `drafts.${t.id}`]) {
    const doc = docs.get(target);
    if (!doc) continue;
    const items = get(doc, t.array) ?? [];
    for (const [lang, values] of Object.entries(pages[page])) {
      const item = items.find((i) => (i.language ?? i._key) === lang);
      const wanted = { [t.fields[0]]: values.title, [t.fields[1]]: values.description };
      if (!item) {
        // языка в документе ещё нет — добавляем элемент перевода только с SEO-полями
        if (t.id === 'siteSettings' && page !== 'home') { kept.push(`${target} ${page} ${lang}: нет перевода страницы — пропуск`); continue; }
        patchOf(target).append.push({ path: t.array, item: { _key: lang, _type: `internationalizedArray${t.type[0].toUpperCase()}${t.type.slice(1)}Value`, language: lang, value: { _type: t.type, ...wanted } } });
        changed += 2; log.push(`${target} ${page} ${lang}: новий переклад (${t.fields.join(', ')})`);
        continue;
      }
      for (const f of t.fields) {
        const now = item.value?.[f];
        const want = wanted[f];
        if (now === want) continue;
        const untouched = now === undefined || now === null || String(now).trim() === '' || now === t.fixture(f, lang) || replaced.includes(now);
        if (!untouched && !force) { kept.push(`${target} · ${page} · ${lang} · ${f}: у Studio «${now}» — не перезаписано`); continue; }
        patchOf(target).set[`${t.array}[_key=="${item._key}"].value.${f}`] = want;
        changed++; log.push(`${target} ${page} ${lang} ${f}: «${now ?? ''}» → «${want}»`);
      }
    }
  }
}

/* Название сайта и пометка «переклад не затверджено» */
for (const target of ['siteSettings', 'drafts.siteSettings']) {
  const doc = docs.get(target);
  if (!doc) continue;
  const now = doc.seo?.siteName;
  if (!now) { patchOf(target).set['seo.siteName'] = siteName; changed++; log.push(`${target} seo.siteName → «${siteName}»`); }
  else if (now !== siteName) kept.push(`${target} · seo.siteName: у Studio «${now}» — не перезаписано`);
  const marks = doc.seo?.unapprovedLanguages ?? [];
  const add = unapproved.filter((l) => !marks.includes(l));
  if (add.length) { patchOf(target).set['seo.unapprovedLanguages'] = [...marks, ...add]; changed++; log.push(`${target} seo.unapprovedLanguages + ${add.join(', ')}`); }
}
for (const id of ids.filter((i) => i.startsWith('legal-'))) {
  for (const target of [id, `drafts.${id}`]) {
    const doc = docs.get(target);
    if (!doc) continue;
    const marks = doc.unapprovedLanguages ?? [];
    const add = unapproved.filter((l) => !marks.includes(l));
    if (add.length) { patchOf(target).set.unapprovedLanguages = [...marks, ...add]; changed++; log.push(`${target} unapprovedLanguages + ${add.join(', ')}`); }
  }
}

log.forEach((s) => console.log(`${dry ? '[перевірка] ' : ''}${s}`));
if (kept.length) { console.log('\nНе перезаписано (заповнено в Studio):'); kept.forEach((s) => console.log(`  ! ${s}`)); }
if (!changed) { console.log('Записувати нічого.'); process.exit(0); }
if (dry) { console.log(`\nБуде одна транзакція: ${patches.size} документів, ${changed} полів.`); process.exit(0); }

const tx = client.transaction();
for (const [id, p] of patches) {
  let patch = client.patch(id).ifRevisionId(docs.get(id)._rev);
  if (Object.keys(p.set).length) patch = patch.set(p.set);
  for (const a of p.append) patch = patch.setIfMissing({ [a.path]: [] }).append(a.path, [a.item]);
  tx.patch(patch);
}
const res = await tx.commit({ visibility: 'sync' });
console.log(`\nГотово: одна транзакція ${res.transactionId}, документів ${patches.size}, полів ${changed}.`);
