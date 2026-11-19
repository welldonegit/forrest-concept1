/**
 * Поля-списки по типам схемы → src/lib/sanity-arrays.json. Studio не хранит пустые списки
 * (удалили все элементы — поля нет), а компоненты сайта ждут список: src/lib/sanity-source.ts
 * подставляет [] по этому перечню. Запускается вместе с import:build и validate.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { schemaTypes } from '../schemaTypes/index.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const named = new Map(schemaTypes.map((t) => [t.name, t]));
const out = {};

function walk(fields, prefix, list) {
  for (const f of fields ?? []) {
    const path = prefix ? `${prefix}.${f.name}` : f.name;
    const t = named.get(f.type);
    if (f.type === 'array') list.push(path);
    else if (f.type === 'object') walk(f.fields, path, list);
    else if (t && t.type === 'array') list.push(path);
  }
}
for (const t of schemaTypes) {
  if (!['object', 'document', 'image'].includes(t.type) && t.type !== t.name) continue;
  const list = [];
  walk(t.fields, '', list);
  if (list.length) out[t.name] = list.sort();
}
writeFileSync(join(root, 'src/lib/sanity-arrays.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`Поля-списки: ${Object.values(out).flat().length} у ${Object.keys(out).length} типов → src/lib/sanity-arrays.json`);
