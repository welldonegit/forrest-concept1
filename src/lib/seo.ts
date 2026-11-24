/**
 * SEO страницы (этап 6): адреса для canonical/hreflang/og:url, картинка для соцсетей, структурированные данные.
 * Тексты (title, description, название сайта, картинка) — Sanity; адреса — src/lib/routes.ts; домен — astro.config.mjs → site.
 */
import { getImage } from 'astro:assets';
import { languages, defaultLanguage } from './languages';
import { homePath } from './routes';
import { getLanding, getSiteSettings, resolveImage, type HeroBlock, type SanityImage, type SiteSettings } from './content';

/** Размер картинки для соцсетей (Open Graph, Twitter): 1200×630. */
export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

/** Абсолютный адрес страницы на языке lang; path — путь после адреса главной («archive/», «dokumenty/…/»). */
export const pageUrl = (site: URL, lang: string, path = '') => new URL(`${homePath(lang)}${path}`, site).href;

/** hreflang: все языки и x-default (основной язык). Все страницы сайта есть на каждом языке. */
export function alternates(site: URL, path = '') {
  return [
    ...languages.map((l) => ({ hreflang: l.id, href: pageUrl(site, l.id, path) })),
    { hreflang: 'x-default', href: pageUrl(site, defaultLanguage, path) },
  ];
}

/**
 * Точка фокуса Sanity (проценты) → положение кадра для обрезки sharp при fit: cover.
 * sharp принимает только 9 положений, поэтому фокус приближённый: лево/центр/право × верх/центр/низ.
 */
function cropPosition(position: string): string {
  const [x, y] = position.split(' ').map((v) => Number.parseFloat(v));
  const h = x < 34 ? 'left' : x > 66 ? 'right' : '';
  const v = y < 34 ? 'top' : y > 66 ? 'bottom' : '';
  return [h, v].filter(Boolean).join(' ') || 'centre';
}

export interface OgImage { url: string; width: number; height: number; alt: string; type: string }

const ogCache = new Map<string, Promise<OgImage | undefined>>();

/**
 * Картинка для соцсетей: siteSettings.seo.ogImage, пусто — главное фото первого экрана (зимнее, оно видно первым).
 * Обрезается до 1200×630 по точке фокуса, JPEG (AVIF соцсети не показывают).
 */
export function ogImage(site: URL, lang: string): Promise<OgImage | undefined> {
  if (!ogCache.has(lang)) ogCache.set(lang, (async () => {
    const settings = await getSiteSettings(lang);
    let photo: SanityImage | undefined = settings.seo.ogImage?.asset ? settings.seo.ogImage : undefined;
    if (!photo) {
      const { blocks } = await getLanding(lang);
      photo = blocks.find((b): b is HeroBlock => b._type === 'hero')?.imageWinter;
    }
    if (!photo) return undefined;
    const img = await resolveImage(photo);
    const out = await getImage({
      src: img.src, width: OG_WIDTH, height: OG_HEIGHT, fit: 'cover', position: cropPosition(img.position), format: 'jpg', quality: 82,
    });
    return { url: new URL(out.src, site).href, width: OG_WIDTH, height: OG_HEIGHT, alt: img.alt, type: 'image/jpeg' };
  })());
  return ogCache.get(lang)!;
}

/** Адрес профиля соцсети годится для sameAs, только если ведёт на конкретный профиль, а не на корень сервиса. */
function isProfile(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.pathname.replace(/\/+$/, '') !== '';
  } catch {
    return false;
  }
}

/**
 * JSON-LD главной: организация, сайт и объект (жилой комплекс). Только данные из Sanity:
 * название сайта, описание главной, телефон и адрес из контактов, профили соцсетей, картинка для соцсетей.
 * Пустое — не выводится.
 */
export function structuredData(site: URL, lang: string, settings: SiteSettings, og: OgImage | undefined) {
  const name = settings.seo.siteName?.trim();
  if (!name) return undefined;
  const home = pageUrl(site, lang);
  const root = pageUrl(site, defaultLanguage);
  const phone = settings.contacts?.phoneHref?.replace(/^tel:/, '').trim();
  const address = settings.contacts?.address?.replace(/\s*\n\s*/g, ' ').trim();
  const sameAs = (settings.contacts?.socials ?? []).map((s) => s.url).filter(isProfile);
  const orgId = `${root}#organization`;
  const clean = (o: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '' && !(Array.isArray(v) && !v.length)));
  return {
    '@context': 'https://schema.org',
    '@graph': [
      clean({
        '@type': 'Organization', '@id': orgId, name, url: root,
        logo: new URL('/icon-512.png', site).href,
        telephone: phone, sameAs,
      }),
      clean({
        '@type': 'WebSite', '@id': `${root}#website`, name, url: home, inLanguage: lang, publisher: { '@id': orgId },
      }),
      clean({
        '@type': 'ApartmentComplex', '@id': `${root}#resort`, name, url: home,
        description: settings.seo.description, image: og?.url, address, telephone: phone,
      }),
    ],
  };
}
