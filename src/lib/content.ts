/**
 * Доступ к контенту. Компоненты получают данные только отсюда.
 *
 * Источник — Sanity: снимок опубликованного контента скачивает при сборке
 * src/integrations/sanity.ts в src/content-sanity/, src/lib/sanity-source.ts приводит его
 * к форме временных фикстур. CONTENT_SOURCE=fixtures — сборка из src/content-fixtures/
 * (для сверки; папка удаляется после подтверждения человека).
 *
 * Переводимые поля приходят массивом sanity-plugin-internationalized-array.
 * localize() превращает их в строки нужного языка; нет перевода → значение
 * основного языка, а сборка печатает список пропусков.
 */
import type { ImageMetadata } from 'astro';
import { defaultLanguage, languageIds } from './languages';
import siteSettingsFixture from '../content-fixtures/siteSettings.json';
import landingFixture from '../content-fixtures/landing.json';
import apartmentFormatsFixture from '../content-fixtures/apartmentFormats.json';
import legalDocumentsFixture from '../content-fixtures/legalDocuments.json';
import { fromSanity, type SanitySnapshot } from './sanity-source';
import { sanitizeSvg, type InlineIcon } from './svg';
import { documentPath, type DocumentRoute } from './routes';

/* ---------- Источник ---------- */

// Источник фиксируется при сборке (astro.config.mjs → vite.define): ветка другого источника вырезается
// вместе с его фото — иначе Vite положил бы в сборку неиспользуемые оригиналы.
declare const __CONTENT_SOURCE__: 'sanity' | 'fixtures';
const useSanity = __CONTENT_SOURCE__ === 'sanity';
const snapshotModule = import.meta.glob<SanitySnapshot>('/src/content-sanity/content.json', { eager: true, import: 'default' });
const snapshot = Object.values(snapshotModule)[0];
if (useSanity && !snapshot) throw new Error('Нет снимка Sanity (src/content-sanity/content.json): его скачивает интеграция forrest-sanity при сборке');
const source = useSanity
  ? fromSanity(snapshot!)
  : { landing: landingFixture, siteSettings: siteSettingsFixture, apartmentFormats: apartmentFormatsFixture, legalDocuments: legalDocumentsFixture };

type I18nItem = { _key?: string; language?: string; value: unknown };

const reported = new Set<string>();

function isI18nArray(v: unknown): v is I18nItem[] {
  return (
    Array.isArray(v) &&
    v.length > 0 &&
    v.every(
      (it) =>
        it && typeof it === 'object' && 'value' in it &&
        languageIds.includes((it as I18nItem).language ?? (it as I18nItem)._key ?? ''),
    )
  );
}

function pick(items: I18nItem[], lang: string, path: string): unknown {
  const byLang = (id: string) => items.find((it) => (it.language ?? it._key) === id)?.value;
  const value = byLang(lang);
  if (value !== undefined && value !== '') return value;
  const fallback = byLang(defaultLanguage);
  if (fallback === undefined || fallback === '') return fallback;
  const key = `${lang}:${path}`;
  if (!reported.has(key)) {
    reported.add(key);
    console.warn(`[i18n] нет перевода «${lang}»: ${path} → подставлен «${defaultLanguage}»`);
  }
  return fallback;
}

/* ---------- Ссылки на документы ---------- */

// Документы, на которые ссылаются другие (как reference в Sanity): форматы апартаментов
// — одни данные для карточек Apartments и списка в форме; документы сайта — для FAQ, футера и согласия квиза.
const documents = new Map<string, unknown>(
  [...(source.apartmentFormats as { _id: string }[]), ...(source.legalDocuments as { _id: string }[])].map((d) => [d._id, d]),
);

/** Подставляет документы вместо ссылок { _type: 'reference', _ref }. */
function deref(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(deref);
  if (value && typeof value === 'object') {
    const v = value as Record<string, unknown>;
    if (v._type === 'reference' && typeof v._ref === 'string') {
      const doc = documents.get(v._ref);
      if (!doc) throw new Error(`Нет документа для ссылки ${v._ref}`);
      return deref(doc);
    }
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deref(x)]));
  }
  return value;
}

/** Рекурсивно заменяет переводимые поля значениями на языке lang. */
export function localize<T = unknown>(value: unknown, lang: string, path = ''): T {
  if (isI18nArray(value)) return pick(value, lang, path) as T;
  if (Array.isArray(value)) {
    return value.map((v, i) => localize(v, lang, `${path}[${(v as { _key?: string })?._key ?? i}]`)) as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = localize(v, lang, path ? `${path}.${k}` : k);
    return out as T;
  }
  return value as T;
}

/**
 * Ссылки на документы сайта: документ (после deref и localize) → { title, href } на языке страницы;
 * у ссылки с полем document адрес берётся из документа (футер: «Документ сайту» вместо «Адреса»).
 */
