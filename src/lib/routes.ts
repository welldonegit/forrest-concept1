/** Адреса страниц сайта: маршруты задаёт код (src/pages), не контент. */
export const homePath = (lang: string) => `/${lang}/`;
/** Архив хода строительства (4.18). */
export const archivePath = (lang: string) => `/${lang}/archive/`;

/**
 * Ссылка из общего контента (меню, футер) на внутренней странице: якорь главной «#x» → «/uk/#x»,
 * «#top» → «/uk/». На главной base не задан — ссылка как есть.
 */
export function onPage(href: string, base?: string): string {
  if (!base || !href.startsWith('#')) return href;
  return href === '#top' || href === '#' ? base : `${base}${href}`;
}
