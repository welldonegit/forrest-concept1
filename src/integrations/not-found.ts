// Страница 404 для сервера статики Cloudflare (not_found_handling: 404-page).
// Astro при build.format: 'directory' пишет /404/index.html (основной язык) и /{lang}/404/index.html.
// Cloudflare ищет ближайший 404.html вверх по пути: /404.html — для адресов без приставки (украинская),
// /en/404.html — для /en/… . Переносим файлы туда.
import { access, mkdir, rename, rm } from 'node:fs/promises';
import type { AstroIntegration } from 'astro';
import { languageIds, defaultLanguage } from '../lib/languages.ts';
import { homePath } from '../lib/routes.ts';

export default function notFound(): AstroIntegration {
  return {
    name: 'forrest-not-found',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const home = (lang: string) => homePath(lang).slice(1); // «» или «en/»
        const built = await access(new URL(`${home(defaultLanguage)}404/index.html`, dir)).then(() => true, () => false);
        if (!built) {
          logger.warn('страница 404 не собрана: в Sanity не заполнено «Налаштування сайту» → «Сторінка 404»');
          return;
        }
        const out: string[] = [];
        for (const lang of languageIds) {
          const base = home(lang);
          if (base) await mkdir(new URL(base, dir), { recursive: true });
          await rename(new URL(`${base}404/index.html`, dir), new URL(`${base}404.html`, dir));
          await rm(new URL(`${base}404/`, dir), { recursive: true });
          out.push(`/${base}404.html (${lang})`);
        }
        logger.info(`404: ${out.join(', ')}`);
      },
    },
  };
}