function linkDocuments<T>(value: T, lang: string): T {
  if (Array.isArray(value)) return value.map((v) => linkDocuments(v, lang)) as T;
  if (value && typeof value === 'object') {
    const v = value as Record<string, unknown>;
    if (v._type === 'legalDocument') return { title: v.title, href: documentPath(lang, v as unknown as DocumentRoute) } as T;
    const out = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, linkDocuments(x, lang)]));
    const doc = out.document as DocumentLink | undefined;
    if (doc?.href) out.href = doc.href;
    return out as T;
  }
  return value;
}

/* ---------- Фото ---------- */

// Всё, что попало в glob, Vite кладёт в сборку, поэтому список зависит от источника.
// Sanity: оригиналы, скачанные при сборке (src/integrations/sanity.ts).
// Фикстуры: только фото, на которые они ссылаются; источник — design-export/assets/photos (Р8),
// фото карточек Stats есть только в корне выгрузки.
type PhotoGlob = Record<string, () => Promise<ImageMetadata>>;
const fixturePhotos: PhotoGlob = __CONTENT_SOURCE__ === 'sanity'
  ? import.meta.glob<ImageMetadata>('/src/content-sanity/assets/*.{jpg,jpeg,png,webp,gif,avif,svg}', { import: 'default' })
  : import.meta.glob<ImageMetadata>(
  [
    '/design-export/assets/photos/hero-summer.jpg',
    '/design-export/updates/2026-11-25/ukraine-bukovel/img/bukovel-hills.jpg',
    '/design-export/assets/photos/hero-winter.jpg',
    '/design-export/assets/photos/card-apartments.jpg',
    '/design-export/assets/photos/footer-bridge.jpg',
    '/design-export/assets/photos/wind-section-winter.jpg',
    '/design-export/assets/photos/rock-section-winter.jpg',
    '/design-export/assets/photos/sun-section-winter.jpg',
    '/design-export/video-poster-forest.jpg',
    '/design-export/card-apartments-new.jpg',
    '/design-export/card-okupnist.jpg',
    '/design-export/card-income.jpg',
    '/design-export/assets/photos/bukovel-map.jpg',
    '/design-export/tooltip.jpg',
    '/design-export/assets/photos/wind-snowboarder.jpg',
    '/design-export/assets/photos/sun-pool.jpg',
    '/design-export/assets/photos/wind-woman.jpg',
    '/design-export/assets/photos/rock-section.jpg',
    '/design-export/assets/photos/sun-family-meadow.jpg',
    '/design-export/assets/photos/rock-bar-toast.jpg',
    '/design-export/assets/photos/sun-section.jpg',
    '/design-export/assets/photos/sun-carpathian-slope.jpg',
    '/design-export/assets/photos/rock-detail-hands.jpg',
    '/design-export/assets/photos/rock-terrace-evening.jpg',
    '/design-export/assets/photos/wind-architecture.jpg',
    '/design-export/assets/photos/rock-man-sunset.jpg',
    '/design-export/assets/photos/wind-section.jpg',
    '/design-export/hero-summer-mob.jpg',
    '/design-export/hero-winter-mob.jpg',
    '/design-export/assets/photos/catalog-plans.jpg',
    '/design-export/final-form.jpg',
    '/design-export/manager.jpg',
    '/design-export/updates/2026-11-25/quiz/img/manager-ulyana.jpg',
    '/design-export/superior-room.jpg',
    '/design-export/deluxe-room.jpg',
    '/design-export/family-room.jpg',
    '/design-export/junior-room.jpg',
    '/design-export/presidential-room.jpg',
    '/design-export/assets/photos/wood-pano.jpg',
    '/design-export/assets/photos/team-card-perspektyva.webp',
    '/design-export/assets/photos/team-card-filimonov.webp',
    '/design-export/assets/photos/team-card-maestro.jpg',
    '/design-export/assets/photos/team-card-makhno.webp',
    '/design-export/assets/photos/team-myronenko.png',
    '/design-export/assets/photos/team-filimonov-kashirina.webp',
    '/design-export/assets/photos/team-rezhinsky.webp',
    '/design-export/assets/photos/team-makhno.webp',
    // попап апартамента (4.17)
    '/design-export/superior-plan.jpg',
    '/design-export/family-plan.jpg',
    '/design-export/assets/photos/plan-room.jpg',
    '/design-export/assets/photos/wind-interior-reading.jpg',
    // логотипы партнёров (SVG из выгрузки, без изменений)
    '/design-export/assets/logos/perspektyva-group-dark.svg',
    '/design-export/assets/logos/filimonov-kashirina-architects-dark.svg',
    '/design-export/assets/logos/maestro-hotel-management-dark.svg',
    '/design-export/assets/logos/makhno-studio-white-dark.svg',
  ],
  { import: 'default' },
);

