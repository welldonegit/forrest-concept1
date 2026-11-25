/**
 * Эксперт в формах (карточка у «Фінмодель» и финальной формы) → Уляна Белінська, как в квизе (2026-11-25).
 * «Налаштування сайту» → «Експерт у формах»: фото, імʼя, посада — копия из «Попапи → Квіз» (менеджер:
 * фото, імʼя, посада) того же документа. Фото — тот же файл из библиотеки Sanity (без повторной загрузки),
 * с подписью (alt) и точкой фокуса квиза. Старое фото остаётся в библиотеке (не удаляется).
 * Код не меняется — изменение попадёт на сайт с ближайшей сборкой. Второго этапа нет.
 *
 * Опубликованный документ и черновик (если есть), резервная копия JSON в ~/forrest-backups/,
 * запись одной транзакцией, повторный запуск ничего не меняет. --dry — показать изменения без записи.
 *
 *   npm --prefix studio run -s sanity -- exec import/form-manager-2026-11-25.mjs --with-user-token -- [--dry]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { getCliClient } from 'sanity/cli';

const dry = process.argv.includes('--dry');
const client = getCliClient({ apiVersion: '2025-02-19' }).withConfig({ perspective: 'raw' });
const docs = await client.fetch('*[_id in ["siteSettings", "drafts.siteSettings"]]');
if (!docs.find((d) => d._id === 'siteSettings')) throw new Error('Документ siteSettings не знайдено');

const tx = client.transaction();
const log = [];
for (const doc of docs) {
  const id = doc._id;
  const quiz = doc.popups?.quiz;
  const photo = quiz?.managerPhoto;
  if (!photo?.asset?._ref) throw new Error(`${id}: у квізі немає фото менеджера`);
  const set = {};

  if (doc.manager?.photo?.asset?._ref !== photo.asset._ref) {
    set['manager.photo'] = { ...photo, alt: photo.alt?.map((a) => ({ ...a, _key: a.language })) };
    log.push(`${id} експерт у формах · фото: ${doc.manager?.photo?.asset?._ref ?? '—'} → ${photo.asset._ref} (як у квізі)`);
  }

  // тексты квиза по языкам → «Експерт у формах»: имя и должность
  const qt = Object.fromEntries((quiz.texts ?? []).map((t) => [t.language, t.value ?? {}]));
  const mt = doc.manager?.texts ?? [];
  const next = Object.keys(qt).map((language) => {
    const cur = mt.find((t) => t.language === language);
    const value = { _type: 'managerTexts', ...(cur?.value ?? {}) };
    for (const [from, to] of [['managerName', 'name'], ['managerRole', 'role']]) {
      if (qt[language][from] && value[to] !== qt[language][from]) {
        log.push(`${id} експерт у формах (${language}) · ${to}: «${value[to] ?? ''}» → «${qt[language][from]}»`);
        value[to] = qt[language][from];
      }
    }
    return { _key: cur?._key ?? language, _type: 'internationalizedArrayManagerTextsValue', language, value };
  });
  // языки, которых нет в квизе, остаются как были
  for (const t of mt) if (!qt[t.language]) next.push(t);
  if (JSON.stringify(next) !== JSON.stringify(mt)) set['manager.texts'] = next;

  if (Object.keys(set).length) tx.patch(id, (p) => p.ifRevisionId(doc._rev).setIfMissing({ manager: {} }).set(set));
}

log.forEach((s) => console.log(`${dry ? '[перевірка] ' : ''}${s}`));
if (!log.length) { console.log('Змін немає.'); process.exit(0); }
if (dry) { console.log(`--dry: змін ${log.length}. Запису немає.`); process.exit(0); }

const dir = path.join(homedir(), 'forrest-backups');
mkdirSync(dir, { recursive: true });
const backup = path.join(dir, `siteSettings-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}-before-form-manager.json`);
writeFileSync(backup, JSON.stringify(docs, null, 2));
console.log(`Резервна копія: ${backup}`);
const res = await tx.commit();
console.log(`Записано: ${log.length} змін, транзакція ${res.transactionId}.`);
