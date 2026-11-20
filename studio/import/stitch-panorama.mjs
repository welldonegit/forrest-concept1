/**
 * Панорама блока «Інвестиція в цифрах» (Numbers) из трёх частей — без потерь.
 * Блок показывает одну панораму: срезы на обороте трёх карточек и целиком под калькулятором,
 * поэтому части (слева направо) склеиваются в один кадр. Пиксели не меняются; PNG — чтобы не
 * пережимать JPEG. Результат: studio/import/out/<имя>.png.
 *
 * node studio/import/stitch-panorama.mjs <имя> <часть1> <часть2> <часть3>
 * 2026-11-19: goverla-pano ← studio/import/photos/goverla-part{1,2,3}.jpg (1672×941)
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sharp = createRequire(join(root, 'package.json'))('sharp');
const [name, ...parts] = process.argv.slice(2);
if (!name || parts.length < 2) throw new Error('Нужно: <имя> <часть1> <часть2> …');

const tiles = await Promise.all(parts.map(async (p) => {
  const { data, info } = await sharp(resolve(p)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, info, p };
}));
const height = tiles[0].info.height;
const bad = tiles.find((t) => t.info.height !== height);
if (bad) throw new Error(`${bad.p}: высота ${bad.info.height}, у первой части ${height}`);

// Строки частей склеиваются напрямую (RGB, 3 канала): без смешивания и без альфа-канала.
const width = tiles.reduce((w, t) => w + t.info.width, 0);
const out3 = Buffer.alloc(width * height * 3);
let left = 0;
for (const t of tiles) {
  if (t.info.channels !== 3) throw new Error(`${t.p}: каналов ${t.info.channels}, нужно 3 (RGB)`);
  const rowBytes = t.info.width * 3;
  for (let y = 0; y < height; y++) t.data.copy(out3, (y * width + left) * 3, y * rowBytes, (y + 1) * rowBytes);
  left += t.info.width;
}
mkdirSync(join(root, 'studio/import/out'), { recursive: true });
const out = join(root, 'studio/import/out', `${name}.png`);
await sharp(out3, { raw: { width, height, channels: 3 } }).png({ compressionLevel: 9 }).toFile(out);

// Проверка: каждая часть в результате — те же пиксели, что в исходнике.
left = 0;
for (const t of tiles) {
  const back = await sharp(out).extract({ left, top: 0, width: t.info.width, height }).raw().toBuffer();
  if (Buffer.compare(back, t.data) !== 0) throw new Error(`${t.p}: пиксели в результате не совпали`);
  left += t.info.width;
}
const meta = await sharp(out).metadata();
if (meta.channels !== 3 || meta.hasAlpha) throw new Error('В результате появился альфа-канал');
console.log(`${out}: ${left}×${height}`);
