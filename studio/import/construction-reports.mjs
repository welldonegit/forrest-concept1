/**
 * «Хід будівництва»: звіти місяців з папки «ход строительства» в корені проєкту → документи constructionReport у Sanity.
 * Як додати місяць — docs/ADMIN.md, розділ «Хід будівництва: новий місяць скриптом».
 *
 * Джерела:
 *   - «ход строительства/*.docx» — один файл, усі місяці. Місяць починається рядком «СЕРПЕНЬ 2026»
 *     (назва місяця і рік, окремим абзацом). Далі: перший звичайний абзац — заголовок, пункти списку —
 *     «Виконані роботи», інші звичайні абзаци — «Текст». Абзац з посиланням на YouTube — дрон-відео.
 *     Текст переноситься дослівно; лише зайві пробіли стискаються до одного.
 *   - «ход строительства/будівництво фото/<місяць>/» — фото місяця (папка «серпень» тощо). Порядок — за іменем файлу.
 *     Порожня папка або її відсутність — звіт за місяць не робиться, навіть якщо текст є.
 *   - import/construction/<РРРР-ММ>.json (у Git) — опис кожного фото (uk обовʼязково, en), черга,
 *     відео (тривалість), англійський переклад заголовка, тексту й робіт. Заготовку робить --init.
 *
 * Запис:
 *   - фото завантажуються оригіналами (той самий файл; уже завантажене — за sha1 — не дублюється);
 *   - документи пишуться ОДНІЄЮ транзакцією: вебхук Sanity → Deploy Hook Cloudflare отримує виклики
 *     за одну секунду, і Cloudflare робить одну збірку (повтори, поки збірка в черзі, пропускаються);
 *   - документ уже є і відрізняється від того, що зібрав би скрипт (правили в Studio або змінилися
 *     джерела), — НЕ перезаписується; скрипт показує різницю. --force <РРРР-ММ> — перезаписати цей місяць;
 *   - є чернетка (drafts.report-…) — місяць пропускається: хтось редагує в Studio;
 *   - заглушки з вихідної вигрузки (STUBS) видаляються, якщо їх не змінювали.
 *
 * Запуск (з кореня проєкту, потрібен вхід у Sanity CLI):
 *   npm --prefix studio run -s sanity -- exec import/construction-reports.mjs --with-user-token -- [--dry] [--init] [--force 2026-11]
 *   --dry  — тільки показати, що буде (нічого не завантажує й не пише);
 *   --init — створити заготовки import/construction/<РРРР-ММ>.json для нових місяців і зупинитися.
 */
import { readFileSync, readdirSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, extname } from 'node:path';
import { unzip, topLevel, paragraph, numberingFormats } from './docx.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const SOURCE = join(root, 'ход строительства');
const PHOTOS = join(SOURCE, 'будівництво фото');
const DATA = join(here, 'construction');

const MONTHS = ['січень', 'лютий', 'березень', 'квітень', 'травень', 'червень', 'липень', 'серпень', 'вересень', 'жовтень', 'листопад', 'грудень'];
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

/** Заглушки з вигрузки (імпорт 2026-11-19): видаляються, лише якщо ревізія та сама, тобто їх не правили. */
const STUBS = Object.fromEntries(
  ['2026-05-29', '2026-06-27', '2026-07-30', '2026-08-29', '2026-09-26', '2026-10-28'].map((d) => [`report-${d}`, 'xFNyp6l3TAmGiWU7eNVnPU']),
);

const args = process.argv.slice(2).filter((a) => a !== '--');
const dry = args.includes('--dry');
const init = args.includes('--init');
const force = new Set(args.filter((a, i) => args[i - 1] === '--force'));

const keyOf = (...parts) => createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 12);
const log = (s) => console.log(`${dry ? '[перевірка] ' : ''}${s}`);
const fail = (s) => { console.error(`✗ ${s}`); process.exit(1); };
const byName = (a, b) => a.localeCompare(b, 'uk', { numeric: true });

/* ---------- docx: місяці ---------- */