/** SVG-иконки контента из Sanity — текстом, для встраивания в страницу. */
const sanitySvgText = import.meta.glob<string>('/src/content-sanity/assets/*.svg', { query: '?raw', import: 'default', eager: true });

export interface SanityImage {
  asset: { _ref: string };
  hotspot?: { x: number; y: number };
  /** «Декоративне фото»: alt не нужен, выводится пустым (CLAUDE.md). */
  decorative?: boolean;
  /** Обязателен, если фото не декоративное. */
  alt?: string;
}

export interface ResolvedImage {
  src: ImageMetadata;
  alt: string;
  /** Позиция фокуса для object-position, из hotspot. */
  position: string;
}

/** Файл Sanity (sanity:<id>) → путь оригинала в src/content-sanity/assets/. */
function sanityFile(ref: string): string {
  const id = ref.slice('sanity:'.length);
  const f = snapshot?.files[id];
  if (!f) throw new Error(`Файла ${id} нет в снимке Sanity`);
  return `/src/content-sanity/assets/${f.file}`;
}

export async function resolveImage(img: SanityImage): Promise<ResolvedImage> {
  const ref = img.asset._ref;
  let file: string;
  let load: (() => Promise<ImageMetadata>) | undefined;
  if (ref.startsWith('sanity:')) {
    file = sanityFile(ref);
    load = fixturePhotos[file];
    if (!load) throw new Error(`Оригинал фото не скачан: ${file}`);
  } else {
    if (!ref.startsWith('fixture:')) throw new Error(`Неизвестная ссылка на фото: ${ref}`);
    file = ref.slice('fixture:'.length);
    load = fixturePhotos[`/design-export/assets/photos/${file}`] ?? fixturePhotos[`/design-export/${file}`];
    if (!load) throw new Error(`Фото нет в списке fixturePhotos (content.ts): ${file}`);
  }
  const x = Math.round((img.hotspot?.x ?? 0.5) * 100);
  const y = Math.round((img.hotspot?.y ?? 0.5) * 100);
  if (!img.decorative && !img.alt) throw new Error(`Нет alt у фото ${file}: заполни alt или отметь «декоративне фото»`);
  return { src: await load(), alt: img.decorative ? '' : (img.alt ?? ''), position: `${x}% ${y}%` };
}

/** Иконка контента (поле SVG в админке); пусто — undefined, компонент рисует иконку из кода. */
export function resolveIcon(icon: { asset?: { _ref?: string } } | undefined, label: string): InlineIcon | undefined {
  const ref = icon?.asset?._ref;
  if (!ref) return undefined;
  if (!ref.startsWith('sanity:')) return undefined;
  const text = sanitySvgText[sanityFile(ref)];
  if (text === undefined) throw new Error(`SVG иконки ${label} не скачан`);
  return sanitizeSvg(text, label);
}

/* ---------- Документы ---------- */

export interface Link { _key: string; href: string; label: string }

/** Документ сайта в ссылке: название и адрес страницы на языке посетителя. */
export interface DocumentLink { title: string; href: string }

/** Portable Text: абзац, раздел (h2, в оглавлении), подраздел (h3), пункт списка. */
export interface PortableSpan { _key: string; _type: 'span'; text: string; marks?: string[] }
export interface PortableBlock {
  _key: string;
  _type: 'block';
  style?: 'normal' | 'h2' | 'h3';
  listItem?: 'bullet' | 'number';
  level?: number;
  markDefs?: { _key: string; _type: string; href?: string }[];
  children: PortableSpan[];
}
/** Таблица документа. headerRow — первая строка заголовки; иначе «название — значение» (на телефоне строки столбиком). */
export interface DocTable { _key: string; _type: 'docTable'; headerRow?: boolean; rows: { _key: string; cells: string[] }[] }
export type DocumentBodyItem = PortableBlock | DocTable;

/** Документ сайта: политика конфиденциальности, документы стройки (Sanity «Документ»). */
export interface LegalDocument extends DocumentRoute {
  _id: string;
  title: string;
  body: DocumentBodyItem[];
  /** Дата редакции из документа (YYYY-MM-DD); нет — не показывается. */
  editionDate?: string;
  seoTitle?: string;
  seoDescription?: string;
}
/** Поле SVG-иконки в админке (svgIcon): пусто — иконка из кода. */
export type IconRef = { asset?: { _ref?: string } } | undefined;
export interface SocialLink { _key: string; network: string; label: string; url: string; icon?: IconRef }

/** Колонка футера; contacts — колонка контактов: телефон и иконки мессенджеров вместо ссылок. */
export interface FooterGroup { _key: string; title: string; links: Link[]; contacts?: boolean }

