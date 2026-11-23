/**
 * Документы сайта (политика конфиденциальности, документы стройки) → src/content-fixtures/legalDocuments.json.
 * Дальше — обычный импорт: `npm --prefix studio run import:build` кладёт их в import/out/content.ndjson,
 * `import/push-documents.mjs` записывает в Sanity. Руками в Studio ничего не вводится.
 *
 * Источники (подробно — import/legal/README.md):
 *   - .docx из папки «Тексты» в корне проекта — разбирается здесь же: абзацы, заголовки (стили Heading1–3),
 *     списки, таблицы, жирный и курсив; пустые абзацы пропускаются;
 *   - import/legal/<id>.<язык>.md — расшифровки (PDF в контейнере подписи, снимок экрана) и переводы.
 * Текст — Portable Text Sanity: блоки (normal, h2, h3, списки bullet/number) и таблицы docTable.
 * Структура перевода сверяется с украинской: другие разделы, абзацы или строки таблиц — ошибка.
 *
 * Запуск (из корня проекта): node studio/import/legal-documents.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { unzip, topLevel, paragraph, numberingFormats } from './docx.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const texts = join(root, 'Тексты');
const legal = join(here, 'legal');

/**
 * Документы. slug — адрес латиницей (транслитерация КМУ), один для всех языков;
 * category: policy → /{язык}/<slug>/, construction → /{язык}/dokumenty/<slug>/ (src/lib/routes.ts).
 * editionDate — только если дата редакции есть в самом документе.
 * Названия: украинское — из документа (у .docx без заголовка — имя файла), английское — перевод.
 */
const DOCUMENTS = [
  {
    id: 'polityka-konfidentsiinosti', slug: 'polityka-konfidentsiinosti', category: 'policy',
    title: { uk: 'Політика конфіденційності', en: 'Privacy Policy' },
    uk: { docx: 'Політика конфіденційності.docx' }, en: { md: 'polityka.en.md' },
  },
  {
    id: 'dozvil-na-budivelni-roboty', slug: 'dozvil-na-budivelni-roboty', category: 'construction', editionDate: '2026-06-26',
    title: { uk: 'Дозвіл на виконання будівельних робіт', en: 'Permit for the Performance of Construction Works' },
    uk: { md: 'dozvil.uk.md' }, en: { md: 'dozvil.en.md' },
  },
  {
    id: 'vytiah-z-reiestru-rechovykh-prav', slug: 'vytiah-z-reiestru-rechovykh-prav', category: 'construction',
    title: { uk: 'Витяг з Державного реєстру речових прав', en: 'Extract from the State Register of Real Property Rights' },
    uk: { md: 'vytiah.uk.md' }, en: { md: 'vytiah.en.md' },
  },
  {
    id: 'pravo-na-zemelnu-dilianku', slug: 'pravo-na-zemelnu-dilianku', category: 'construction',
    title: {
      uk: 'Документ, що засвідчує право власності (користування) земельною ділянкою',
      en: 'Document Certifying the Right of Ownership (Use) of a Land Plot',
    },
    uk: { docx: 'Документ, що засвідчує право власності (користування) земельною ділянкою.docx' }, en: { md: 'zemlia.en.md' },
  },
];

/** Переводы, которые человек ещё не утвердил (поле «Переклад не затверджено» в Sanity). */
const UNAPPROVED = ['en'];

const keyOf = (...parts) => createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 12);

/* ---------- Portable Text ---------- */

/** Текст с **жирным** → дочерние span. */
function spans(text, key) {
  const out = [];
  text.split(/(\*\*[^*]+\*\*)/).filter(Boolean).forEach((part, i) => {
    const bold = part.startsWith('**') && part.endsWith('**');
    out.push({ _type: 'span', _key: keyOf(key, i), text: bold ? part.slice(2, -2) : part, marks: bold ? ['strong'] : [] });
  });
  return out;
}

const block = (key, style, children, list) => ({
  _type: 'block', _key: key, style, markDefs: [], children,
  ...(list ? { listItem: list, level: 1 } : {}),
});

/* ---------- Markdown (подмножество, import/legal/README.md) ---------- */

