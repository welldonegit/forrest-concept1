/**
 * Правки заказчика 2026-11-26. Запись безопасна для текущего сайта до слияния: добавляются только новые
 * поля, которые старый код не читает; старые поля и варианты не удаляются и не меняются.
 *
 * 1. Финальная форма: «Який формат інвестиції…» → «Категорія інвестиції» (варианты — форматы блока «Апартаменти»).
 *    - «Формати апартаментів» → «Ціна від, $» (priceFrom): значения из таблицы заказчика. Уже заполненная цена
 *      сверяется с таблицей; при расхождении записывается значение таблицы (в журнале — «розбіжність»).
 *      Площадь только сверяется с таблицей (расхождение — предупреждение, не меняется).
 *    - «Головна сторінка» → «Фінальна форма» → тексты uk/en: подпись поля, текст пустого поля, шаблон цены.
 *      Заполненные тексты не меняются (--force — заменить), кроме текстов первой версии скрипта («Категорія
 *      інвестиції», «Оберіть категорію інвестиції» и их en) — они заменяются уточнёнными. en — «Переклад не затверджено».
 *    - «Питання про мету інвестиції» и «Варіанти мети» остаются как есть (на сайте не используются).
 * 2. Блок «Команда»: переключатель «Показувати фото людей» = выключено (showPhotos: false). Уже заданное
 *    значение не меняется. Фото в цитатах не удаляются; до слияния сайт их показывает, как раньше.
 *
 * Опубликованные документы и черновики (если есть), резервная копия JSON в ~/forrest-backups/,
 * запись одной транзакцией, повторный запуск ничего не меняет. --dry — показать изменения без записи.
 *
 *   npm --prefix studio run -s sanity -- exec import/customer-edits-2026-11-26.mjs --with-user-token -- [--dry]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { getCliClient } from 'sanity/cli';

const dry = process.argv.includes('--dry');
const force = process.argv.includes('--force');

/** Таблица заказчика: площадь (как на сайте, uk) и цена «від», $. */
const FORMATS = {
  Superior: { area: '29,5–34,5 м²', price: 132750 },
  Deluxe: { area: '43,0–50,9 м²', price: 197800 },
  'Family Suite': { area: '57,5–60,5 м²', price: 269100 },
  'Junior Suite': { area: '77,3–91,6 м²', price: 347850 },
  Presidential: { area: '111,0–111,5 м²', price: 499500 },
};

/** Тексты поля категории (уточнены заказчиком 2026-11-26); {n} — цена. en — не затверждён. */
const CATEGORY_TEXTS = {
  uk: { categoryLabel: 'Яка категорія апартаментів вас цікавить?', categoryPlaceholder: 'Оберіть категорію', categoryPrice: 'від {n} $' },
  en: { categoryLabel: 'Which apartment category are you interested in?', categoryPlaceholder: 'Select a category', categoryPrice: 'from ${n}' },
};
/** Тексты первой версии этого скрипта: если записаны ими — заменяются новыми без --force. */
const PREVIOUS = {
  uk: { categoryLabel: 'Категорія інвестиції', categoryPlaceholder: 'Оберіть категорію інвестиції' },
  en: { categoryLabel: 'Investment category', categoryPlaceholder: 'Choose an investment category' },
};

const client = getCliClient({ apiVersion: '2025-02-19' }).withConfig({ perspective: 'raw' });
const landingDocs = await client.fetch('*[_id in ["landing", "drafts.landing"]]');
const formatDocs = await client.fetch('*[_type == "apartmentFormat"]');
if (!landingDocs.find((d) => d._id === 'landing')) throw new Error('Документ landing не знайдено');

const tx = client.transaction();
const log = [];
const warn = [];
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

