/**
 * Импорт временного контента (src/content-fixtures/) в Sanity — без ручного ввода.
 *
 * Генератор идёт по схемам Studio (studio/schemaTypes) и раскладывает данные фикстур по полям:
 * - переводимые поля → массивы sanity-plugin-internationalized-array v5 ({ _key, _type, language, value });
 * - тексты, которые в схеме собраны группой (texts()), — собираются из отдельных полей фикстуры;
 * - фото, SVG и PDF — загружаются в Sanity как есть, оригиналами (_sanityAsset в NDJSON);
 * - всё, что есть в фикстурах, но не нашло поля в схеме, печатается списком «не перенесено» —
 *   при непустом списке скрипт завершается с ошибкой (контент не теряется молча).
 *
 * Запуск (из корня проекта):
 *   npm --prefix studio run import:build     → studio/import/out/content.ndjson
 *   npm --prefix studio run sanity -- dataset import import/out/content.ndjson production --replace
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { schemaTypes } from '../schemaTypes/index.ts';
import { languageIds } from '../../src/lib/languages.ts';
import { restructure } from './restructure.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const fixtures = join(root, 'src/content-fixtures');
const out = join(here, 'out');

const types = new Map(schemaTypes.map((t) => [t.name, t]));
const missing = [];
const notes = [];

/* ---------- Ключи и переводы ---------- */

// Стабильные _key: повторный импорт даёт те же ключи (диф в истории Sanity — только реальные правки).
const keyOf = (...parts) => createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 12);

const isI18n = (v) =>
  Array.isArray(v) && v.length > 0 && v.every((it) => it && typeof it === 'object' && 'value' in it && languageIds.includes(it.language ?? it._key));

/** Значение фикстуры на каждом языке: { uk: '…', en: '…' }. Простая строка — одна для всех. */
function perLanguage(v) {
  if (v === undefined || v === null || v === '') return {};
  if (isI18n(v)) return Object.fromEntries(v.map((it) => [it.language ?? it._key, it.value]));
  // Простая строка в фикстуре — общий текст для всех языков (например «$»): так и переносим.
  if (typeof v === 'string') return Object.fromEntries(languageIds.map((l) => [l, v]));
  throw new Error(`Ожидался текст, а пришло: ${JSON.stringify(v).slice(0, 80)}`);
}

function i18nArray(typeName, byLang, path) {
  const valueType = `${typeName}Value`;
  return languageIds
    .filter((l) => byLang[l] !== undefined && byLang[l] !== '')
    .map((l) => ({ _key: keyOf(path, l), _type: valueType, language: l, value: byLang[l] }));
}

/* ---------- Файлы ---------- */

/**
 * Файл для ссылки фикстуры. В выгрузке есть одноимённые файлы в разных папках, и они не всегда
 * одинаковые (hero-winter-mob.jpg: assets/photos — 940×1672, корень — 941×1672). Берём тот,
 * что брал сайт: список fixturePhotos в src/lib/content.ts. Нет в списке и имя встречается
 * в нескольких папках с разным содержимым — ошибка, а не выбор наугад.
 */
const sitePhotos = [...readFileSync(join(root, 'src/lib/content.ts'), 'utf8').matchAll(/'\/(design-export\/[^']+)'/g)].map((m) => m[1]);
function assetFile(ref) {
  const file = ref.replace(/^fixture:/, '');
  const fromSite = sitePhotos.find((p) => p.split('/').pop() === file);
  if (fromSite) return join(root, fromSite);
  const found = [`design-export/assets/photos/${file}`, `design-export/${file}`, `design-export/assets/logos/${file}`, `studio/import/icons/${file}`]
    .map((p) => join(root, p)).filter(existsSync);
  if (!found.length) throw new Error(`Нет файла для ${ref}`);
  if (new Set(found.map((f) => readFileSync(f).toString('base64'))).size > 1)
    throw new Error(`${file}: в выгрузке несколько разных файлов с этим именем (${found.join(', ')}) — укажите нужный`);
  return found[0];
}

/* ---------- Проход по схеме ---------- */

const PLUGIN = 'internationalizedArray';

function fieldsOf(type) {
  const t = typeof type === 'string' ? types.get(type) : type;
  return t?.fields ?? [];
}

/** Тип поля: имя типа (string, photo, statsCard…) и описание, если тип именованный. */
function resolveType(def) {
  const named = types.get(def.type);
  return { base: named ? named.type : def.type, named, def };
}

/**
 * src — объект фикстуры, def — описание поля или тип. Возвращает значение для Sanity.
 * consumed — набор ключей src, которые разобраны (для списка «не перенесено»).
 */
function convertObject(src, typeDef, path) {
  const fields = fieldsOf(typeDef);
  const result = {};
  const consumed = new Set(['_key', '_type']);
  for (const field of fields) {
    // Группа текстов: поля группы лежат в фикстуре рядом, на уровне объекта.
    if (field.type.startsWith(PLUGIN) && !['internationalizedArrayString', 'internationalizedArrayText'].includes(field.type)) {
      const groupName = field.type.slice(PLUGIN.length);
      const group = types.get(groupName[0].toLowerCase() + groupName.slice(1));
      if (!group) throw new Error(`Нет типа группы ${groupName} (${path}.${field.name})`);
      const byLang = {};
      for (const sub of group.fields) {
        if (!(sub.name in src)) continue;
        consumed.add(sub.name);
        for (const [lang, v] of Object.entries(perLanguage(src[sub.name]))) {
          if (v === '' || v === undefined) continue;
          (byLang[lang] ??= { _type: group.name })[sub.name] = v;
        }
      }
      const arr = i18nArray(field.type, byLang, `${path}.${field.name}`);
      if (arr.length) result[field.name] = arr;
      continue;
    }
    if (!(field.name in src)) continue;
    consumed.add(field.name);
    const v = convertValue(src[field.name], field, `${path}.${field.name}`);
    if (v !== undefined) result[field.name] = v;
  }
  for (const k of Object.keys(src)) {
    if (!consumed.has(k)) missing.push(`${path}.${k}`);
  }
  return result;
}

