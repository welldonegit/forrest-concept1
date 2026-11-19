// Индексация поисковиками — одна настройка: переменная сборки SITE_INDEXING.
// SITE_INDEXING=allow — боевой домен: robots.txt разрешает обход, заголовка noindex нет.
// Любое другое значение или её отсутствие — превью: robots.txt запрещает всё,
// каждый ответ статики получает X-Robots-Tag: noindex (через _headers Cloudflare).
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import type { AstroIntegration } from 'astro';

export default function indexing(): AstroIntegration {
  return {
    name: 'forrest-indexing',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const allow = process.env.SITE_INDEXING === 'allow';
        const robots = allow ? 'User-agent: *\nAllow: /\n' : 'User-agent: *\nDisallow: /\n';
        await writeFile(new URL('robots.txt', dir), robots);
        if (!allow) {
          const headers = new URL('_headers', dir);
          const current = await readFile(headers, 'utf8').catch(() => '');
          const rule = '/*\n  X-Robots-Tag: noindex, nofollow\n';
          await appendFile(headers, (current && !current.endsWith('\n') ? '\n' : '') + rule);
        }
        logger.info(allow ? 'индексация разрешена (SITE_INDEXING=allow)' : 'превью: noindex и Disallow в robots.txt');
      },
    },
  };
}
