/**
 * Конфиг приёмки Footer (4.16): подвал целиком; на мобильном — ещё раскрытая первая колонка.
 */
const SEC = { exp: 'footer#kontakty', ours: '.site-footer' };
// Подвал — в конце страницы: прокручиваем до конца, он стоит у нижнего края окна в обоих случаях.
// Дважды: секции выше получают точную высоту, когда отрисуются (content-visibility, колода Model).
async function scrollTo(page) {
  for (const wait of [800, 800]) {
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
    await page.waitForTimeout(wait);
  }
}
const group = (i) => [
  [`group ${i + 1} title`, `[data-hs=fgroup][data-g="${i}"] [data-hs=ftitle] span`, `.site-footer__group:nth-child(${i + 2}) .text-footer-h5`, 'text'],
  [`group ${i + 1} link 1`, `[data-hs=fgroup][data-g="${i}"] [data-hs=fbody] a`, `.site-footer__group:nth-child(${i + 2}) .site-footer__link`, 'text'],
];
const elements = [
  ['footer', SEC.exp, SEC.ours],
  ['address', '[data-hs=faddr] p', '.site-footer__address-text', 'text'],
  ['phone', '[data-hs=faddr] a', '.site-footer__address .site-footer__link', 'text'],
  ...group(0), ...group(1), ...group(2), ...group(3),
  ['wordmark', 'footer [role=img][aria-label=FORREST]', '.site-footer__wordmark'],
  ['copyright', '[data-hs=legal] > span', '.site-footer__legal > span', 'text'],
  ['legal link 1', '[data-hs=legal] > div a', '.site-footer__legal-links a', 'text'],
  ['credit', '[data-hs=legal] > a', '.site-footer__credit'],
];

export default {
  neutralize: { exp: 'a[aria-label*="квіз"]{visibility:hidden!important}', ours: '' },
  settle: 1200,
  root: '.site-footer',
  states: {
    normal: { prepare: scrollTo, elements },
    'mobile-open': {
      maxWidth: 767,
      async prepare(page, side) {
        await scrollTo(page, side);
        await page.click(side === 'exp' ? '[data-hs=fgroup][data-g="0"] [data-hs=ftitle]' : '.site-footer__group:nth-child(2) .site-footer__toggle');
        await page.waitForTimeout(900);
      },
      elements,
    },
  },
};