function convertValue(v, def, path) {
  if (v === undefined || v === null) return undefined;
  const { base, named } = resolveType(def);
  const typeName = def.type;

  if (typeName === 'internationalizedArrayString' || typeName === 'internationalizedArrayText') {
    const arr = i18nArray(typeName, perLanguage(v), path);
    return arr.length ? arr : undefined;
  }
  if (['string', 'text', 'url', 'date', 'datetime', 'slug'].includes(base)) {
    if (typeof v !== 'string') throw new Error(`${path}: ожидалась строка`);
    return v === '' ? undefined : v;
  }
  if (base === 'number') return typeof v === 'number' ? v : Number(v);
  if (base === 'boolean') return Boolean(v);
  if (base === 'reference') return { _type: 'reference', _ref: v._ref };
  if (base === 'image') {
    const img = { _type: typeName === 'image' ? 'image' : typeName, _sanityAsset: `image@file://${assetFile(v.asset._ref)}` };
    const hs = v.hotspot;
    if (hs && (hs.x !== 0.5 || hs.y !== 0.5)) {
      img.hotspot = { _type: 'sanity.imageHotspot', x: hs.x, y: hs.y, width: 1, height: 1 };
      img.crop = { _type: 'sanity.imageCrop', top: 0, bottom: 0, left: 0, right: 0 };
    }
    const rest = { ...v };
    delete rest.asset; delete rest.hotspot; delete rest._type;
    Object.assign(img, convertObject(rest, named ?? def, path));
    return img;
  }
  if (base === 'file') {
    if (!v.asset?._ref) return undefined; // пустое поле — нет файла (TODO от заказчика)
    const f = { _type: typeName === 'file' ? 'file' : typeName, _sanityAsset: `file@file://${assetFile(v.asset._ref)}` };
    const rest = { ...v };
    delete rest.asset; delete rest._type;
    Object.assign(f, convertObject(rest, named ?? def, path));
    return f;
  }
  if (base === 'array') {
    const members = (named ?? def).of;
    if (!Array.isArray(v)) throw new Error(`${path}: ожидался список`);
    const items = v.map((item, i) => {
      const member = item?._type && typeof item === 'object' && !['image', 'reference'].includes(item._type)
        ? members.find((m) => m.type === item._type || resolveType(m).base === item._type)
        : members.length === 1 ? members[0] : undefined;
      const p = `${path}[${item?._key ?? i}]`;
      if (!member) {
        missing.push(`${p} (тип ${item?._type} — нет в схеме)`);
        return undefined;
      }
      const mt = resolveType(member);
      if (['string', 'number'].includes(mt.base)) return item;
      const converted = convertValue(item, member, p);
      if (converted && typeof converted === 'object') {
        converted._key = item?._key ?? keyOf(p);
        if (!converted._type) converted._type = member.type;
      }
      return converted;
    }).filter((x) => x !== undefined);
    return items.length ? items : undefined;
  }
  if (base === 'object' || named) {
    if (typeof v !== 'object' || Array.isArray(v)) throw new Error(`${path}: ожидался объект`);
    const obj = convertObject(v, named ?? def, path);
    if (named && named.type === 'object') obj._type = named.name;
    return Object.keys(obj).length ? obj : undefined;
  }
  throw new Error(`${path}: неизвестный тип поля ${typeName}`);
}

/* ---------- Документы ---------- */

const read = (f) => JSON.parse(readFileSync(join(fixtures, f), 'utf8'));
const docs = restructure({
  landing: read('landing.json'),
  siteSettings: read('siteSettings.json'),
  apartmentFormats: read('apartmentFormats.json'),
  // Документы сайта: собираются из папки «Тексты» скриптом import/legal-documents.mjs.
  legalDocuments: read('legalDocuments.json'),
}, { types, notes });

const ndjson = docs.map((doc) => {
  const type = types.get(doc._type);
  if (!type) throw new Error(`Нет типа документа ${doc._type}`);
  const { _id, _type, ...rest } = doc;
  return { _id, _type, ...convertObject(rest, type, _id) };
});

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'content.ndjson'), ndjson.map((d) => JSON.stringify(d)).join('\n') + '\n');

const assets = new Set(JSON.stringify(ndjson).match(/(image|file)@file:\/\/[^"]+/g) ?? []);
console.log(`Документов: ${ndjson.length}, файлов: ${assets.size} → ${join('studio/import/out', 'content.ndjson')}`);
for (const n of notes) console.log(`  · ${n}`);
if (missing.length) {
  console.error(`\nНе перенесено (${missing.length}) — нет поля в схеме:`);
  for (const m of missing) console.error(`  ✗ ${m}`);
  if (!process.argv.includes('--allow-missing')) process.exit(1);
}
