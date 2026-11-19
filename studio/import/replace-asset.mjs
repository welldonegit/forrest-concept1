/**
 * Замена файла фото в Sanity: загружает новый файл и переводит на него все ссылки
 * (опубликованные документы и черновики). Старый файл не удаляется.
 *
 * npm --prefix studio run -s sanity -- exec import/replace-asset.mjs --with-user-token -- <id старого файла> <путь к новому>
 *
 * 2026-11-19: hero-winter-mob.jpg — импорт взял одноимённый файл из design-export/assets/photos/ (940×1672)
 * вместо design-export/hero-winter-mob.jpg (941×1672), который был на сайте.
 */
import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { getCliClient } from 'sanity/cli';

const [oldId, newPath] = process.argv.slice(-2);
if (!oldId?.startsWith('image-') || !newPath) throw new Error('Нужно: <id старого файла> <путь к новому>');

const client = getCliClient({ apiVersion: '2025-02-19' }).withConfig({ perspective: 'raw' });

const docs = await client.fetch('*[references($id)]', { id: oldId });
if (!docs.length) throw new Error(`На ${oldId} никто не ссылается`);

const asset = await client.assets.upload('image', readFileSync(resolve(newPath)), { filename: basename(newPath) });
console.log(`Загружен ${asset.originalFilename}: ${asset._id} (${asset.metadata.dimensions.width}×${asset.metadata.dimensions.height})`);

/** Пути к полям _ref со старым id — в виде пути патча Sanity (элементы списков — по _key). */
function refPaths(v, path, out) {
  if (Array.isArray(v)) v.forEach((x, i) => refPaths(x, `${path}[${x?._key ? `_key=="${x._key}"` : i}]`, out));
  else if (v && typeof v === 'object') {
    if (v._ref === oldId) out.push(`${path}._ref`);
    for (const [k, x] of Object.entries(v)) if (k !== '_ref') refPaths(x, path ? `${path}.${k}` : k, out);
  }
  return out;
}

const tx = client.transaction();
for (const d of docs) {
  const paths = refPaths(d, '', []);
  console.log(`${d._id}: ${paths.join(', ')}`);
  tx.patch(d._id, (p) => p.ifRevisionId(d._rev).set(Object.fromEntries(paths.map((p) => [p, asset._id]))));
}
await tx.commit();
console.log('Ссылки переведены. Старый файл оставлен в наборе.');