// 1. Цена «від» у форматов
for (const name of Object.keys(FORMATS)) {
  if (!formatDocs.some((d) => d.name === name && !d._id.startsWith('drafts.'))) throw new Error(`Формат «${name}» не знайдено серед опублікованих`);
}
for (const doc of formatDocs) {
  const row = FORMATS[doc.name];
  if (!row) { warn.push(`${doc._id}: формату «${doc.name}» немає в таблиці замовника — ціну не записано`); continue; }
  const area = doc.texts?.find((t) => t.language === 'uk')?.value?.area;
  if (norm(area) !== norm(row.area)) warn.push(`${doc._id} ${doc.name}: площа в Sanity «${area ?? ''}», у таблиці «${row.area}» — не змінено`);
  if (doc.priceFrom === row.price) continue;
  tx.patch(doc._id, (p) => p.ifRevisionId(doc._rev).set({ priceFrom: row.price }));
  log.push(`${doc._id} ${doc.name} · ціна від: ${doc.priceFrom == null ? '—' : `${doc.priceFrom} (розбіжність з таблицею)`} → ${row.price}`);
}

// 2. Тексты финальной формы
for (const doc of landingDocs) {
  const id = doc._id;
  const block = doc.blocks?.find((b) => b._type === 'formFinal');
  if (!block) throw new Error(`${id}: блоку «Фінальна форма» немає`);
  const set = {};
  const cur = block.texts ?? [];
  let enAdded = false;
  const next = cur.map((t) => {
    const add = CATEGORY_TEXTS[t.language];
    if (!add) return t;
    const value = { ...t.value };
    for (const [k, v] of Object.entries(add)) {
      if (value[k] && (value[k] === v || (!force && value[k] !== PREVIOUS[t.language]?.[k]))) continue;
      log.push(`${id} фінальна форма (${t.language}) · ${k}: ${value[k] ? `«${value[k]}» → ` : ''}«${v}»`);
      value[k] = v;
      if (t.language === 'en') enAdded = true;
    }
    return { ...t, value };
  });
  for (const language of Object.keys(CATEGORY_TEXTS)) {
    if (cur.some((t) => t.language === language)) continue;
    next.push({ _key: language, _type: 'internationalizedArrayFormFinalTextsValue', language, value: { _type: 'formFinalTexts', ...CATEGORY_TEXTS[language] } });
    log.push(`${id} фінальна форма (${language}) · тексти категорії додано`);
    if (language === 'en') enAdded = true;
  }
  const base = `blocks[_key=="${block._key}"]`;
  if (JSON.stringify(next) !== JSON.stringify(cur)) set[`${base}.texts`] = next;
  if (enAdded && !block.unapprovedLanguages?.includes('en')) {
    set[`${base}.unapprovedLanguages`] = [...(block.unapprovedLanguages ?? []), 'en'];
    log.push(`${id} фінальна форма · «Переклад не затверджено»: en`);
  }

  // «Команда» → «Показувати фото людей»: выключено
  const team = doc.blocks?.find((b) => b._type === 'team');
  if (!team) throw new Error(`${id}: блоку «Команда» немає`);
  if (typeof team.showPhotos !== 'boolean') {
    set[`blocks[_key=="${team._key}"].showPhotos`] = false;
    log.push(`${id} команда · «Показувати фото людей»: вимкнено`);
  }

  if (Object.keys(set).length) tx.patch(id, (p) => p.ifRevisionId(doc._rev).set(set));
}

warn.forEach((s) => console.warn(`Увага: ${s}`));
log.forEach((s) => console.log(`${dry ? '[перевірка] ' : ''}${s}`));
if (!log.length) { console.log('Змін немає.'); process.exit(0); }
if (dry) { console.log(`--dry: змін ${log.length}. Запису немає.`); process.exit(0); }

const dir = path.join(homedir(), 'forrest-backups');
mkdirSync(dir, { recursive: true });
const backup = path.join(dir, `landing-formats-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}-before-customer-edits.json`);
writeFileSync(backup, JSON.stringify({ landing: landingDocs, apartmentFormats: formatDocs }, null, 2));
console.log(`Резервна копія: ${backup}`);
const res = await tx.commit();
console.log(`Записано: ${log.length} змін, транзакція ${res.transactionId}.`);