function readDocx() {
  if (!existsSync(SOURCE)) fail(`немає папки ${SOURCE}`);
  const docs = readdirSync(SOURCE).filter((f) => f.toLowerCase().endsWith('.docx') && !f.startsWith('~$'));
  if (docs.length !== 1) fail(`у «ход строительства» має бути один .docx, знайдено: ${docs.join(', ') || 'жодного'}`);
  const zip = unzip(readFileSync(join(SOURCE, docs[0])));
  const xml = zip.get('word/document.xml').toString('utf8');
  const rels = new Map([...(zip.get('word/_rels/document.xml.rels')?.toString('utf8') ?? '').matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)].map((m) => [m[1], m[2]]));
  const numFmt = numberingFormats(zip);
  const body = xml.slice(xml.indexOf('<w:body>'), xml.indexOf('</w:body>'));

  const sections = new Map();
  let cur = null;
  for (const part of topLevel(body, ['p', 'tbl'])) {
    if (part.tag === 'tbl') fail('у документі таблиця — скрипт її не переносить');
    const p = paragraph(part.xml, numFmt);
    const text = p.text.replace(/\*\*/g, '').trim();
    const links = [...part.xml.matchAll(/<w:hyperlink [^>]*r:id="([^"]+)"/g)].map((m) => rels.get(m[1])).filter(Boolean);
    const youtube = [...links, ...(text.match(/https?:\/\/\S+/g) ?? [])].find((u) => /youtube\.com|youtu\.be/.test(u));
    const head = text.match(/^([А-ЯҐЄІЇа-яґєії']+)\s+(\d{4})$/);
    if (head && MONTHS.includes(head[1].toLowerCase())) {
      const month = `${head[2]}-${String(MONTHS.indexOf(head[1].toLowerCase()) + 1).padStart(2, '0')}`;
      if (sections.has(month)) fail(`місяць ${text} у документі двічі`);
      cur = { month, heading: text, title: '', text: [], works: [], video: undefined };
      sections.set(month, cur);
      continue;
    }
    if (!text && !youtube) continue;
    if (!cur) fail(`текст до першого заголовка місяця: «${text}»`);
    if (youtube) { cur.video = youtube; continue; }
    if (p.list) cur.works.push(text);
    else if (!cur.title) cur.title = text;
    else cur.text.push(text);
  }
  return sections;
}

/* ---------- фото ---------- */

function photoFolders() {
  const out = new Map();
  if (!existsSync(PHOTOS)) return out;
  for (const name of readdirSync(PHOTOS)) {
    const dir = join(PHOTOS, name);
    if (!statSync(dir).isDirectory()) continue;
    const idx = MONTHS.indexOf(name.toLowerCase().replace(/\s*\d{4}\s*/, '').trim());
    if (idx < 0) fail(`папка фото «${name}»: назва не місяць (очікується «серпень» або «серпень 2027»)`);
    const year = name.match(/\d{4}/)?.[0];
    const files = readdirSync(dir).filter((f) => IMAGE_EXT.has(extname(f).toLowerCase())).sort(byName);
    const other = readdirSync(dir).filter((f) => !IMAGE_EXT.has(extname(f).toLowerCase()) && !f.startsWith('.'));
    if (other.length) fail(`папка «${name}»: не фото (jpg, png, webp): ${other.join(', ')}`);
    out.set(name, { idx, year, dir, files });
  }
  return out;
}

/* ---------- зведення ---------- */

const sections = readDocx();
const folders = photoFolders();

/** Місяць тексту → папка фото: «серпень 2027» точніше за «серпень»; рік без папки з роком — з документа. */
function folderFor(month) {
  const [y, m] = month.split('-').map(Number);
  const candidates = [...folders.entries()].filter(([, f]) => f.idx === m - 1 && (!f.year || Number(f.year) === y));
  const exact = candidates.find(([, f]) => f.year);
  return exact ?? candidates[0];
}

const plan = [];
const notes = [];
const usedFolders = new Set();
for (const s of sections.values()) {
  const found = folderFor(s.month);
  if (found) usedFolders.add(found[0]);
  if (!found || !found[1].files.length) { notes.push(`${s.heading}: текст є, фото немає — звіт не робиться`); continue; }
  plan.push({ ...s, folder: found[0], ...found[1] });
}
for (const [name, f] of folders) {
  if (!usedFolders.has(name) && f.files.length) notes.push(`папка «${name}»: ${f.files.length} фото, тексту в документі немає — пропуск`);
}

console.log('\nМісяць    | Заголовок | Черга | Тексту, знаків | Робіт | Фото | Дрон-відео');
for (const s of [...sections.values()].sort((a, b) => a.month.localeCompare(b.month))) {
  const p = plan.find((x) => x.month === s.month);
  const meta = p && existsSync(join(DATA, `${s.month}.json`)) ? JSON.parse(readFileSync(join(DATA, `${s.month}.json`), 'utf8')) : {};
  const chars = [s.title, ...s.text, ...s.works].join('').length;
  console.log(`${s.month}   | ${s.title} | ${meta.queue ?? 'загальний'} | ${chars} | ${s.works.length} | ${p ? p.files.length : 0} | ${s.video ? 'так' : 'ні'}`);
}
for (const n of notes) console.log(`  ! ${n}`);

/* ---------- заготовки JSON ---------- */

if (init) {
  for (const p of plan) {
    const file = join(DATA, `${p.month}.json`);
    if (existsSync(file)) { console.log(`${p.month}.json вже є — не чіпаю`); continue; }
    const skeleton = {
      queue: null,
      video: p.video ? { duration: '' } : null,
      photos: Object.fromEntries(p.files.map((f) => [f, { uk: '', en: '' }])),
      en: { approved: false, title: '', text: '', works: p.works.map(() => '') },
    };
    writeFileSync(file, `${JSON.stringify(skeleton, null, 2)}\n`);
    console.log(`створено import/construction/${p.month}.json — заповніть описи фото й переклад`);
  }
  process.exit(0);
}

/* ---------- документи ---------- */

const i18n = (type, entries) => entries.filter(([, v]) => v !== undefined && v !== '' && v !== null)
  .map(([language, value]) => ({ _key: language, _type: type, language, value }));

function sha1(file) { return createHash('sha1').update(readFileSync(file)).digest('hex'); }

const problems = [];
const built = plan.map((p) => {
  const file = join(DATA, `${p.month}.json`);
  if (!existsSync(file)) { problems.push(`${p.month}: немає import/construction/${p.month}.json — запустіть з --init`); return null; }
  const meta = JSON.parse(readFileSync(file, 'utf8'));
  const listed = Object.keys(meta.photos ?? {});
  const missing = p.files.filter((f) => !listed.includes(f));
  const extra = listed.filter((f) => !p.files.includes(f));
  if (missing.length) problems.push(`${p.month}: немає опису для ${missing.join(', ')}`);
  if (extra.length) problems.push(`${p.month}: в JSON є фото, яких немає в папці: ${extra.join(', ')}`);
  for (const f of p.files) {
    const ph = meta.photos?.[f];
    if (ph && !ph.decorative && !ph.uk?.trim()) problems.push(`${p.month}: ${f} — немає опису українською (або "decorative": true)`);
  }
  if (meta.queue && !['WIND', 'ROCK', 'SUN'].includes(meta.queue)) problems.push(`${p.month}: черга «${meta.queue}» — лише WIND, ROCK, SUN або null`);
  const en = meta.en ?? {};
  const hasEn = Boolean(en.title?.trim());
  if (hasEn && (en.works ?? []).length !== p.works.length) problems.push(`${p.month}: робіт українською ${p.works.length}, англійською ${(en.works ?? []).length}`);
  if (hasEn && Boolean(en.text?.trim()) !== Boolean(p.text.length)) problems.push(`${p.month}: абзац «Текст» є лише в одній мові`);
  if (p.video && !meta.video?.duration) problems.push(`${p.month}: є дрон-відео — вкажіть "video": { "duration": "1:20" }`);

  const id = `report-${p.month}`;
  return {
    month: p.month,
    files: p.files.map((f) => ({ name: f, path: join(p.dir, f), sha1: sha1(join(p.dir, f)), meta: meta.photos?.[f] ?? {} })),
    unapproved: hasEn && en.approved !== true,
    doc: (assetIds) => ({
      _id: id,
      _type: 'constructionReport',
      date: `${p.month}-01`,
      ...(meta.queue ? { queue: meta.queue } : {}),
      texts: i18n('internationalizedArrayReportTextsValue', [
        ['uk', { _type: 'reportTexts', title: p.title, ...(p.text.length ? { text: p.text.join('\n\n') } : {}) }],
        ['en', hasEn ? { _type: 'reportTexts', title: en.title.trim(), ...(en.text?.trim() ? { text: en.text.trim() } : {}) } : undefined],
      ]),
      slides: p.files.map((f) => {
        const ph = meta.photos[f];
        return {
          _key: keyOf(id, f), _type: 'photo',
          asset: { _type: 'reference', _ref: assetIds.get(f) },
          decorative: Boolean(ph.decorative),
          ...(ph.decorative ? {} : { alt: i18n('internationalizedArrayStringValue', [['uk', ph.uk?.trim()], ['en', ph.en?.trim()]]) }),
        };
      }),
      works: p.works.map((w, i) => ({
        _key: keyOf(id, 'work', i), _type: 'reportWork',
        text: i18n('internationalizedArrayStringValue', [['uk', w], ['en', hasEn ? en.works[i]?.trim() : undefined]]),
      })),
      ...(p.video ? { video: { url: p.video, duration: meta.video.duration } } : {}),
      ...(hasEn && en.approved !== true ? { unapprovedLanguages: ['en'] } : {}),
    }),
  };
}).filter(Boolean);

if (problems.length) { problems.forEach((s) => console.error(`✗ ${s}`)); process.exit(1); }
for (const m of force) if (!built.some((b) => b.month === m)) fail(`--force ${m}: такого місяця в плані немає`);

const { getCliClient } = await import('sanity/cli');
const client = getCliClient({ apiVersion: '2025-02-19' }).withConfig({ perspective: 'raw' });

const ids = built.map((b) => `report-${b.month}`);
const existing = new Map((await client.fetch('*[_id in $ids]', { ids: [...ids, ...ids.map((i) => `drafts.${i}`), ...Object.keys(STUBS)] })).map((d) => [d._id, d]));

/** Порівняння без службових полів і без порядку ключів. */
const SYSTEM = new Set(['_rev', '_createdAt', '_updatedAt', '_system']);
const stable = (v) => (Array.isArray(v) ? v.map(stable) : v && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).filter((k) => !SYSTEM.has(k)).sort().map((k) => [k, stable(v[k])])) : v);
const same = (a, b) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));

