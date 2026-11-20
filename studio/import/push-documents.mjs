/**
 * Документы сайта → Sanity, без полной замены набора данных (правки из Studio не затираются).
 * Источник — import/out/content.ndjson (собирается `npm run import:build` из src/content-fixtures/,
 * документы — из папки «Тексты» скриптом import/legal-documents.mjs).
 *
 * Что пишется:
 *   - документы legalDocument — создаются, если их ещё нет (--force — перезаписать);
 *   - landing: blocks[faq].docs — плашка FAQ: ссылки на три документа стройки (заменяет прежние PDF);
 *   - siteSettings: footer.legalLinks[p].document (политика в футере), privacyPolicy (согласие квиза),
 *     documentPage (подписи страниц документов) — только если поля ещё пусты (--force — перезаписать).
 * Правится опубликованный документ и черновик, если он есть.
 *
 * Запуск (из studio/, нужен вход в Sanity):
 *   npm run import:build && npx sanity exec import/push-documents.mjs --with-user-token -- [--force] [--dry]
 */
import { readFileSync } from 'node:fs';
import { getCliClient } from 'sanity/cli';

const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith('--')));
const force = flags.has('--force');
const dry = flags.has('--dry');

const source = new URL('./out/content.ndjson', import.meta.url);
const docs = readFileSync(source, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const byId = new Map(docs.map((d) => [d._id, d]));
const legal = docs.filter((d) => d._type === 'legalDocument');
if (!legal.length) throw new Error('В import/out/content.ndjson нет документов legalDocument — сначала npm run import:build');

const faq = byId.get('landing').blocks.find((b) => b._type === 'faq');
const settings = byId.get('siteSettings');
const privacyLink = settings.footer.legalLinks.find((l) => l._key === 'p');

const client = getCliClient({ apiVersion: '2025-02-19' }).withConfig({ perspective: 'raw' });
const tx = client.transaction();
const log = (s) => console.log(`${dry ? '[проверка] ' : ''}${s}`);

/* Документы */
const existing = new Set(await client.fetch('*[_id in $ids]._id', { ids: legal.map((d) => d._id) }));
for (const d of legal) {
  if (existing.has(d._id) && !force) { log(`${d._id}: уже есть — пропуск (--force, чтобы перезаписать)`); continue; }
  log(`${d._id}: ${existing.has(d._id) ? 'перезаписываю' : 'создаю'}`);
  tx.createOrReplace(d);
}

/* Ссылки: landing и siteSettings — опубликованный документ и черновик */
const targets = await client.fetch(
  `*[_id in $ids]{_id, _rev, _type,
    "faqDocs": blocks[_key == $faqKey][0].docs,
    "privacyDoc": footer.legalLinks[_key == "p"][0].document,
    "hasPrivacyLink": defined(footer.legalLinks[_key == "p"][0]),
    privacyPolicy, documentPage}`,
  { ids: ['landing', 'drafts.landing', 'siteSettings', 'drafts.siteSettings'], faqKey: faq._key },
);
for (const t of targets) {
  const set = {};
  if (t._type === 'landing') {
    set[`blocks[_key=="${faq._key}"].docs`] = faq.docs;
    log(`${t._id}: плашка FAQ → ${faq.docs.length} документа (прежние ${t.faqDocs?.length ?? 0} заменяются)`);
  } else {
    if (!t.hasPrivacyLink) log(`${t._id}: в футере нет ссылки _key "p" — политику в футер не добавляю, проверьте в Studio`);
    else if (!t.privacyDoc || force) { set['footer.legalLinks[_key=="p"].document'] = privacyLink.document; log(`${t._id}: футер «Політика конфіденційності» → документ`); }
    if (!t.privacyPolicy || force) { set.privacyPolicy = settings.privacyPolicy; log(`${t._id}: згода квізу → політика`); }
    if (!t.documentPage || force) { set.documentPage = settings.documentPage; log(`${t._id}: підписи сторінок документів`); }
  }
  if (Object.keys(set).length) tx.patch(t._id, (p) => p.ifRevisionId(t._rev).set(set));
}

if (dry) {
  console.log('Ничего не записано (--dry).');
} else {
  const res = await tx.commit();
  console.log(`Готово: изменено документов ${res.results.length}. Сайт пересоберётся по Deploy Hook, если он настроен; иначе — Retry deployment в Workers Builds.`);
}
