/**
 * Окно «Детальніше» миров WIND / ROCK / SUN (выгрузка 2026-11-25, design-export/updates/2026-11-25/section-popups/).
 * Только добавляет поля — безопасно и до слияния кода: старый код их не читает.
 *   - landing → блок «Три світи» → каждый мир: «Вікно «Детальніше»: тексти» (про секцію, введення в експлуатацію,
 *     доступ до траси) и «Ключова інфраструктура» (пункты);
 *   - siteSettings → Попапи → «Вікно «Детальніше» світу»: общие подписи окна и формы.
 * Тексты — studio/import/worlds-2026-11-25-texts.mjs: uk из выгрузки, en — перевод разработчика, НЕ УТВЕРЖДЁН.
 * Уже заполненные поля не меняются (--force — заменить). Фото мира в окне — то же, что в карточке: не загружается.
 *
 * Опубликованные документы и черновики (если есть), резервная копия JSON в ~/forrest-backups/,
 * запись одной транзакцией, повторный запуск ничего не меняет. --dry — показать изменения без записи.
 *
 *   npm --prefix studio run -s sanity -- exec import/worlds-2026-11-25.mjs --with-user-token -- [--dry] [--force]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { getCliClient } from 'sanity/cli';
import { WORLD_TEXTS, POPUP_TEXTS } from './worlds-2026-11-25-texts.mjs';

const dry = process.argv.includes('--dry');
const force = process.argv.includes('--force');

const client = getCliClient({ apiVersion: '2025-02-19' }).withConfig({ perspective: 'raw' });

/** Группа текстов: [{ _key, _type: internationalizedArray<Type>Value, language, value: { _type, ...поля } }]. */
const group = (type, byLang) =>
  Object.entries(byLang).map(([language, value]) => ({
    _key: language, _type: `internationalizedArray${type[0].toUpperCase()}${type.slice(1)}Value`, language, value: { _type: type, ...value },
  }));
const strings = (byLang) =>
  Object.entries(byLang).map(([language, value]) => ({ _key: language, _type: 'internationalizedArrayStringValue', language, value }));

const docs = await client.fetch('*[_id in ["landing", "drafts.landing", "siteSettings", "drafts.siteSettings"]]');
for (const id of ['landing', 'siteSettings']) if (!docs.find((d) => d._id === id)) throw new Error(`Документ ${id} не знайдено`);

const tx = client.transaction();
const log = [];
for (const doc of docs) {
  const id = doc._id;
  const set = {};
  if (doc._type === 'landing') {
    const block = doc.blocks?.find((b) => b._type === 'worlds');
    if (!block) { log.push(`${id}: блоку «Три світи» немає — пропущено`); continue; }
    for (const w of block.worlds ?? []) {
      const t = WORLD_TEXTS[w._key];
      if (!t) { log.push(`${id}: світ ${w._key} (${w.name}) — текстів у вивантаженні немає, пропущено`); continue; }
      const at = `blocks[_key=="${block._key}"].worlds[_key=="${w._key}"]`;
      if (!w.popupTexts?.length || force) {
        set[`${at}.popupTexts`] = group('worldPopupTexts', { uk: t.uk, en: t.en });
        log.push(`${id} · ${w.name} · тексти вікна: «${t.uk.commissioning}», «${t.uk.access}», про секцію (${t.uk.about.length} симв.)`);
      }
      if (!w.features?.length || force) {
        set[`${at}.features`] = t.features.map(([uk, en], n) => ({ _key: `f${n + 1}`, _type: 'worldFeature', label: strings({ uk, en }) }));
        log.push(`${id} · ${w.name} · інфраструктура: ${t.features.length} пунктів`);
      }
    }
  } else {
    if (!doc.popups?.world?.texts?.length || force) {
      set['popups.world'] = { texts: group('popupWorldTexts', POPUP_TEXTS) };
      log.push(`${id} · Попапи → «Вікно «Детальніше» світу»: ${Object.keys(POPUP_TEXTS.uk).length} підписів (uk, en)`);
    }
  }
  if (Object.keys(set).length) tx.patch(id, (p) => p.ifRevisionId(doc._rev).setIfMissing(doc._type === 'siteSettings' ? { popups: {} } : {}).set(set));
}

log.forEach((s) => console.log(`${dry ? '[перевірка] ' : ''}${s}`));
if (!log.some((s) => s.includes(' · '))) { console.log('Змін немає.'); process.exit(0); }
if (dry) { console.log('--dry: запису немає.'); process.exit(0); }

const dir = path.join(homedir(), 'forrest-backups');
mkdirSync(dir, { recursive: true });
const backup = path.join(dir, `landing-siteSettings-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}-before-worlds-popup.json`);
writeFileSync(backup, JSON.stringify(docs, null, 2));
console.log(`Резервна копія: ${backup}`);
const res = await tx.commit();
console.log(`Записано, транзакція ${res.transactionId}.`);
