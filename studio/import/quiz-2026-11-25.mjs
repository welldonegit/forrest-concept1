/**
 * Новый квиз (выгрузка 2026-11-25, design-export/updates/2026-11-25/quiz/) → «Налаштування сайту» → Попапи → Квіз.
 *
 *   --stage add      — новые поля (безопасно и до слияния кода: старый код их не читает):
 *                      шаг «Месенджер», заголовок шага с формой, менеджер (имя, должность, фото), реплики по шагам,
 *                      «Ваші бонуси» (три пункта с миниатюрами). Тексты uk — из выгрузки; en — перевод
 *                      разработчика, НЕ УТВЕРЖДЁН (docs/ROADMAP.md). Уже заполненные поля не меняются (--force — заменить).
 *                      Фото — оригиналы из выгрузки (сайт сам готовит размеры).
 *   --stage cleanup  — только после слияния и выкладки нового квиза: удаляет поля, которые новый код не читает:
 *                      popups.quiz: contactTitle, contactText, emailLabel, consentText, consentLinkLabel;
 *                      form.errors: consent. privacyPolicy остаётся: на неё ссылаются попапы миров (этап 2).
 *                      Перед записью проверяет боевой сайт: в /popup/quiz/ есть шаг «Месенджер» и нет согласия;
 *                      старый код — останавливается. --site <адрес> — другой сайт, --skip-site-check — без проверки.
 *
 * Обе стадии: опубликованный документ и черновик (если есть), резервная копия JSON в ~/forrest-backups/,
 * запись одной транзакцией, повторный запуск ничего не меняет. --dry — показать изменения без записи.
 *
 *   npm --prefix studio run -s sanity -- exec import/quiz-2026-11-25.mjs --with-user-token -- --stage add|cleanup [--dry]
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

const IMG = new URL('../../design-export/updates/2026-11-25/quiz/img/', import.meta.url);

/** Тексты по языкам: uk — выгрузка, en — перевод (не утверждён). */
const TEXTS = {
  uk: {
    messengerTitle: 'У який месенджер вам надіслати інформацію?',
    messengerText: 'Фінмодель, планування та умови оплати прийдуть одним повідомленням',
    messengerGroupLabel: 'Месенджер',
    formTitle: 'Будь ласка, заповніть форму нижче',
    managerName: 'Уляна Белінська',
    managerRole: 'Експерт з інвестицій',
    onlineLabel: 'Онлайн',
    bubbleFormat: 'Оберіть формат, а я підготую розрахунок дохідності саме для нього',
    bubbleBudget: 'Чудовий вибір! Вкажіть бюджет, і я підберу апартаменти з найкращою дохідністю',
    bubbleMessenger: 'Де вам зручніше спілкуватися? Надішлю матеріали саме туди',
    bubbleContact: 'Залишився останній крок: залиште номер, і я надішлю розрахунок у {messenger}',
    bonusesTitle: 'Ваші бонуси',
    bonusLockedLabel: 'Відкриється після заявки',
    bonusOpenLabel: 'Доступно',
  },
  en: {
    messengerTitle: 'Which messenger should we send the information to?',
    messengerText: 'The financial model, floor plans and payment terms will arrive in one message',
    messengerGroupLabel: 'Messenger',
    formTitle: 'Please fill in the form below',
    managerName: 'Uliana Belinska',
    managerRole: 'Investment expert',
    onlineLabel: 'Online',
    bubbleFormat: 'Choose a format and I’ll prepare a yield calculation for it',
    bubbleBudget: 'Great choice! Tell me your budget and I’ll pick the apartments with the best yield',
    bubbleMessenger: 'Where is it easier for you to talk? I’ll send the materials there',
    bubbleContact: 'One last step: leave your number and I’ll send the calculation to {messenger}',
    bonusesTitle: 'Your bonuses',
    bonusLockedLabel: 'Unlocks after you submit the request',
    bonusOpenLabel: 'Unlocked',
  },
};
const BONUSES = [
  { key: 'plans', file: 'catalog-plans.jpg', hotspot: { x: 0.5, y: 0.5 }, uk: 'Добірка актуальних планувань з цінами', en: 'Current floor plans with prices' },
  { key: 'payback', file: 'final-form.jpg', hotspot: { x: 0.28, y: 0.22 }, uk: 'Розрахунок прогнозованої окупності', en: 'Projected payback calculation' },
  { key: 'terms', file: 'card-income.jpg', hotspot: { x: 0.5, y: 0.45 }, uk: 'Умови оплати та розтермінування', en: 'Payment terms and instalments' },
];
const MANAGER = { file: 'manager-ulyana.jpg', hotspot: { x: 0.5, y: 0.4 }, alt: { uk: TEXTS.uk.managerName, en: TEXTS.en.managerName } };
const OLD_QUIZ = ['contactTitle', 'contactText', 'emailLabel', 'consentText', 'consentLinkLabel'];

