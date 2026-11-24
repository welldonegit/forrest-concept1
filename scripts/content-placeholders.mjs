/**
 * Список заглушок у контенті (src/lib/placeholders.ts): що треба замінити до SITE_INDEXING=allow.
 * Читає снимок останньої збірки src/content-sanity/content.json (--fixtures — фікстури).
 * Запуск: npm run content:placeholders [-- --fixtures]
 */
import { readFileSync } from 'node:fs';
import { findPlaceholders, formatPlaceholders } from '../src/lib/placeholders.ts';

const fixtures = process.argv.includes('--fixtures');
const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const docs = fixtures
  ? ['siteSettings', 'landing', 'apartmentFormats', 'legalDocuments'].flatMap((n) => [read(`../src/content-fixtures/${n}.json`)].flat())
  : read('../src/content-sanity/content.json').documents;
const list = findPlaceholders(docs);
console.log(list.length ? `Заглушок: ${list.length}\n${formatPlaceholders(list)}` : 'Заглушок немає.');
