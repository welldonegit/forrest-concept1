/**
 * Перестройка фикстур под схему Sanity (план этапа 3): то, что в фикстурах лежит иначе,
 * чем в админке. Возвращает документы в форме фикстур; поля раскладывает build.mjs.
 * Обратную сборку для компонентов делает src/lib/content.ts — компоненты не меняются.
 */
const clone = (v) => JSON.parse(JSON.stringify(v));

/** Заголовок «массив переводов» → строки-объекты { text } (в Sanity нет массивов массивов). */
function lines(title, type) {
  return title.map((t, i) => ({ _key: `l${i + 1}`, _type: type, text: t }));
}

const icon = (file) => ({ asset: { _ref: `fixture:${file}` } });

/** Служебные пояснения фикстур (_comment) — для разработчика, на сайт не выводятся; их смысл — в подсказках полей Studio. */
function dropComments(v, path, notes) {
  if (Array.isArray(v)) v.forEach((x, i) => dropComments(x, `${path}[${x?._key ?? i}]`, notes));
  else if (v && typeof v === 'object') {
    if ('_comment' in v) { notes.push(`${path}._comment — пояснение для разработчика, не переносится`); delete v._comment; }
    for (const [k, x] of Object.entries(v)) dropComments(x, `${path}.${k}`, notes);
  }
}

export function restructure(fixtures, { notes }) {
  const landing = clone(fixtures.landing);
  const settings = clone(fixtures.siteSettings);
  dropComments(landing, 'landing', notes);
  dropComments(settings, 'siteSettings', notes);
  const docs = [];
  const block = (type) => landing.blocks.find((b) => b._type === type);

  // Hero и Season: заголовок по строкам.
  const hero = block('hero');
  hero.title = lines(hero.title, 'heroTitleLine');
  // Контур зданий: точки [x, y] → { x, y }; служебный комментарий фикстуры не переносится (он про происхождение данных).
  hero.skyline.points = hero.skyline.points.map(([x, y], i) => ({ _key: `p${i}`, _type: 'skylinePoint', x, y }));
  const season = block('season');
  season.title = lines(season.title, 'seasonTitleLine');

  // Локация: иконки категорий меток — нынешние из кода.
  const location = block('location');
  location.icons = Object.fromEntries(['parking', 'food', 'leisure', 'hotel'].map((n) => [n, icon(`pin-${n}.svg`)]));

  // Хід будівництва: отчёты — отдельные документы.
  const construction = block('construction');
  for (const u of construction.updates) {
    const { _key, video, ...rest } = u;
    docs.push({ _id: `report-${u.date}`, _type: 'constructionReport', ...rest, video: video ? { duration: video.duration, ...(video.file ? { file: video.file } : {}) } : undefined });
  }
  notes.push(`Хід будівництва: ${construction.updates.length} звітів → окремі документи`);
  delete construction.updates;

  // Ціни та дохідність: числа калькулятора — отдельный документ.
  const calc = block('numbers').calc;
  docs.push({
    _id: 'pricing', _type: 'pricing',
    pricePerM2: calc.pricePerM2, currency: calc.currency, years: calc.years,
    formats: calc.formats.map((f) => ({ ...f, _type: 'pricingFormat' })),
    payments: calc.payments.map((p) => ({ ...p, _type: 'pricingPayment' })),
  });
  for (const k of ['pricePerM2', 'currency', 'years', 'formats', 'payments']) delete calc[k];

  // Контакты: иконки сетей — нынешние из кода.
  for (const list of [settings.contacts.messengers, settings.contacts.socials]) {
    for (const m of list) m.icon = icon(`social-${m.network}.svg`);
  }

  docs.unshift({ _id: 'landing', _type: 'landing', blocks: landing.blocks });
  docs.push({ _id: 'siteSettings', ...settings, _type: 'siteSettings' });
  docs.push(...fixtures.apartmentFormats);
  return docs;
}
