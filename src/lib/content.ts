/**
 * Доступ к контенту. Компоненты получают данные только отсюда.
 *
 * Сейчас источник — временные фикстуры в форме Sanity (src/content-fixtures/),
 * на этапе 3 здесь появятся запросы к Sanity; интерфейс функций не меняется.
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
  const key = `${lang}:${path}`;
  if (!reported.has(key)) {
    reported.add(key);
    console.warn(`[i18n] нет перевода «${lang}»: ${path} → подставлен «${defaultLanguage}»`);
  }
  return byLang(defaultLanguage);
}

/* ---------- Ссылки на документы ---------- */

// Документы, на которые ссылаются другие (как reference в Sanity): форматы апартаментов
// — одни данные для карточек Apartments и списка в форме.
const documents = new Map<string, unknown>(
  (apartmentFormatsFixture as { _id: string }[]).map((d) => [d._id, d]),
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

/* ---------- Фото ---------- */

// Только фото, на которые ссылаются фикстуры: всё, что попало в glob, Vite кладёт в сборку.
// Новый блок с фото до подключения Sanity — добавить файл в этот список.
// Источник — design-export/assets/photos (Р8); фото карточек Stats есть только в корне выгрузки.
const fixturePhotos = import.meta.glob<ImageMetadata>(
  [
    '/design-export/assets/photos/hero-summer.jpg',
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
    // логотипы партнёров (SVG из выгрузки, без изменений)
    '/design-export/assets/logos/perspektyva-group-dark.svg',
    '/design-export/assets/logos/filimonov-kashirina-architects-dark.svg',
    '/design-export/assets/logos/maestro-hotel-management-dark.svg',
    '/design-export/assets/logos/makhno-studio-white-dark.svg',
  ],
  { import: 'default' },
);

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

export async function resolveImage(img: SanityImage): Promise<ResolvedImage> {
  const ref = img.asset._ref;
  if (!ref.startsWith('fixture:')) throw new Error(`Фото из Sanity ещё не подключены: ${ref}`);
  const file = ref.slice('fixture:'.length);
  const load = fixturePhotos[`/design-export/assets/photos/${file}`] ?? fixturePhotos[`/design-export/${file}`];
  if (!load) throw new Error(`Фото нет в списке fixturePhotos (content.ts): ${file}`);
  const x = Math.round((img.hotspot?.x ?? 0.5) * 100);
  const y = Math.round((img.hotspot?.y ?? 0.5) * 100);
  if (!img.decorative && !img.alt) throw new Error(`Нет alt у фото ${file}: заполни alt или отметь «декоративне фото»`);
  return { src: await load(), alt: img.decorative ? '' : (img.alt ?? ''), position: `${x}% ${y}%` };
}

/* ---------- Документы ---------- */

export interface Link { _key: string; href: string; label: string }
export interface SocialLink { _key: string; network: string; label: string; url: string }

export interface FooterGroup { _key: string; title: string; links: Link[] }

export interface SiteSettings {
  seo: { title: string; description: string };
  ui: { skipLink: string; swipeHint: string; closeLabel: string };
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
    socialsLabel: string;
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
    /** Тексты ошибок: пустое обязательное поле, неверный телефон, Turnstile не пройден, ошибка отправки. */
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
  /** Кадр видео; само видео открывается в попапе (4.17). */
  poster: SanityImage;
  durationLabel: string;
  playLabel: string;
  /** TODO(4.17): видео-попап. Адрес из выгрузки (YouTube, без cookies). */
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
  cta: { label: string; href: string };
  image: SanityImage;
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
  /** Кнопка «Планування». TODO(4.17): открывает попап планировок. */
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
  /** Черга (WIND, ROCK, SUN). */
  queue: string;
  title: string;
  text: string;
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
  /** Карточка «Всі» — ссылка на архив (4.18). */
  archive: { title: string; text: string; ariaLabel: string; href: string };
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

export type LandingBlock = HeroBlock | StatsBlock | SeasonBlock | WorldsBlock | ModelBlock | ApartmentsBlock | FormBlock | LocationBlock | InfrastructureBlock | NumbersBlock | InvestorServiceBlock | ConstructionBlock | TeamBlock;

export async function getSiteSettings(lang: string): Promise<SiteSettings> {
  return localize<SiteSettings>(deref(siteSettingsFixture), lang, 'siteSettings');
}

export async function getLanding(lang: string): Promise<{ blocks: LandingBlock[] }> {
  return localize<{ blocks: LandingBlock[] }>(deref(landingFixture), lang, 'landing');
}
