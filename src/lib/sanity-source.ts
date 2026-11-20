/**
 * Документы Sanity → та же форма данных, что у временных фикстур (src/content-fixtures/).
 * Так компоненты и src/lib/content.ts не зависят от того, как контент хранится в админке:
 * - тексты, переведённые группой (texts), раскладываются по отдельным полям;
 * - переводы v5 ({ language, value }) → { _key: язык, value };
 * - заголовки по строкам, контур зданий, отчёты стройки, «Ціни та дохідність» — обратно на места блоков;
 * - ссылки на файлы → «sanity:<id>» (фото и иконки берёт content.ts);
 * - документы сайта (legalDocument) — списком, на них ссылаются FAQ, футер и согласие квиза.
 * Скрытые блоки («Приховати блок») отбрасываются.
 */
import { languageIds } from './languages.ts';
import arrayFields from './sanity-arrays.json';

type Obj = Record<string, unknown>;
export interface SanitySnapshot {
  documents: Obj[];
  files: Record<string, { file: string; url: string; originalFilename?: string; extension: string }>;
}

const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const langOf = (it: Obj) => (it.language ?? it._key) as string;
const isI18nItem = (it: unknown): it is Obj => isObj(it) && 'value' in it && languageIds.includes(langOf(it));

/** Группа переводов: элементы с языком, значение — объект полей (не файл и не фото). */
function isGroup(v: unknown): v is Obj[] {
  return Array.isArray(v) && v.length > 0 && v.every((it) => isI18nItem(it) && isObj(it.value) && !('asset' in (it.value as Obj)));
}

function normalize(v: unknown, files: SanitySnapshot['files']): unknown {
  if (Array.isArray(v)) {
    if (v.length && v.every(isI18nItem)) return v.map((it) => ({ _key: langOf(it), value: normalize(it.value, files) }));
    return v.map((x) => normalize(x, files));
  }
  if (!isObj(v)) return v;
  const out: Obj = {};
  for (const [k, x] of Object.entries(v)) {
    if (isGroup(x)) {
      // texts: [{ language: 'uk', value: { title, text } }] → title: [{ _key: 'uk', value }], text: [...]
      for (const it of x) {
        for (const [field, value] of Object.entries(it.value as Obj)) {
          if (field === '_type' || value === '' || value === undefined) continue;
          ((out[field] ??= []) as Obj[]).push({ _key: langOf(it), value });
        }
      }
      continue;
    }
    out[k] = normalize(x, files);
  }
  // Пустые списки Studio не хранит: подставляем [] (перечень — из схемы, studio/import/array-fields.mjs).
  for (const path of (arrayFields as Record<string, string[]>)[out._type as string] ?? []) {
    const keys = path.split('.');
    let parent: Obj | undefined = out;
    for (const k of keys.slice(0, -1)) parent = isObj(parent?.[k]) ? (parent![k] as Obj) : undefined;
    const last = keys[keys.length - 1];
    if (parent && parent[last] === undefined) parent[last] = [];
  }
  // Фото и файлы: ссылка на файл → sanity:<id>; служебные поля Sanity не нужны.
  const asset = out.asset as Obj | undefined;
  if (asset && typeof asset._ref === 'string') {
    out.asset = { _ref: `sanity:${asset._ref}` };
    const hs = out.hotspot as Obj | undefined;
    out.hotspot = hs ? { x: hs.x, y: hs.y } : { x: 0.5, y: 0.5 };
    delete out.crop;
  }
  return out;
}

const stripTypes = (lines: Obj[]) => lines.map((l) => l.text);

export function fromSanity(snapshot: SanitySnapshot) {
  const { files } = snapshot;
  const byType = (t: string) => snapshot.documents.filter((d) => d._type === t).map((d) => normalize(d, files) as Obj);
  const one = (t: string) => {
    const [d] = byType(t);
    if (!d) throw new Error(`В Sanity нет документа ${t} (опубликованного)`);
    return d;
  };

  const landing = one('landing');
  const pricing = one('pricing');
  const reports = byType('constructionReport').sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const blocks = ((landing.blocks as Obj[]) ?? []).filter((b) => !b.hidden);

  for (const b of blocks) {
    delete b.hidden;
    if (b._type === 'hero' || b._type === 'season') b.title = stripTypes(b.title as Obj[]);
    if (b._type === 'hero') {
      const sky = b.skyline as Obj;
      sky.points = (sky.points as Obj[]).map((p) => [p.x, p.y]);
    }
    if (b._type === 'construction') {
      b.updates = reports.map((r) => {
        const { _id, _type, _rev, _createdAt, _updatedAt, _system, ...rest } = r;
        return { _key: _id, ...rest };
      });
    }
    if (b._type === 'numbers') {
      const calc = b.calc as Obj;
      Object.assign(calc, {
        formats: pricing.formats, payments: pricing.payments,
        pricePerM2: pricing.pricePerM2, currency: pricing.currency, years: pricing.years,
      });
    }
  }

  return {
    landing: { ...landing, blocks },
    siteSettings: one('siteSettings'),
    apartmentFormats: byType('apartmentFormat'),
    legalDocuments: byType('legalDocument'),
  };
}