function fromMarkdown(src, base) {
  const out = [];
  const lines = src.replace(/\r/g, '').split('\n');
  let para = [];
  let table = null;
  const k = () => keyOf(base, out.length);
  const flushPara = () => {
    if (para.length) out.push(block(k(), 'normal', spans(para.join(' '), k())));
    para = [];
  };
  const flushTable = () => {
    if (table) out.push({ _type: 'docTable', _key: k(), headerRow: table.header, rows: table.rows.map((cells, i) => ({ _type: 'docTableRow', _key: keyOf(base, out.length, 'r', i), cells })) });
    table = null;
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('|')) {
      flushPara();
      const cells = line.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      if (cells.every((c) => /^:?-{3,}:?$/.test(c))) {
        if (!table || table.rows.length !== 1) throw new Error(`${base}: строка-разделитель таблицы не после первой строки`);
        table.header = true;
        continue;
      }
      (table ??= { header: false, rows: [] }).rows.push(cells);
      continue;
    }
    flushTable();
    if (!line) { flushPara(); continue; }
    const h = line.match(/^(#{2,3}) (.+)$/);
    const li = line.match(/^(-|\d+\.) (.+)$/);
    if (h || li) {
      flushPara();
      if (h) out.push(block(k(), h[1].length === 2 ? 'h2' : 'h3', spans(h[2], k())));
      else out.push(block(k(), 'normal', spans(li[2], k()), li[1] === '-' ? 'bullet' : 'number'));
      continue;
    }
    if (line.startsWith('#')) throw new Error(`${base}: заголовок «${line}» — только ## и ###`);
    para.push(line);
  }
  flushPara();
  flushTable();
  return out;
}

/* ---------- .docx ---------- */

function fromDocx(file, base) {
  const zip = unzip(readFileSync(file));
  const xml = zip.get('word/document.xml')?.toString('utf8');
  if (!xml) throw new Error(`${file}: нет word/document.xml`);
  const numFmt = numberingFormats(zip);
  const body = xml.slice(xml.indexOf('<w:body>'), xml.indexOf('</w:body>'));
  const out = [];
  for (const part of topLevel(body, ['p', 'tbl'])) {
    const k = keyOf(base, out.length);
    if (part.tag === 'tbl') {
      const rows = (part.xml.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) ?? []).map((tr) =>
        (tr.match(/<w:tc[ >][\s\S]*?<\/w:tc>/g) ?? []).map((tc) => topLevel(tc, ['p']).map((p) => paragraph(p.xml, numFmt).text.replace(/\*\*/g, '')).filter(Boolean).join(' ')));
      out.push({ _type: 'docTable', _key: k, headerRow: /<w:tblHeader\/>/.test(part.xml), rows: rows.map((cells, i) => ({ _type: 'docTableRow', _key: keyOf(base, out.length, 'r', i), cells })) });
      continue;
    }
    const p = paragraph(part.xml, numFmt);
    if (!p.text.replace(/\*/g, '').trim()) continue;
    out.push(block(k, p.style, spans(p.text, k), p.list));
  }
  return out;
}

/* ---------- Сборка ---------- */

function load(doc, lang) {
  const src = doc[lang];
  const base = `${doc.id}.${lang}`;
  if (src.docx) {
    const file = join(texts, src.docx);
    if (!existsSync(file)) throw new Error(`Нет файла «Тексты/${src.docx}»`);
    return fromDocx(file, base);
  }
  return fromMarkdown(readFileSync(join(legal, src.md), 'utf8'), base);
}

/** Скелет структуры: вид каждого элемента (раздел, абзац, пункт списка, таблица N×M). */
const shape = (blocks) => blocks.map((b) => (b._type === 'docTable' ? `table ${b.rows.length}×${b.rows.map((r) => r.cells.length).join(',')}${b.headerRow ? ' h' : ''}` : `${b.style}${b.listItem ? ` ${b.listItem}` : ''}`));

const result = DOCUMENTS.map((doc) => {
  const body = { uk: load(doc, 'uk'), en: load(doc, 'en') };
  const [a, b] = [shape(body.uk), shape(body.en)];
  const diff = a.findIndex((x, i) => x !== b[i]);
  if (a.length !== b.length || diff !== -1) {
    throw new Error(`${doc.id}: структура en не совпадает с uk (элемент ${diff === -1 ? Math.min(a.length, b.length) : diff}: uk «${a[diff] ?? '—'}», en «${b[diff] ?? '—'}»)`);
  }
  return {
    _id: `legal-${doc.id}`,
    _type: 'legalDocument',
    slug: doc.slug,
    category: doc.category,
    ...(doc.editionDate ? { editionDate: doc.editionDate } : {}),
    unapprovedLanguages: UNAPPROVED,
    title: Object.entries(doc.title).map(([l, value]) => ({ _key: l, value })),
    body: Object.entries(body).map(([l, value]) => ({ _key: l, value })),
  };
});

const out = join(root, 'src/content-fixtures/legalDocuments.json');
writeFileSync(out, JSON.stringify(result, null, 1) + '\n');
for (const d of result) {
  const uk = d.body.find((x) => x._key === 'uk').value;
  const count = (t) => uk.filter((b) => (t === 'table' ? b._type === 'docTable' : b.style === t || b.listItem === t)).length;
  console.log(`${d._id}: элементов ${uk.length} (разделов ${count('h2')}, подразделов ${count('h3')}, таблиц ${count('table')}, пунктов списка ${count('bullet') + count('number')})`);
}
console.log(`→ ${out.replace(root + '/', '')}`);
