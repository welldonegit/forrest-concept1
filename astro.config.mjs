// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import { languages, defaultLanguage } from './src/lib/languages.ts';
import indexing from './src/integrations/indexing.ts';
import sanityContent from './src/integrations/sanity.ts';

export default defineConfig({
  output: 'static',
  // Сессии Astro не используются: без них адаптер не требует хранилища KV.
  session: false,
  // sanityContent — первым: снимок контента и оригиналы фото нужны до старта Vite.
  integrations: [sanityContent(), indexing()],
  adapter: cloudflare({
    // Фото обрабатываются при сборке (sharp → AVIF), рантайм не трогает картинки.
    imageService: 'compile',
    prerenderEnvironment: 'node',
  }),
  i18n: {
    locales: languages.map((l) => l.id),
    defaultLocale: defaultLanguage,
    routing: { prefixDefaultLocale: true, redirectToDefaultLocale: false },
  },
  image: {
    // Фото из Sanity скачиваются при сборке; в рантайме внешних запросов нет.
    layout: 'constrained',
  },
  build: { format: 'directory' },
  vite: {
    // Источник контента: sanity (по умолчанию) | fixtures — константа сборки (src/lib/content.ts).
    define: { __CONTENT_SOURCE__: JSON.stringify(process.env.CONTENT_SOURCE ?? 'sanity') },
  },
  // Дев-сервер в контейнере: слушать все адреса IPv4 — иначе Astro садится на [::1],
  // и проброс порта VS Code (идёт на 127.0.0.1) страницу не открывает.
  server: { host: '0.0.0.0', port: 4321 },
  trailingSlash: 'always',
});
