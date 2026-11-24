// Карта сайта (этап 6): /sitemap.xml со всеми языковыми версиями (xhtml:link hreflang + x-default).
// Страницы — из списка собранных: главная, архив, документы. Без «Дякуємо», 404, попапов и служебных файлов.
// Строится всегда; пока SITE_INDEXING не allow, robots.txt запрещает обход (integrations/indexing.ts).
import { writeFile } from 'node:fs/promises';
import type { AstroIntegration } from 'astro';
import { languageIds, defaultLanguage } from '../lib/languages.ts';
import { homePath } from '../lib/routes.ts';

/** Не страницы для поиска: путь после адреса главной. */
const EXCLUDE = [/^thanks\//, /^404/, /^popup\//, /\.[a-z]+$/];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export default function sitemap(): AstroIntegration {
  let site: URL | undefined;
  return {
    name: 'forrest-sitemap',
    hooks: {
      'astro:config:done': ({ config }) => { site = config.site ? new URL(config.site) : undefined; },
      'astro:build:done': async ({ dir, pages, logger }) => {
        if (!site) throw new Error('sitemap: в astro.config.mjs не задан site');
        // путь страницы → путь без приставки языка и язык
        const byPath = new Map<string, Set<string>>();
        for (const { pathname } of pages) {
          const p = `/${pathname}`.replace(/\/+/g, '/');
          const lang = languageIds.find((l) => l !== defaultLanguage && p.startsWith(homePath(l))) ?? defaultLanguage;
          const sub = p.slice(homePath(lang).length);
          if (EXCLUDE.some((re) => re.test(sub))) continue;
          if (!byPath.has(sub)) byPath.set(sub, new Set());
          byPath.get(sub)!.add(lang);
        }
        const abs = (lang: string, sub: string) => new URL(`${homePath(lang)}${sub}`, site).href;
        const urls: string[] = [];
        for (const [sub, langs] of [...byPath].sort(([a], [b]) => a.localeCompare(b))) {
          const alt = [...langs].map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${esc(abs(l, sub))}"/>`);
          if (langs.has(defaultLanguage)) alt.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${esc(abs(defaultLanguage, sub))}"/>`);
          for (const l of langs) urls.push(`  <url>\n    <loc>${esc(abs(l, sub))}</loc>\n${alt.join('\n')}\n  </url>`);
        }
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`;
        await writeFile(new URL('sitemap.xml', dir), xml);
        logger.info(`sitemap.xml: ${urls.length} адресов (${byPath.size} страниц × языки)`);
      },
    },
  };
}
