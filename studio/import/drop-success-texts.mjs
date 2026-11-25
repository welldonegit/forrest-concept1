/**
 * Уборка текстов успеха квиза и попапа апартамента (решение 2026-11-25): после заявки все источники ведут
 * на «Дякуємо», поля убраны из схемы — в данных остались значения, Studio показывает «неизвестные поля».
 * Удаляются в «Налаштування сайту» (опубликованный документ и черновик, если есть), во всех языках:
 *   popups.quiz.texts[].value.successTitle / successText / returnLabel
 *   popups.apartment.texts[].value.successLabel
 *
 * Запись в Sanity сразу пересобирает боевой сайт (main), а старый код эти тексты выводит (шаг «Дякуємо» квиза,
 * подпись кнопки попапа). Поэтому скрипт сначала открывает боевой сайт и проверяет, что код уже новый
 * (в /popup/quiz/ нет шага «Дякуємо», в /popup/apartments/ нет data-success-label); старый — останавливается.
 * --site <адрес> — другой сайт, --skip-site-check — без проверки (только если уверены).
 *
 * Перед записью — резервная копия документов (JSON) в ~/forrest-backups/; запись — одной транзакцией.
 * Повторный запуск ничего не меняет. --dry — показать, что будет удалено, без проверки сайта и записи.
 *
 *   npm --prefix studio run -s sanity -- exec import/drop-success-texts.mjs --with-user-token -- [--dry]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { getCliClient } from 'sanity/cli';

const dry = process.argv.includes('--dry');
const arg = (name) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined);
const FIELDS = { quiz: ['successTitle', 'successText', 'returnLabel'], apartment: ['successLabel'] };

if (!dry && !process.argv.includes('--skip-site-check')) {
  const site = (arg('--site') ?? 'https://forrestresort.com.ua/').replace(/\/?$/, '/');
  for (const [page, old] of [['popup/quiz/', 'quiz__step--done'], ['popup/apartments/', 'data-success-label']]) {
    const res = await fetch(site + page, { headers: { 'cache-control': 'no-cache' } });
    if (!res.ok) throw new Error(`${site}${page}: відповідь ${res.status} — спробуйте ще раз за хвилину`);
    if ((await res.text()).includes(old)) {
      throw new Error(`${site}${page}: на сайті ще старий код (${old}). Спочатку злийте код і дочекайтеся збірки.`);
    }
  }
  console.log(`${site}: новий код на місці — продовжую.`);
}

const client = getCliClient({ apiVersion: '2025-02-19' }).withConfig({ perspective: 'raw' });
const docs = await client.fetch('*[_id in ["siteSettings", "drafts.siteSettings"]]');
if (!docs.length) throw new Error('Документ siteSettings не знайдено');

const tx = client.transaction();
let total = 0;
for (const doc of docs) {
  const paths = [];
  for (const [popup, names] of Object.entries(FIELDS)) {
    for (const item of doc.popups?.[popup]?.texts ?? []) {
      for (const name of names) {
        if (item.value?.[name] !== undefined) paths.push(`popups.${popup}.texts[_key=="${item._key}"].value.${name}`);
      }
    }
  }
  paths.forEach((p) => console.log(`${doc._id}: ${p}`));
  if (paths.length) tx.patch(doc._id, (p) => p.unset(paths));
  total += paths.length;
}
if (!total) {
  console.log('Нічого видаляти — тексти вже прибрані.');
  process.exit(0);
}
if (dry) {
  console.log(`--dry: буде видалено полів: ${total}. Запису немає.`);
  process.exit(0);
}

const dir = path.join(homedir(), 'forrest-backups');
mkdirSync(dir, { recursive: true });
const backup = path.join(dir, `siteSettings-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}-before-drop-success-texts.json`);
writeFileSync(backup, JSON.stringify(docs, null, 2));
console.log(`Резервна копія: ${backup}`);

const res = await tx.commit();
console.log(`Видалено полів: ${total}, транзакція ${res.transactionId}.`);
