/**
 * Конфиг приёмки Season (4.3): секция после появления (≈2.6s), кольцо-пульс скрыто
 * (фаза случайна). Шапка сайта и вкладка квиза скрыты с обеих сторон.
 */
const SEC = { exp: 'section[data-screen-label=Season]', ours: '.season' };

async function scrollTo(page, side) {
  await page.evaluate((sel) => document.querySelector(sel).scrollIntoView({ block: 'start', behavior: 'instant' }), SEC[side]);
  await page.waitForTimeout(4200);
}
const elements = [
  ['section', SEC.exp, SEC.ours],
  ['title', `${SEC.exp} h2`, '.season__title'],
  ['title line 1', `${SEC.exp} h2 > span:nth-child(1)`, '.season__line:nth-child(1)', 'text'],
  ['title line 2', `${SEC.exp} h2 > span:nth-child(2)`, '.season__line:nth-child(2)', 'text'],
  ['text', `${SEC.exp} p`, '.season__text', 'text'],
  ['media', `${SEC.exp} [data-clip]`, '.season__media'],
  ['chip', `${SEC.exp} [data-clip] span[data-rv]`, '.season__chip-face'],
  ['chip text', `${SEC.exp} [data-clip] span[data-rv]`, '.season__chip-face', 'text'],
  ['play', `${SEC.exp} button`, '.season__play'],
  ['play ring', `${SEC.exp} button > span:nth-child(2)`, '.season__ring:not(.season__ring--pulse)'],
];

export default {
  neutralize: {
    exp: `header,a[aria-label*="квіз"]{visibility:hidden!important}
      ${SEC.exp} button > span:first-child{visibility:hidden!important}`,
    ours: `.site-header{visibility:hidden!important}
      .season__ring--pulse{visibility:hidden!important}`,
  },
  settle: 1200,
  root: '.season',
  states: {
    normal: { prepare: scrollTo, elements },
  },
};
