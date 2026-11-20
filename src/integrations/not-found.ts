// Страница 404 для сервера статики Cloudflare (not_found_handling: 404-page).
// Astro при build.format: 'directory' пишет /{lang}/404/index.html; Cloudflare ищет ближайший
// 404.html вверх по пути. Переносим в /{lang}/404.html, основной язык — ещё и в /404.html.
import { access, copyFile, mkdir, rename, rm } from 'node:fs/promises';
import type { AstroIntegration } from 'astro';
import { languageIds, defaultLanguage } from '../lib/languages.ts';

export default function notFound(): AstroIntegration {
  return {
    name: 'forrest-not-found',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const built = await access(new URL(`${defaultLanguage}/404/index.html`, dir)).then(() => true, () => false);
        if (!built) {
          logger.warn('страница 404 не собрана: в Sanity не заполнено «Налаштування сайту» → «Сторінка 404»');
          return;
        }
        for (const lang of languageIds) {
          const from = new URL(`${lang}/404/index.html`, dir);
          const to = new URL(`${lang}/404.html`, dir);
          await mkdir(new URL(`${lang}/`, dir), { recursive: true });
          await rename(from, to);
          await rm(new URL(`${lang}/404/`, dir), { recursive: true });
          if (lang === defaultLanguage) await copyFile(to, new URL('404.html', dir));
        }
        logger.info(`404: ${languageIds.map((l) => `/${l}/404.html`).join(', ')}, /404.html (${defaultLanguage})`);
      },
    },
  };
}
