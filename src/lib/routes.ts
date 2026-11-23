/**
 * Адреса страниц сайта: маршруты задаёт код (src/pages), не контент.
 * Основной язык (uk) живёт в корне: «/», «/archive/»; остальные — с приставкой: «/en/», «/en/archive/».
 * Старые адреса /uk/… → 301 на те же без /uk/ (public/_redirects).
 */
import { defaultLanguage, languageIds } from './languages';

/** Приставка языка в адресе: «» у основного, «/en» у остальных. */
export const langPrefix = (lang: string) => (lang === defaultLanguage ? '' : `/${lang}`);

/** Параметр [...lang] страниц src/pages/[...lang]/: undefined у основного языка (адрес без приставки). */
export const langParam = (lang: string) => (lang === defaultLanguage ? undefined : lang);

/** Язык страницы из параметра [...lang]. */
export function langOf(param: string | undefined): string {
  const lang = param ?? defaultLanguage;
  if (!languageIds.includes(lang)) throw new Error(`Неизвестный язык в адресе: ${lang}`);
  return lang;
}

/** Пути getStaticPaths для страниц src/pages/[...lang]/: по одному на язык. */
export const langPaths = () => languageIds.map((lang) => ({ params: { lang: langParam(lang) } }));

export const homePath = (lang: string) => `${langPrefix(lang)}/`;
/** Архив хода строительства (4.18). */
export const archivePath = (lang: string) => `${langPrefix(lang)}/archive/`;
/** Страница «Дякуємо»: сюда ведёт форма заявки после отправки. */
export const thanksPath = (lang: string) => `${langPrefix(lang)}/thanks/`;
/** Фрагмент попапа (4.17): грузится по первому нажатию. */
export const popupPath = (lang: string, name: string) => `${langPrefix(lang)}/popup/${name}/`;

/**
 * Ссылка из общего контента (меню, футер) на внутренней странице: якорь главной «#x» → «/#x» («/en/#x»),
 * «#top» → «/». На главной base не задан — ссылка как есть.
 */
export function onPage(href: string, base?: string): string {
  if (!base || !href.startsWith('#')) return href;
  return href === '#top' || href === '#' ? base : `${base}${href}`;
}

/** Документ сайта (Sanity «Документ»): категория задаёт раздел, slug — адрес, общий для всех языков. */
export interface DocumentRoute { slug: string; category: 'policy' | 'construction' }

/** Путь документа без языка: политика — «<slug>/», документы стройки — «dokumenty/<slug>/». */
export const documentSubpath = (doc: DocumentRoute) => (doc.category === 'construction' ? `dokumenty/${doc.slug}/` : `${doc.slug}/`);

/** Страница документа: /polityka-konfidentsiinosti/, /en/dokumenty/dozvil-na-budivelni-roboty/. */
export const documentPath = (lang: string, doc: DocumentRoute) => `${homePath(lang)}${documentSubpath(doc)}`;