const client = getCliClient({ apiVersion: '2025-02-19' }).withConfig({ perspective: 'raw' });

if (stage === 'cleanup' && !dry && !process.argv.includes('--skip-site-check')) {
  const site = (arg('--site') ?? 'https://forrestresort.com.ua/').replace(/\/?$/, '/');
  const res = await fetch(`${site}popup/quiz/`, { headers: { 'cache-control': 'no-cache' } });
  if (!res.ok) throw new Error(`${site}popup/quiz/: відповідь ${res.status} — спробуйте ще раз за хвилину`);
  const html = await res.text();
  if (!html.includes('data-quiz-messenger') || html.includes('name="consent"')) {
    throw new Error(`${site}popup/quiz/: на сайті ще старий квіз. Спочатку злийте код і дочекайтеся збірки.`);
  }
  console.log(`${site}: новий квіз на місці — продовжую.`);
}

const i18n = (values, type = 'internationalizedArrayStringValue') =>
  Object.entries(values).map(([language, value]) => ({ _key: language, _type: type, language, value }));

const uploads = {};
async function photo(file, hotspot, alt) {
  const ref = dry ? `(${file})` : (uploads[file] ??= (await client.assets.upload('image', readFileSync(new URL(file, IMG)), { filename: file }))._id);
  const img = {
    _type: 'photo', asset: { _type: 'reference', _ref: ref },
    hotspot: { _type: 'sanity.imageHotspot', ...hotspot, width: 1, height: 1 },
    decorative: !alt,
  };
  if (alt) img.alt = i18n(alt);
  return img;
}

const docs = await client.fetch('*[_id in ["siteSettings", "drafts.siteSettings"]]');
if (!docs.find((d) => d._id === 'siteSettings')) throw new Error('Документ siteSettings не знайдено');

const tx = client.transaction();
const log = [];
for (const doc of docs) {
  const id = doc._id;
  const quiz = doc.popups?.quiz ?? {};
  const set = {};
  const unset = [];

  if (stage === 'add') {
    for (const item of quiz.texts ?? []) {
      const add = TEXTS[item.language];
      if (!add) continue;
      for (const [name, value] of Object.entries(add)) {
        if (item.value?.[name] && !force) continue;
        set[`popups.quiz.texts[_key=="${item._key}"].value.${name}`] = value;
        log.push(`${id} квіз (${item.language}) · ${name}: «${value}»`);
      }
    }
    if (!quiz.managerPhoto?.asset || force) {
      set['popups.quiz.managerPhoto'] = await photo(MANAGER.file, MANAGER.hotspot, MANAGER.alt);
      log.push(`${id} квіз · фото менеджера: ${MANAGER.file}`);
    }
    if (!quiz.bonuses?.length || force) {
      set['popups.quiz.bonuses'] = await Promise.all(BONUSES.map(async (b) => ({
        _key: b.key, _type: 'quizBonus', title: i18n({ uk: b.uk, en: b.en }), image: await photo(b.file, b.hotspot),
      })));
      log.push(`${id} квіз · бонуси: ${BONUSES.map((b) => `«${b.uk}» (${b.file})`).join(', ')}`);
    }
  } else {
    for (const item of quiz.texts ?? []) {
      for (const name of OLD_QUIZ) {
        if (item.value?.[name] === undefined) continue;
        unset.push(`popups.quiz.texts[_key=="${item._key}"].value.${name}`);
        log.push(`${id} квіз (${item.language}) · прибрати ${name}: «${item.value[name]}»`);
      }
    }
    for (const item of doc.form?.errors?.texts ?? []) {
      if (item.value?.consent === undefined) continue;
      unset.push(`form.errors.texts[_key=="${item._key}"].value.consent`);
      log.push(`${id} помилки форм (${item.language}) · прибрати consent: «${item.value.consent}»`);
    }
  }
  if (Object.keys(set).length || unset.length) tx.patch(id, (p) => p.ifRevisionId(doc._rev).set(set).unset(unset));
}

log.forEach((s) => console.log(`${dry ? '[перевірка] ' : ''}${s}`));
if (!log.length) { console.log('Змін немає.'); process.exit(0); }
if (dry) { console.log(`--dry: змін ${log.length}. Запису немає.`); process.exit(0); }

const dir = path.join(homedir(), 'forrest-backups');
mkdirSync(dir, { recursive: true });
const backup = path.join(dir, `siteSettings-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}-before-quiz-${stage}.json`);
writeFileSync(backup, JSON.stringify(docs, null, 2));
console.log(`Резервна копія: ${backup}`);
const res = await tx.commit();
console.log(`Записано: ${log.length} змін, транзакція ${res.transactionId}.`);
