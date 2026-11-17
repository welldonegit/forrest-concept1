/**
 * Конфиг приёмки Stats (4.2): карточки после появления и наведение на первую карточку.
 * Секция прокручивается к верху окна; ждём конец анимации появления (~3.5s).
 */
const SEC = { exp: 'section[data-screen-label=Stats]', ours: '.stats' };
const CARD1 = { exp: '[data-card]', ours: '.stats__card' };

async function scrollTo(page, side) {
  await page.evaluate((sel) => document.querySelector(sel).scrollIntoView({ block: 'start', behavior: 'instant' }), SEC[side]);
  await page.waitForTimeout(3600);
}
const card = (n) => [
  [`card ${n}`, `[data-card]:nth-child(${n})`, `.stats__card:nth-child(${n})`],
  [`card ${n} value`, `[data-card]:nth-child(${n}) [data-txt] p:first-child`, `.stats__card:nth-child(${n}) .stats__value`, 'text'],
  [`card ${n} text`, `[data-card]:nth-child(${n}) [data-txt] p:nth-child(2)`, `.stats__card:nth-child(${n}) .stats__text`, 'text'],
  [`card ${n} chip`, `[data-card]:nth-child(${n}) [data-txt] > span`, `.stats__card:nth-child(${n}) .stats__chip`],
];
const elements = [
  ['section', SEC.exp, SEC.ours],
  ...card(1), ...card(2), ...card(3), ...card(4),
  
];

export default {
  // всё после Stats скрыто: в выгрузке дальше Season, у нас пока Footer
  neutralize: {
    exp: 'a[aria-label*="квіз"],section[data-screen-label=Stats]~*{visibility:hidden!important}',
    ours: '.stats~*,.site-footer{visibility:hidden!important}',
  },
  settle: 1200,
  root: '.stats',
  states: {
    normal: { prepare: scrollTo, elements },
    'card-hover': {
      async prepare(page, side) {
        await scrollTo(page, side);
        await page.hover(CARD1[side]);
        await page.waitForTimeout(1500);
      },
      elements: card(1),
    },
  },
};