export interface SiteSettings {
  /** SEO: тексты главной, название сайта (og:site_name, JSON-LD), картинка для соцсетей (пусто — фото первого экрана). */
  seo: { title: string; description: string; siteName: string; ogImage?: SanityImage; unapprovedLanguages?: string[] };
  ui: { skipLink: string; swipeHint: string; closeLabel: string };
  /** Страница архива хода строительства (4.18): заголовок в две строки, ссылка на главную, SEO. */
  archivePage: { seoTitle: string; seoDescription: string; title: string; subtitle: string; backLabel: string };
  /** Страница «Дякуємо» после отправки формы: первый экран главной, вместо заголовка и лида — сообщение (h1). Перенос строки — перенос на десктопе. */
  thanksPage: { seoTitle: string; seoDescription: string; message: string; homeButton: string };
  /** Страница 404 (/404.html, /en/404.html): сообщение (h1) и кнопка «На головну». */
  notFoundPage: { seoTitle: string; message: string; homeButton: string };
  /** Страницы документов: «На головну», заголовок оглавления, подпись перед датой редакции. */
  documentPage: { backLabel: string; tocTitle: string; editionLabel: string };
  /** Политика конфиденциальности — ссылка в подписи под формами. */
  privacyPolicy?: DocumentLink;
  /** Аналитика (вкладка «Технічне»): ID контейнера GTM, например GTM-XXXXXXX. Пусто — GTM не подключается. */
  analytics?: { gtmId?: string };
  /** Тексты попапов (4.17). {n} — подстановка. */
  popups: {
    apartment: {
      dialogLabel: string; areaLabel: string; priceLabel: string; incomeLabel: string; yieldLabel: string;
      fromFormat: string; yieldFormat: string; descriptionLabel: string; phoneLabel: string;
      submitLabel: string; planLabel: string; photoLabel: string; prevLabel: string; nextLabel: string;
    };
    video: { dialogLabel: string; closeLabel: string; frameTitle: string };
    /** Окно «Детальніше» мира: общие подписи. {name} — название мира, {link} — ссылка на политику. */
    world: {
      tabsLabel: string; aboutLabel: string; commissioningLabel: string; accessLabel: string; featuresLabel: string;
      formTitle: string; formText: string; nameLabel: string; phoneLabel: string; contactLegend: string;
      submitLabel: string; consentText: string; consentLinkLabel: string;
    };
    quiz: {
      tabLabel: string; tabAriaLabel: string; eyebrow: string;
      formatTitle: string; budgetTitle: string; budgets: { _key: string; label: string }[];
      messengerTitle: string; messengerText: string; messengerGroupLabel: string;
      formTitle: string; nameLabel: string; countryLabel: string;
      /** code — телефонный код страны (+380); не переводится. */
      countries: { _key: string; code: string; label: string }[];
      phonePlaceholder: string;
      backLabel: string; nextLabel: string; submitLabel: string;
      /** Менеджер в боковой панели квиза (свой, не siteSettings.manager — так в выгрузке 2026-11-25). */
      managerName: string; managerRole: string; onlineLabel: string; managerPhoto: SanityImage;
      /** Реплики менеджера по шагам; в bubbleContact {messenger} — выбранный месенджер. */
      bubbleFormat: string; bubbleBudget: string; bubbleMessenger: string; bubbleContact: string;
      bonusesTitle: string; bonusLockedLabel: string; bonusOpenLabel: string;
      bonuses: { _key: string; title: string; image: SanityImage }[];
    };
  };
  header: {
    homeHref: string;
    logoAlt: string;
    menuOpenLabel: string;
    menuCloseLabel: string;
    menuDialogLabel: string;
    languageButtonLabel: string;
    languageListLabel: string;
    cta: { label: string; href: string };
  };
  menu: {
    navLabel: string;
    primary: Link[];
    secondary: Link[];
    image: SanityImage;
    imageCaption: string;
    salesLabel: string;
    messengersLabel: string;
    addressLabel: string;
  };
  contacts: {
    phone: string;
    phoneHref: string;
    address: string;
    messengers: SocialLink[];
    socials: SocialLink[];
  };
  /** Експерт у формах (фото, ім'я, посада); телефон і месенджери — з contacts. */
  manager: { photo: SanityImage; name: string; role: string };
  /** Тексти форм заявки: підписи полів, варіанти, кнопка, успіх, помилки. */
  form: {
    nameLabel: string;
    namePlaceholder: string;
    phoneLabel: string;
    phonePlaceholder: string;
    formatLabel: string;
    /** Первый пункт списка «ещё не определился». */
    formatUndecidedLabel: string;
    /** Форматы апартаментов — ссылки на те же документы, что и карточки Apartments. */
    formats: ApartmentFormat[];
    contactLegend: string;
    /** value — технічне значення для заявки (не перекладається). */
    contactOptions: { _key: string; value: string; label: string }[];
    submitLabel: string;
    successTitle: string;
    successText: string;
    /** Тексты ошибок: пустое обязательное поле, неверный телефон, Turnstile не пройден, ошибка отправки, нет согласия (квиз). */
    errors: { required: string; phone: string; turnstile: string; send: string };
  };
  footer: {
    address: string;
    groups: FooterGroup[];
    image: SanityImage;
    wordmarkLabel: string;
    copyright: string;
    legalLinks: Link[];
    credit: { label: string; logoLabel: string; href: string };
  };
}

