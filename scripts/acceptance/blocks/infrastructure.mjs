/**
 * Конфиг приёмки Infrastructure (4.9).
 *   in   — секция у верха окна, лента проявилась; лента остановлена в начале
 *          (scrollLeft = 1 и событие touchstart — пауза автопрокрутки 2.5 с с обеих сторон).
 *   open — <768: на первой карточке нажата кнопка «i» (плашка с подробностями).
 * Шапка сайта и вкладка квиза скрыты с обеих сторон.
 */
const SEC = { exp: '#infrastruktura', ours: '.infra' };
const TRACK = { exp: '#infrastruktura [data-hs=iscroll]', ours: '.infra__track' };
const INFO = { exp: '#infrastruktura [data-hs=irow] > article:nth-child(1) [data-hs=iinfo]', ours: '.infra__item:nth-child(1) [data-infra-info]' };

const top = async (page, side) => {
  for (const wait of [1500, 3500]) {
    await page.evaluate((sel) => {
      const s = document.querySelector(sel);
      scrollTo({ top: s.getBoundingClientRect().top + scrollY - 40, behavior: 'instant' });
    }, SEC[side]);
    await page.waitForTimeout(wait);
  }
  await page.evaluate((sel) => {
    const t = document.querySelector(sel);
    t.scrollLeft = 1;
    t.dispatchEvent(new Event('touchstart'));
  }, TRACK[side]);
};
const open = async (page, side) => {
  await top(page, side);
  await page.evaluate((sel) => document.querySelector(sel).click(), INFO[side]);
  await page.waitForTimeout(1000);
  await page.evaluate((sel) => document.querySelector(sel).dispatchEvent(new Event('touchstart')), TRACK[side]);
};

const card = (n) => [`#infrastruktura [data-hs=irow] > article:nth-child(${n})`, `.infra__item:nth-child(${n}) .infra__card`];
const parts = (n) => {
  const [e, o] = card(n);
  return [
    [`card ${n}`, e, o],
    [`card ${n} num`, `${e} > span:nth-child(1)`, `${o} .infra__num`, 'text'],
    [`card ${n} title`, `${e} h3`, `${o} .infra__card-title`, 'text'],
    [`card ${n} lead`, `${e} [data-hs=ihead] > span`, `${o} .infra__lead`, 'text'],
  ];
};

export default {
  neutralize: {
    exp: 'header,a[aria-label*="квіз"]{visibility:hidden!important}',
    ours: '.site-header{visibility:hidden!important}',
  },
  settle: 600,
  root: '.infra',
  states: {
    in: {
      prepare: top,
      elements: [
        ['section', SEC.exp, SEC.ours],
        ['title', '#infrastruktura h2', '.infra__title', 'text'],
        ['track', TRACK.exp, TRACK.ours],
        ...parts(1),
        ...parts(2),
      ],
    },
    open: {
      maxWidth: 767,
      prepare: open,
      elements: [
        ['card 1', ...card(1)],
        ['info', INFO.exp, INFO.ours],
        ['plate', `${card(1)[0]} [data-hs=iplate]`, `${card(1)[1]} .infra__plate`],
        ['plate text', `${card(1)[0]} [data-hs=iplate] > span:nth-child(2)`, `${card(1)[1]} .infra__plate-text`, 'text'],
      ],
    },
  },
};
