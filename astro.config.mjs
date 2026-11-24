// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import { languages, defaultLanguage } from './src/lib/languages.ts';
import indexing from './src/integrations/indexing.ts';
import notFound from './src/integrations/not-found.ts';
import sitemap from './src/integrations/sitemap.ts';
import { wranglerVar } from './src/integrations/wrangler-vars.ts';
import sanityContent from './src/integrations/sanity.ts';

export default defineConfig({
  output: 'static',
  // Основной адрес сайта: canonical, hreflang, og:url, sitemap.xml (этап 6). Превью тоже ссылается на него.
  site: 'https://forrestresort.com.ua',
  // Сессии Astro не используются: без них адаптер не требует хранилища KV.
  session: false,
  // sanityContent — первым: снимок контента и оригиналы фото нужны до старта Vite.
  integrations: [sanityContent(), indexing(), notFound(), sitemap()],
  adapter: cloudflare({
    // Фото обрабатываются при сборке (sharp → AVIF), рантайм не трогает картинки.
    imageService: 'compile',
    prerenderEnvironment: 'node',
  }),
  i18n: {
    locales: languages.map((l) => l.id),
    defaultLocale: defaultLanguage,
    // Основной язык — в корне («/», «/archive/»), остальные — с приставкой («/en/»). /uk/… → 301 (public/_redirects).
    routing: { prefixDefaultLocale: false },
  },
  image: {
    // Фото из Sanity скачиваются при сборке; в рантайме внешних запросов нет.
    layout: 'constrained',
  },
  build: { format: 'directory' },
  vite: {
    // Источник контента: sanity (по умолчанию) | fixtures — константа сборки (src/lib/content.ts).
    define: {
      __CONTENT_SOURCE__: JSON.stringify(process.env.CONTENT_SOURCE ?? 'sanity'),
      // Публичный ключ Turnstile: wrangler.jsonc → vars (или переменная окружения TURNSTILE_SITE_KEY).
      // Пусто — капча не настроена, форма показывает ошибку отправки.
      __TURNSTILE_SITE_KEY__: JSON.stringify(wranglerVar('TURNSTILE_SITE_KEY')),
      // Тестовый ключ для localhost — только из окружения сборки (npm run build:test), не из wrangler.jsonc:
      // в боевую сборку не попадает. На других адресах не используется (captcha.js).
      __TURNSTILE_LOCAL_SITE_KEY__: JSON.stringify(process.env.TURNSTILE_LOCAL_SITE_KEY?.trim() ?? ''),
    },
  },
  // Дев-сервер в контейнере: слушать все адреса IPv4 — иначе Astro садится на [::1],
  // и проброс порта VS Code (идёт на 127.0.0.1) страницу не открывает.
  server: { host: '0.0.0.0', port: 4321 },
  trailingSlash: 'always',
});