/* ---------- Блоки лендинга ---------- */

export interface HeroBlock {
  _type: 'hero';
  _key: string;
  /** Строки заголовка: первая — тёмная слева, вторая — белая справа. */
  title: string[];
  /** Лид; перенос строки в тексте — перенос на десктопе (как в выгрузке). */
  lead: string;
  imageSummer: SanityImage;
  imageWinter: SanityImage;
  /** Мобильные фото (< 768): отдельный кадр того же вида; alt — у основного фото. */
  imageSummerMobile: SanityImage;
  imageWinterMobile: SanityImage;
  /** Контур зданий на десктопном фото (в пикселях фото): из-за него выходит заголовок. На < 768 не используется. */
  skyline: { width: number; height: number; points: [number, number][] };
  cta: { label: string; href: string };
  presentationLabel: string;
  /** Видео презентации (YouTube): открывается в видео-попапе. Пусто — кнопка без действия. TODO: адрес от клиента. */
  presentationVideoUrl?: string;
  season: { prefix: string; toWinter: string; toSummer: string };
}

export interface StatsCard {
  _key: string;
  value: string;
  unit: string;
  text: string;
  chip: string;
  image: SanityImage;
}

export interface StatsBlock {
  _type: 'stats';
  _key: string;
  cards: StatsCard[];
}

export interface SeasonBlock {
  _type: 'season';
  _key: string;
  /** id секции: на него ссылаются пункты меню и футера (#season). */
  anchor: string;
  /** Строки заголовка: первая — приглушённая, остальные — основным цветом. */
  title: string[];
  text: string;
  /** Кадр видео; само видео открывается в видео-попапе (4.17). */
  poster: SanityImage;
  durationLabel: string;
  playLabel: string;
  /** Видео (YouTube) для видео-попапа, адрес из выгрузки; ссылка youtube.com превращается в режим без cookie (youtube-nocookie.com). */
  videoUrl: string;
}

export interface WorldsTitleLine {
  _key: string;
  before: string;
  /** Фото-«пилюля» внутри строки (декор). */
  image?: SanityImage;
  after?: string;
  /** Приглушённый цвет строки. */
  muted?: boolean;
}

export interface World {
  _key: string;
  overline: string;
  name: string;
  subtitle: string;
  /** Кнопка открывает окно «Детальніше» мира; href — запасной адрес без JS. */
  cta: { label: string; href: string };
  image: SanityImage;
  /** Окно «Детальніше» (выгрузка 2026-11-25, section-popups). */
  about: string;
  commissioning: string;
  access: string;
  features: { _key: string; label: string }[];
}

export interface WorldsBlock {
  _type: 'worlds';
  _key: string;
  anchor: string;
  title: WorldsTitleLine[];
  /** Ровно три мира: центральная карточка и две боковые. */
  worlds: World[];
}

export interface ModelStep {
  _key: string;
  title: string;
  text: string;
}

export interface ModelBlock {
  _type: 'model';
  _key: string;
  /** id секции (#model): на него ссылаются меню и футер. */
  anchor: string;
  /** Заголовок секции для экранных дикторов (визуально скрыт: в выгрузке заголовка нет). */
  title: string;
  /** Абзац над шагами: при прокрутке проявляется по словам. */
  text: string;
  /** Шаги модели; номер (01, 02…) ставится по порядку. */
  steps: ModelStep[];
}

export interface ApartmentsTitleLine {
  _key: string;
  text: string;
  /** Приглушённый цвет строки. */
  muted?: boolean;
}

/** Документ apartmentFormat: один на формат, на него ссылаются карточки Apartments и форма. */
export interface ApartmentFormat {
  _id: string;
  /** Название формата (Superior, Deluxe…) — не переводится. */
  name: string;
  /** Площадь, например «29,5–34,5 м²». */
  area: string;
  /** Попап апартамента (4.17): плашки, первая — залитая. */
  tags: { _key: string; label: string }[];
  /** Попап апартамента: текст «Опис». */
  description: string;
  /** Попап: фото после фото карточки Apartments; может быть пустым. */
  gallery: SanityImage[];
  /** Попап: последний слайд «Планування» (вписывается целиком, на белом). */
  plan: SanityImage;
}

export interface ApartmentItem {
  _key: string;
  format: ApartmentFormat;
  image: SanityImage;
}

