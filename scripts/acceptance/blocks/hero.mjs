/**
 * Конфиг приёмки Hero (4.1): зима (стартовое состояние), лето (после переключения),
 * ховер кнопки «Отримати фінмодель».
 * Бесконечные анимации кнопки сезона (кольца, «дыхание») на снимке выключены:
 * их фаза случайна и даёт шум в диффе. Боковая вкладка квиза выгрузки (4.17) скрыта.
 */
const QUIET = {
  exp: `[data-hs=hseason],[data-hs=hseason] *{animation:none!important}
    [data-hs=hseason]>span[aria-hidden]{visibility:hidden!important}
    a[aria-label*="квіз"]{visibility:hidden!important}`,
  ours: `.hero__season,.hero__season *{animation:none!important}
    .hero__ring{visibility:hidden!important}`,
};
const toggle = { exp: '[data-hs=hseason]', ours: '.hero__season' };
const cta = { exp: '[data-hs=hcont] a', ours: '.hero__cta' };

const elements = [
  ['frame', 'section[data-screen-label=Hero]', '.hero__frame'],
  ['title line 1', 'h1[data-hh] span:nth-child(1)', 'h1.hero__title .hero__line--dark', 'text'],
  ['title line 2', 'h1[data-hh] span:nth-child(2)', 'h1.hero__title .hero__line--light', 'text'],
  ['shade', '[data-hs=hshade]', '.hero__shade'],
  ['lead', '[data-hs=hcont] p', '.hero__lead', 'text'],
  ['cta', '[data-hs=hcont] a', '.hero__cta'],
  ['cta text', '[data-hs=hcont] a', '.hero__cta', 'text'],
  ['cta icon', '[data-hs=hcont] a > span', '.hero__cta-icon'],
  ['play icon', '[data-hs=hcont] button > span:first-child', '.hero__play-icon'],
  ['play text', '[data-hs=hcont] button > span:nth-child(2)', '.hero__play-label', 'text'],
  ['season', '[data-hs=hseason]', '.hero__season'],
  ['season text', '[data-hs=hseason] > span:last-child', '.hero__season-face > span:last-child', 'text'],
  ['season ring', '[data-hs=hseason]', '.hero__season-face'],
];

export default {
  neutralize: QUIET,
  settle: 4800,
  root: '.hero',
  states: {
    winter: { elements },
    summer: {
      async prepare(page, side) {
        await page.hover(toggle[side]);
        await page.waitForTimeout(600);
        await page.click(toggle[side]);
        await page.mouse.move(1, 1);
        await page.waitForTimeout(1800);
      },
      elements,
    },
    'cta-hover': {
      async prepare(page, side) {
        await page.hover(cta[side]);
        await page.waitForTimeout(600);
      },
      clip: ({ w, h }) => ({ x: 0, y: Math.max(0, h - 260), width: Math.min(w, 760), height: 260 }),
      elements: elements.filter(([n]) => n.startsWith('cta')),
    },
  },
};
