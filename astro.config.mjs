// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import { languages, defaultLanguage } from './src/lib/languages.ts';

export default defineConfig({
  output: 'static',
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
  trailingSlash: 'always',
});
