/**
 * Попап «Звʼязатися» (выгрузка 2026-11-25, design-export/updates/2026-11-25-contact-popup/) → «Налаштування сайту».
 *
 *   --stage add      — новые поля (безопасно и до слияния кода: старый код их не читает):
 *                      Попапи → «Попап «Звʼязатися»»: назва вікна, заголовок, кнопка відправки, фото.
 *                      Тексты uk — из выгрузки; en — перевод разработчика, НЕ УТВЕРЖДЁН: отмечен в поле
 *                      «Переклад не затверджено» (en) и в docs/ROADMAP.md.
 *                      Поля «Імʼя», «Телефон», подсказки и ошибки — общие («Форми заявки»), не дублируются;
 *                      телефон для кнопки без JS — «Контакти → Телефон для дзвінка».
 *                      Уже заполненные поля не меняются (--force — заменить). Фото — оригинал из выгрузки.
 *   --stage cleanup  — только после слияния и выкладки нового кода: удаляет «Шапка → Кнопка «Звʼязатися» → Адреса»
 *                      (header.cta.href, было #forma): кнопка теперь открывает попап, адрес не читается.
 *                      Перед записью проверяет боевой сайт: есть /popup/contact/ с попапом; нет — останавливается
 *                      (старый код без адреса не собирается). --site <адрес> — другой сайт, --skip-site-check — без проверки.
 *
 * Обе стадии: опубликованный документ и черновик (если есть), резервная копия JSON в ~/forrest-backups/,
 * запись одной транзакцией, повторный запуск ничего не меняет. --dry — показать изменения без записи.
 *
 *   npm --prefix studio run -s sanity -- exec import/contact-popup-2026-11-25.mjs --with-user-token -- --stage add|cleanup [--dry]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { getCliClient } from 'sanity/cli';

const dry = process.argv.includes('--dry');
const force = process.argv.includes('--force');
const arg = (name) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined);
const stage = arg('--stage');
if (!['add', 'cleanup'].includes(stage)) throw new Error('Вкажіть --stage add або --stage cleanup');

const IMG = new URL('../../design-export/updates/2026-11-25-contact-popup/img/', import.meta.url);

/** Тексты по языкам: uk — выгрузка, en — перевод (не утверждён). */
const TEXTS = {
  uk: {
    dialogLabel: "Зв'язатися з нами",
    title: 'Бажаєте отримати більше інформації про FORREST Trinity Resort?',
    submitLabel: 'Передзвоніть мені',
  },
  en: {
    dialogLabel: 'Contact us',
    title: 'Would you like more information about FORREST Trinity Resort?',
    submitLabel: 'Call me back',
  },
};
// точка фокуса — object-position выгрузки (62% 58%)
const PHOTO = { file: 'contact-popup-winter.avif', hotspot: { x: 0.62, y: 0.58 }, alt: { uk: 'FORREST Trinity Resort взимку', en: 'FORREST Trinity Resort in winter' } };

const client = getCliClient({ apiVersion: '2025-02-19' }).withConfig({ perspective: 'raw' });

if (stage === 'cleanup' && !dry && !process.argv.includes('--skip-site-check')) {
  const site = (arg('--site') ?? 'https://forrestresort.com.ua/').replace(/\/?$/, '/');
  const res = await fetch(`${site}popup/contact/`, { headers: { 'cache-control': 'no-cache' } });
  const html = res.ok ? await res.text() : '';
  if (!html.includes('data-cpop')) {
    throw new Error(`${site}popup/contact/: попапу «Звʼязатися» на сайті ще немає (відповідь ${res.status}). Спочатку злийте код, запустіть --stage add і дочекайтеся збірки.`);
  }
  console.log(`${site}: попап «Звʼязатися» на місці — продовжую.`);
}

const i18n = (values, type = 'internationalizedArrayStringValue') =>
  Object.entries(values).map(([language, value]) => ({ _key: language, _type: type, language, value }));

async function photo({ file, hotspot, alt }) {
  const ref = dry ? `(${file})` : (await client.assets.upload('image', readFileSync(new URL(file, IMG)), { filename: file }))._id;
  return {
    _type: 'photo', asset: { _type: 'reference', _ref: ref },
    hotspot: { _type: 'sanity.imageHotspot', ...hotspot, width: 1, height: 1 },
    decorative: false, alt: i18n(alt),
  };
}

const docs = await client.fetch('*[_id in ["siteSettings", "drafts.siteSettings"]]');
if (!docs.find((d) => d._id === 'siteSettings')) throw new Error('Документ siteSettings не знайдено');

const tx = client.transaction();
const log = [];
let uploaded;
for (const doc of docs) {
  const id = doc._id;
  const contact = doc.popups?.contact ?? {};
  const set = {};
  const unset = [];

  if (stage === 'add') {
    if (!contact.texts?.length || force) {
      set['popups.contact.texts'] = Object.entries(TEXTS).map(([language, value]) => ({
        _key: language, _type: 'internationalizedArrayPopupContactTextsValue', language, value: { _type: 'popupContactTexts', ...value },
      }));
      for (const [language, t] of Object.entries(TEXTS)) log.push(`${id} попап «Звʼязатися» (${language}) · ${Object.values(t).map((v) => `«${v}»`).join(', ')}`);
      set['popups.contact.unapprovedLanguages'] = ['en'];
      log.push(`${id} попап «Звʼязатися» · «Переклад не затверджено»: en`);
    }
    if (!contact.image?.asset || force) {
      uploaded ??= await photo(PHOTO);
      set['popups.contact.image'] = uploaded;
      log.push(`${id} попап «Звʼязатися» · фото: ${PHOTO.file}, фокус ${PHOTO.hotspot.x}/${PHOTO.hotspot.y}`);
    }
  } else if (doc.header?.cta?.href !== undefined) {
    unset.push('header.cta.href');
    log.push(`${id} шапка · кнопка «Звʼязатися»: прибрати адресу «${doc.header.cta.href}»`);
  }
  if (Object.keys(set).length || unset.length) {
    tx.patch(id, (p) => {
      const q = p.ifRevisionId(doc._rev);
      return (stage === 'add' ? q.setIfMissing({ popups: {} }).setIfMissing({ 'popups.contact': {} }) : q).set(set).unset(unset);
    });
  }
}

log.forEach((s) => console.log(`${dry ? '[перевірка] ' : ''}${s}`));
if (!log.length) { console.log('Змін немає.'); process.exit(0); }
if (dry) { console.log(`--dry: змін ${log.length}. Запису немає.`); process.exit(0); }

const dir = path.join(homedir(), 'forrest-backups');
mkdirSync(dir, { recursive: true });
const backup = path.join(dir, `siteSettings-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}-before-contact-popup-${stage}.json`);
writeFileSync(backup, JSON.stringify(docs, null, 2));
console.log(`Резервна копія: ${backup}`);
const res = await tx.commit();
console.log(`Записано: ${log.length} змін, транзакція ${res.transactionId}.`);
