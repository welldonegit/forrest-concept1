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
const fixturePhotos = import.meta.glob<ImageMetadata>(
  [
    '/design-export/assets/photos/hero-summer.jpg',
    '/design-export/assets/photos/hero-winter.jpg',
  ],
  { import: 'default' },
);

export interface SanityImage {
  asset: { _ref: string };
  hotspot?: { x: number; y: number };
  alt: string;
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
  return { src: await load(), alt: img.alt, position: `${x}% ${y}%` };
}

/* ---------- Документы ---------- */

export interface Link { _key: string; href: string; label: string }
export interface SocialLink { _key: string; network: string; label: string; url: string }

export interface SiteSettings {
  seo: { title: string; description: string };
  ui: { skipLink: string };
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
  /** Контур зданий на фото (в пикселях фото): из-за него выходит заголовок. */
  skyline: { width: number; height: number; points: [number, number][] };
  cta: { label: string; href: string };
  presentationLabel: string;
  season: { prefix: string; toWinter: string; toSummer: string };
}

export type LandingBlock = HeroBlock;

export async function getSiteSettings(lang: string): Promise<SiteSettings> {
  return localize<SiteSettings>(siteSettingsFixture, lang, 'siteSettings');
}

export async function getLanding(lang: string): Promise<{ blocks: LandingBlock[] }> {
  return localize<{ blocks: LandingBlock[] }>(landingFixture, lang, 'landing');
}
