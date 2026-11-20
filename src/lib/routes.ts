/** Адреса страниц сайта: маршруты задаёт код (src/pages), не контент. */
export const homePath = (lang: string) => `/${lang}/`;
/** Архив хода строительства (4.18). */
export const archivePath = (lang: string) => `/${lang}/archive/`;
/** Страница «Дякуємо»: сюда ведёт форма заявки после отправки. */
export const thanksPath = (lang: string) => `/${lang}/thanks/`;

/**
 * Ссылка из общего контента (меню, футер) на внутренней странице: якорь главной «#x» → «/uk/#x»,
 * «#top» → «/uk/». На главной base не задан — ссылка как есть.
 */
export function onPage(href: string, base?: string): string {
  if (!base || !href.startsWith('#')) return href;
  return href === '#top' || href === '#' ? base : `${base}${href}`;
}

/** Документ сайта (Sanity «Документ»): категория задаёт раздел, slug — адрес, общий для всех языков. */
export interface DocumentRoute { slug: string; category: 'policy' | 'construction' }

/** Путь документа без языка: политика — «<slug>/», документы стройки — «dokumenty/<slug>/». */
export const documentSubpath = (doc: DocumentRoute) => (doc.category === 'construction' ? `dokumenty/${doc.slug}/` : `${doc.slug}/`);

/** Страница документа: /uk/polityka-konfidentsiinosti/, /en/dokumenty/dozvil-na-budivelni-roboty/. */
export const documentPath = (lang: string, doc: DocumentRoute) => `/${lang}/${documentSubpath(doc)}`;