export interface ApartmentsBlock {
  _type: 'apartments';
  _key: string;
  /** id секции (#apartamenty): на него ссылаются меню и футер. */
  anchor: string;
  title: ApartmentsTitleLine[];
  /** Подписи кнопок-стрелок для экранных дикторов. */
  prevLabel: string;
  nextLabel: string;
  /** Кнопка «Планування»: открывает попап апартамента (4.17). */
  planLabel: string;
  items: ApartmentItem[];
}

export interface FormTitleLine {
  _key: string;
  text: string;
  /** Продовження рядка приглушеним кольором. */
  mutedText?: string;
}

export interface FormBullet {
  _key: string;
  text: string;
  image: SanityImage;
}

export interface FormBlock {
  _type: 'form';
  _key: string;
  /** id секції (#forma): на нього посилаються кнопки «Зв'язатися». */
  anchor: string;
  title: FormTitleLine[];
  text: string;
  /** Що отримає інвестор: три картки з фото. */
  bullets: FormBullet[];
}

export interface LocationTitleLine {
  _key: string;
  text: string;
  /** Приглушённый цвет строки. */
  muted?: boolean;
}

/** Метка на карте: положение — в процентах от ширины и высоты карты. */
export interface LocationPin {
  _key: string;
  label: string;
  x: number;
  y: number;
  /** С какой стороны от точки подпись. */
  side: 'left' | 'right';
  /** Значок из набора: парковка, еда, отдых, отель. */
  icon: 'parking' | 'food' | 'leisure' | 'hotel';
}

export interface LocationBlock {
  _type: 'location';
  _key: string;
  /** id секции (#lokatsiya-google): на него ссылаются меню и футер. */
  anchor: string;
  title: LocationTitleLine[];
  text: string;
  mapLink: { label: string; href: string };
  /** Карта-иллюстрация: по её размеру строится кадр и проценты меток. */
  map: SanityImage;
  pins: LocationPin[];
  /** Иконки категорий меток из админки; пусто — иконки из кода. */
  icons?: Partial<Record<LocationPin['icon'], IconRef>>;
  /** Метка курорта: точка с логотипом, подпись и карточка при наведении. */
  resort: {
    x: number;
    y: number;
    label: string;
    card: {
      image: SanityImage;
      badge: string;
      title: string;
      subtitle: string;
      facts: { _key: string; value: string; label: string }[];
      chips: { _key: string; text: string }[];
    };
  };
}

export interface InfrastructureItem {
  _key: string;
  /** Заголовок карточки; он же — заголовок плашки с подробностями. */
  title: string;
  /** Строка под заголовком на фото. */
  lead: string;
  /** Подробности: плашка при наведении (десктоп) или по кнопке «i» (телефон, сенсор). */
  text: string;
  image: SanityImage;
}

export interface InfrastructureBlock {
  _type: 'infrastructure';
  _key: string;
  /** id секции (#infrastruktura): на него ссылаются меню и футер. */
  anchor: string;
  /** Строки заголовка; mutedText — приглушённое окончание строки. */
  title: { _key: string; text: string; mutedText?: string }[];
  /** Подпись кнопки «i» для экранных дикторов. */
  moreLabel: string;
  /** Номер карточки (01, 02…) ставится по порядку. */
  items: InfrastructureItem[];
}

export interface NumbersTitleLine { _key: string; text: string; muted?: boolean }

export interface NumbersCalcFormat {
  _key: string;
  /** Формат апартамента (название и диапазон площади — из документа формата). */
  format: ApartmentFormat;
  /** Площадь для расчёта, м². */
  area: number;
  /** Годовая доходность, %. */
  yieldPercent: number;
}

export interface NumbersCalcPayment {
  _key: string;
  title: string;
  note: string;
  /** Первый взнос, % цены (100 — оплата сразу). */
  firstPercent: number;
  /** Срок рассрочки, мес. (0 — без рассрочки). */
  months: number;
  /** Выбран при загрузке страницы. */
  isDefault?: boolean;
}

export interface NumbersCalc {
  title: NumbersTitleLine[];
  formatLabel: string;
  paymentLabel: string;
  /** Первый формат выбран при загрузке страницы. */
  formats: NumbersCalcFormat[];
  payments: NumbersCalcPayment[];
  pricePerM2: number;
  areaLabel: string;
  areaUnit: string;
  priceM2Label: string;
  rentLabel: string;
  rentValue: string;
  rentUnit: string;
  /** Знак валюты перед суммой. */
  currency: string;
  priceLabel: string;
  yieldLabel: string;
  firstLabel: string;
  monthLabel: string;
  /** Что показать в «Щомісячний платіж» при оплате сразу. */
  noMonthly: string;
  incomeLabel: string;
  paybackLabel: string;
  /** {n} — срок окупаемости, лет. */
  paybackFormat: string;
  chartTitle: string;
  /** {n} — год окупаемости. */
  breakEvenFormat: string;
  /** Сколько лет на графике. */
  years: number;
  axisStart: string;
  axisEnd: string;
  legendBefore: string;
  legendAfter: string;
  cta: { label: string; href: string };
}

