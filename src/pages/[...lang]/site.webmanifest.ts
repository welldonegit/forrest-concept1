/**
 * Манифест для «Добавить на главный экран»: /site.webmanifest, /en/site.webmanifest.
 * Название — siteSettings.seo.siteName (Sanity), иконки — public/ (scripts/make-icons.sh),
 * цвета — токены --spruce и --air из src/styles/tokens.css (единственный источник цветов).
 */
import type { APIRoute } from 'astro';
import tokens from '../../styles/tokens.css?raw';
import { getSiteSettings } from '../../lib/content';
import { homePath, langOf, langPaths } from '../../lib/routes';

export function getStaticPaths() {
  return langPaths();
}

const token = (name: string) => {
  const m = tokens.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})`));
  if (!m) throw new Error(`tokens.css: нет цвета --${name}`);
  return m[1];
};

export const GET: APIRoute = async ({ params }) => {
  const lang = langOf(params.lang);
  const name = (await getSiteSettings(lang)).seo.siteName?.trim() || undefined;
  const manifest = {
    name, short_name: name, lang, start_url: homePath(lang), scope: '/', display: 'browser',
    theme_color: token('spruce'), background_color: token('air'),
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
  return new Response(JSON.stringify(manifest), { headers: { 'content-type': 'application/manifest+json' } });
};
