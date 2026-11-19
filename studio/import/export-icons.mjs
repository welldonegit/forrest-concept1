/**
 * Иконки контента из кода → SVG-файлы для импорта (решение 2026-11-19): редактор видит в админке,
 * что стоит сейчас. Источник — те же строки, что рисуют иконки на сайте, без изменений:
 * метки карты — Location.astro (обёртка svg — как в разметке метки), сети — SocialIcon.astro.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const out = join(here, 'icons');
mkdirSync(out, { recursive: true });

const loc = readFileSync(join(root, 'src/components/blocks/Location.astro'), 'utf8');
const locIcons = [...loc.matchAll(/^\s+(parking|food|leisure|hotel): '([^']+)',$/gm)];
const locWrap = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
if (!loc.includes("const pinAttrs = { fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };")) throw new Error('Location.astro: оформление иконки метки изменилось');
for (const [, name, inner] of locIcons) writeFileSync(join(out, `pin-${name}.svg`), `<svg xmlns="http://www.w3.org/2000/svg" ${locWrap}>${inner}</svg>\n`);

const soc = readFileSync(join(root, 'src/components/ui/SocialIcon.astro'), 'utf8');
const socIcons = [...soc.matchAll(/^\s+"(\w+)": "([^"]+)",?$/gm)];
for (const [, name, d] of socIcons) writeFileSync(join(out, `social-${name}.svg`), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="${d}"/></svg>\n`);

console.log(`Иконки: метки ${locIcons.length}, сети ${socIcons.length} → studio/import/icons/`);
if (locIcons.length !== 4 || socIcons.length !== 4) process.exit(1);