export interface NumbersBlock {
  _type: 'numbers';
  _key: string;
  /** id секции (#cyfry-2). */
  anchor: string;
  title: NumbersTitleLine[];
  yieldCard: { label: string; value: string };
  paybackCard: { label: string; value: string; unit: string; pointLabel: string; start: string; point: string; end: string };
  paymentCard: { label: string; value: string; months: string; monthsLabel: string; steps: { _key: string; title: string; text: string }[] };
  /** Панорама: оборот карточек и фон калькулятора. */
  panorama: SanityImage;
  calc: NumbersCalc;
}


export interface InvestorServiceTitleLine { _key: string; text: string; muted?: boolean }
export interface InvestorServiceItem { _key: string; title: string; text: string }
/** Число мока дашборда: при появлении считается от 0. */
export interface DashboardKpi { _key: string; label: string; value: number; prefix?: string; suffix?: string; note: string }
export interface InvestorDashboard {
  /** Описание мока для скринридеров (мок — role="img"). */
  ariaLabel: string;
  brand: string;
  /** Пункты меню мока; первый — активный. */
  nav: { _key: string; label: string }[];
  unit: string;
  title: string;
  status: string;
  kpis: DashboardKpi[];
  chartTitle: string;
  chartPeriod: string;
  /** Точки графика: высота от верха, 0–100 (меньше — выше), равный шаг по месяцам. */
  chartPoints: number[];
  chartAxis: { _key: string; label: string }[];
  reportsTitle: string;
  reports: { _key: string; label: string; tag: string }[];
  phone: {
    payoutLabel: string; payout: number; payoutPrefix?: string;
    /** Процент для кольца, 0–100. */
    occupancy: number; occupancyLabel: string;
    stays: { _key: string; dates: string; tag: string }[];
  };
}
export interface InvestorServiceBlock {
  _type: 'investorService';
  _key: string;
  /** id секции (#servis). */
  anchor: string;
  title: InvestorServiceTitleLine[];
  lead: string;
  /** Подпись под ноутбуком (сервис 01). */
  feature: { title: string; text: string };
  /** Сервисы 02–07: первые три — левая колонка, остальные — правая. */
  services: InvestorServiceItem[];
  dashboard: InvestorDashboard;
}

export interface ConstructionUpdate {
  _key: string;
  /** Дата отчёта (YYYY-MM-DD): по ней — подпись месяца и порядок. */
  date: string;
  /** Черга (WIND, ROCK, SUN); нет — отчёт по всему курорту, плашки нет. */
  queue?: string;
  title: string;
  /** Абзац под заголовком; может отсутствовать (отчёт — заголовок и список работ). */
  text?: string;
  slides: (SanityImage & { _key: string })[];
  /** Дрон-видео: длительность для кнопки; файл — TODO (попап 4.17). */
  video?: { duration: string; file?: unknown };
  works: { _key: string; text: string }[];
}
export interface ConstructionBlock {
  _type: 'construction';
  _key: string;
  /** id секции (#budivnytstvo). */
  anchor: string;
  title: string;
  rowPrevLabel: string;
  rowNextLabel: string;
  photoPrevLabel: string;
  photoNextLabel: string;
  videoLabel: string;
  videoAriaLabel: string;
  /** Сколько последних отчётов показывать и не старше скольких дней (выгрузка: 3 и 183). */
  maxItems: number;
  maxAgeDays: number;
  updates: ConstructionUpdate[];
  /** Карточка «Всі» — ссылка на страницу архива (4.18); адрес — маршрут сайта (lib/routes.ts), не контент. */
  archive: { title: string; text: string; ariaLabel: string };
}

export interface TeamStat { _key: string; value?: string; label: string }
export interface TeamMember {
  _key: string;
  /** Роль: подпись на вкладке и заголовок панели. */
  role: string;
  company: string;
  /** Логотип (SVG из выгрузки); alt — название компании. */
  logo: SanityImage;
  photo: SanityImage;
  text: string;
  stats: TeamStat[];
  quote: { text: string; name: string; position: string; photo: SanityImage };
}
export interface TeamBlock {
  _type: 'team';
  _key: string;
  /** id секции (#komanda). */
  anchor: string;
  title: string;
  subtitle: string;
  members: TeamMember[];
}

export interface FormFinalBlock {
  _type: 'formFinal';
  _key: string;
  /** id секции (#forma-final): на него ведёт кнопка FAQ «Поставити питання». */
  anchor: string;
  title: FormTitleLine[];
  text: string;
  bullets: FormBullet[];
  /** Вопрос о цели инвестиции и варианты (value — техническое значение для заявки). */
  goalLabel: string;
  goals: { _key: string; value: string; label: string }[];
  contactLegend: string;
  contactOptions: { _key: string; value: string; label: string }[];
  submitLabel: string;
  /** Подпись рядом с кнопкой. */
  note: string;
}

