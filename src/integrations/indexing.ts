// Индексация поисковиками — одна настройка: переменная сборки SITE_INDEXING.
// SITE_INDEXING=allow — боевой домен: robots.txt разрешает обход, заголовка noindex нет.
// Любое другое значение или её отсутствие — превью: robots.txt запрещает всё,
// каждый ответ статики получает X-Robots-Tag: noindex (через _headers Cloudflare).
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import type { AstroIntegration } from 'astro';

export default function indexing(): AstroIntegration {
  let site: URL | undefined;
  return {
    name: 'forrest-indexing',
    hooks: {
      'astro:config:done': ({ config }) => { site = config.site ? new URL(config.site) : undefined; },
      'astro:build:done': async ({ dir, logger }) => {
        const allow = process.env.SITE_INDEXING === 'allow';
        // Фрагменты попапов (/popup/…/, /en/popup/…/; 4.17) не индексируются никогда: это не страницы для посетителей.
        // Ссылка на карту сайта — всегда (integrations/sitemap.ts); на превью обход всё равно запрещён.
        const sitemapLine = site ? `\nSitemap: ${new URL('/sitemap.xml', site).href}\n` : '';
        const robots = (allow ? 'User-agent: *\nDisallow: /popup/\nDisallow: /*/popup/\nAllow: /\n' : 'User-agent: *\nDisallow: /\n') + sitemapLine;
        await writeFile(new URL('robots.txt', dir), robots);
        const headers = new URL('_headers', dir);
        const current = await readFile(headers, 'utf8').catch(() => '');
        // Страница «Дякуємо» (/thanks/, /en/thanks/) — тоже noindex: на неё попадают только после заявки.
        const rule = allow
          ? ['/popup/*', '/*/popup/*', '/thanks/*', '/*/thanks/*'].map((p) => `${p}\n  X-Robots-Tag: noindex, nofollow\n`).join('')
          : '/*\n  X-Robots-Tag: noindex, nofollow\n';
        await appendFile(headers, (current && !current.endsWith('\n') ? '\n' : '') + rule);
        logger.info(allow ? 'индексация разрешена (SITE_INDEXING=allow)' : 'превью: noindex и Disallow в robots.txt');
      },
    },
  };
}
