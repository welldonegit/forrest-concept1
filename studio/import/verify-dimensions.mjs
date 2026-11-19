/**
 * Проверка после импорта: размеры фото в Sanity = размеры исходного файла.
 * Sanity иногда меряет фото на пиксель меньше (было: hero-winter-mob.jpg 941×1672 → 940×1672),
 * и тогда CDN отдаёт уменьшенную копию. Расхождение — ошибка (код выхода 1).
 *
 * Запуск после `dataset import`: npm --prefix studio run -s import:verify
 * Читает публичный набор без ключа; размеры исходников — sharp из корня проекта (зависимость Astro).
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, basename } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sharp = createRequire(join(root, 'package.json'))('sharp');
const API = 'https://rxw30lco.api.sanity.io/v2025-02-19/data/query/production';

const ndjson = readFileSync(join(root, 'studio/import/out/content.ndjson'), 'utf8');
const files = [...new Set([...ndjson.matchAll(/"image@file:\/\/([^"]+)"/g)].map((m) => m[1]))];

const local = await Promise.all(files.map(async (f) => {
  const bytes = readFileSync(f);
  const m = await sharp(bytes).metadata();
  // У фото с поворотом в EXIF (orientation 5–8) ширина и высота меняются местами.
  const [w, h] = (m.orientation ?? 1) >= 5 ? [m.height, m.width] : [m.width, m.height];
  return { file: basename(f), sha1: createHash('sha1').update(bytes).digest('hex'), w, h };
}));

const q = `*[_type == "sanity.imageAsset" && sha1hash in ${JSON.stringify(local.map((l) => l.sha1))}]{sha1hash, "w": metadata.dimensions.width, "h": metadata.dimensions.height}`;
const res = await fetch(`${API}?query=${encodeURIComponent(q)}`);
if (!res.ok) throw new Error(`Sanity: HTTP ${res.status}`);
const remote = new Map((await res.json()).result.map((a) => [a.sha1hash, a]));

const errors = [];
for (const l of local) {
  const r = remote.get(l.sha1);
  if (!r) errors.push(`${l.file}: нет в Sanity (импорт не прошёл?)`);
  else if (r.w !== l.w || r.h !== l.h) errors.push(`${l.file}: исходник ${l.w}×${l.h}, в Sanity ${r.w}×${r.h}`);
}
console.log(`Размеры фото: проверено ${local.length}, расхождений ${errors.length}`);
for (const e of errors) console.log(`  ✗ ${e}`);
if (errors.length) process.exit(1);