export interface FaqTitleLine { _key: string; text: string; muted?: boolean }
export interface FaqDoc {
  _key: string;
  /** Документ сайта: ссылка ведёт на его страницу (в новой вкладке). */
  document: DocumentLink;
  href: string;
  /** Мітка на плашке («Дозвіл»). */
  format?: string;
  /** Другое название на плашке; пусто — название документа. */
  title?: string;
  /** Подпись под названием (номер, дата из документа). */
  note?: string;
}
export interface FaqItem {
  _key: string;
  question: string;
  answer: string;
  /** Плашка с цифрой под ответом — видна только на <900, как в выгрузке. */
}
export interface FaqBlock {
  _type: 'faq';
  _key: string;
  /** id секции (#faq): на него ведут меню и футер. */
  anchor: string;
  title: FaqTitleLine[];
  docsTitle: string;
  docs: FaqDoc[];
  ctaTitle: string;
  ctaText: string;
  cta: { label: string; href: string };
  items: FaqItem[];
}

/** Строка заголовка блоков ukraine-bukovel: muted — приглушённым цветом. */
export interface WhyTitleLine { _key: string; text: string; muted?: boolean }

/** «Переваги інвестування в Україну» (выгрузка 2026-11-25, ukraine-bukovel). */
export interface WhyUkraineBlock {
  _type: 'whyUkraine';
  _key: string;
  anchor: string;
  title: WhyTitleLine[];
  lead: string;
  cards: {
    _key: string;
    value?: string;
    prefix?: string;
    unit?: string;
    title: string;
    text: string;
    visual?: 'none' | 'bar' | 'stars';
    barPercent?: number;
    dark?: boolean;
  }[];
}

/** Фото на всю ширину между блоками: верх и низ растворяются в фоне (статичная маска). */
export interface PhotoBandBlock {
  _type: 'photoBand';
  _key: string;
  image: SanityImage;
}

/** «Буковель. Сформований попит упродовж року». */
export interface WhyBukovelBlock {
  _type: 'whyBukovel';
  _key: string;
  anchor: string;
  title: WhyTitleLine[];
  lead: string;
  rows: { _key: string; value: string; unit?: string; title: string; text: string }[];
}

export type LandingBlock = HeroBlock | StatsBlock | WhyUkraineBlock | PhotoBandBlock | WhyBukovelBlock | SeasonBlock | WorldsBlock | ModelBlock | ApartmentsBlock | FormBlock | LocationBlock | InfrastructureBlock | NumbersBlock | InvestorServiceBlock | ConstructionBlock | TeamBlock | FaqBlock | FormFinalBlock;

export async function getSiteSettings(lang: string): Promise<SiteSettings> {
  return linkDocuments(localize<SiteSettings>(deref(source.siteSettings), lang, 'siteSettings'), lang);
}

export async function getLanding(lang: string): Promise<{ blocks: LandingBlock[] }> {
  const landing = linkDocuments(localize<{ blocks: (LandingBlock & { languages?: string[] })[] }>(deref(source.landing), lang, 'landing'), lang);
  // «Мови, на яких показувати блок»: пусто — на всех языках
  const blocks = landing.blocks
    .filter((b) => !b.languages?.length || b.languages.includes(lang))
    .map(({ languages: _, ...b }) => b as LandingBlock);
  return { ...landing, blocks };
}

/** Документы сайта на языке lang (страницы /<slug>/, /dokumenty/<slug>/; другие языки — с приставкой /en/). */
export async function getLegalDocuments(lang: string): Promise<LegalDocument[]> {
  return (source.legalDocuments as { _id: string }[]).map((d) => localize<LegalDocument>(d, lang, d._id));
}

/*
 * Значения, выбранные в форме, уходят в заявку (Telegram, CRM) по-украински при любом языке
 * страницы (docs/LEADS.md). У варианта — атрибут data-uk с украинской подписью; скрипт формы
 * отправляет его. На украинской странице атрибута нет: подпись уже украинская.
 */
export const getSiteSettingsUk = () => getSiteSettings(defaultLanguage);

/** Тот же блок лендинга на основном языке (по _key). */
export async function getBlockUk<T extends { _key: string }>(block: T): Promise<T> {
  const { blocks } = await getLanding(defaultLanguage);
  return (blocks.find((b) => (b as { _key?: string })._key === block._key) as unknown as T) ?? block;
}

/** Украинская подпись для data-uk — только если отличается от показанной. */
export const ukIfDiffers = (shown: string, uk: string | undefined) => (uk && uk !== shown ? uk : undefined);

/** Площадь формата «29,5–34,5 м²» → числа для CRM (note_square_from/to). */
export function areaRange(area: string): { from?: string; to?: string } {
  const [from, to] = (area.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(',', '.'));
  return { from, to: to ?? from };
}