/* Фото: шукаємо вже завантажені за sha1, решту завантажуємо. */
const hashes = [...new Set(built.flatMap((b) => b.files.map((f) => f.sha1)))];
const assetBySha = new Map((await client.fetch('*[_type == "sanity.imageAsset" && sha1hash in $hashes]{_id, sha1hash}', { hashes })).map((a) => [a.sha1hash, a._id]));

const tx = client.transaction();
let writes = 0;
let uploads = 0;
const skipped = [];
for (const b of built) {
  const id = `report-${b.month}`;
  if (existing.has(`drafts.${id}`)) { skipped.push(`${b.month}: у Studio є неопублікована чернетка — пропуск (опублікуйте або видаліть її)`); continue; }
  const toUpload = b.files.filter((f) => !assetBySha.has(f.sha1));
  const old = existing.get(id);
  if (old) {
    // Порівнюємо з тим, що вийшло б: фото, яких ще немає в Sanity, точно дають різницю.
    const draft = b.doc(new Map(b.files.map((f) => [f.name, assetBySha.get(f.sha1) ?? `нове:${f.name}`])));
    if (same(old, draft)) { log(`${b.month}: без змін`); continue; }
    if (!force.has(b.month)) {
      const diff = Object.keys({ ...stable(old), ...stable(draft) }).filter((k) => JSON.stringify(stable(old)[k]) !== JSON.stringify(stable(draft)[k]));
      skipped.push(`${b.month}: у Sanity відрізняється від джерел (поля: ${diff.join(', ')}) — НЕ перезаписано. Правили в Studio? Перевірте; перезаписати: --force ${b.month}`);
      continue;
    }
  }
  for (const f of toUpload) {
    if (dry) { log(`${b.month}: завантажу ${f.name}`); continue; }
    const asset = await client.assets.upload('image', readFileSync(f.path), { filename: f.name });
    assetBySha.set(f.sha1, asset._id);
    uploads++;
    log(`${b.month}: завантажено ${f.name} → ${asset._id}`);
  }
  const doc = b.doc(new Map(b.files.map((f) => [f.name, assetBySha.get(f.sha1) ?? `нове:${f.name}`])));
  log(`${b.month}: ${old ? 'перезаписую' : 'створюю'} ${id} — ${b.files.length} фото, ${doc.works.length} робіт${b.unapproved ? ', переклад en не затверджено' : ''}`);
  tx.createOrReplace(doc);
  writes++;
}

for (const [id, rev] of Object.entries(STUBS)) {
  const d = existing.get(id);
  if (existing.has(`drafts.${id}`)) skipped.push(`${id}: заглушка має чернетку в Studio — не видаляю`);
  else if (!d) continue;
  else if (d._rev !== rev) skipped.push(`${id}: заглушку змінювали в Studio (ревізія ${d._rev}) — не видаляю`);
  else { log(`видаляю заглушку ${id}`); tx.delete(id); writes++; }
}

for (const s of skipped) console.log(`  ! ${s}`);
if (!writes) { log('Записувати нічого.'); process.exit(0); }
if (dry) { log(`Буде одна транзакція: ${writes} змін.`); process.exit(0); }
const res = await tx.commit({ visibility: 'sync' });
console.log(`Готово: одна транзакція ${res.transactionId}, змін ${writes}, нових фото ${uploads}.`);
