/**
 * Языки сайта — единственный список. Его читают Astro (маршруты, hreflang)
 * и Sanity Studio (sanity-plugin-internationalized-array).
 * Новый язык = одна строка в этом массиве + переводы в админке.
 *
 * id     — код языка в URL и в Sanity (BCP 47).
 * label  — подпись в переключателе языка (как в выгрузке: UA, EN).
 * name   — самоназвание языка в списке переключателя.
 * dir    — направление письма.
 * subset — подмножество шрифтов для предзагрузки (latin | cyrillic).
 */
export interface Language {
  id: string;
  label: string;
  name: string;
  dir: 'ltr' | 'rtl';
  subset: 'latin' | 'cyrillic';
}

export const languages: Language[] = [
  { id: 'uk', label: 'UA', name: 'Українська', dir: 'ltr', subset: 'cyrillic' },
  { id: 'en', label: 'EN', name: 'English', dir: 'ltr', subset: 'latin' },
];

/** Основной язык: живёт в корне «/» без приставки (src/lib/routes.ts), он же x-default и запасной перевод. */
export const defaultLanguage = 'uk';

export const languageIds = languages.map((l) => l.id);

export function getLanguage(id: string): Language {
  const lang = languages.find((l) => l.id === id);
  if (!lang) throw new Error(`Неизвестный язык: ${id}`);
  return lang;
}
