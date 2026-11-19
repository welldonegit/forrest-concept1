/**
 * Конфиг приёмки Numbers (4.10).
 *   cards — карточки показаны: ≥900 — начало сцены (p = 0), <900 — ряд карточек у верха окна.
 *   calc  — калькулятор: ≥900 — конец сцены (p = 1), <900 — панорама у верха окна.
 *   open  — калькулятор, открыт список форматов.
 * Шапка сайта и вкладка квиза скрыты с обеих сторон.
 */
const TRACK = { exp: '#cyfry-2 [data-n2track]', ours: '.nums__track' };
const STAGE = { exp: '#cyfry-2 [data-n2stage]', ours: '.nums__stage' };
const PANO = { exp: '#cyfry-2 [data-n2pano]', ours: '.nums__pano' };
const TRIG = { exp: '#cyfry-2 [data-tg=f]', ours: '.nums [data-calc-sel=format] [data-calc-trig]' };

const go = async (page, side, p, el) => {
  for (const wait of [1200, 3500]) {
    await page.evaluate(([t, e, pr]) => {
      if (innerWidth >= 900) {
        const tr = document.querySelector(t);
        scrollTo({ top: tr.getBoundingClientRect().top + scrollY + pr * (tr.offsetHeight - innerHeight), behavior: 'instant' });
      } else {
        scrollTo({ top: document.querySelector(e).getBoundingClientRect().top + scrollY - 40, behavior: 'instant' });
      }
    }, [TRACK[side], el[side], p]);
    await page.waitForTimeout(wait);
  }
};

const C = { exp: '#cyfry-2 [data-calc2]', ours: '.nums .calc' };
const card = (n) => [`#cyfry-2 [data-n2card]:nth-child(${n}) [data-ncard]`, `.nums__card:nth-child(${n}) .nums__front`];
const cardParts = (n) => {
  const [e, o] = card(n);
  return [
    [`card ${n}`, e, o],
    [`card ${n} chip`, `${e} [data-txt] > span:last-of-type`, `${o} .nums__chip`, 'text'],
    [`card ${n} value`, `${e} [data-txt] > p`, `${o} .nums__value`, 'text'],
  ];
};
const calcEls = [
  ['panel', `${C.exp} [data-hs=cpanel]`, `${C.ours} .calc__panel`],
  ['results', `${C.exp} [data-hs=cres]`, `${C.ours} .calc__res`],
  ['calc title', `${C.exp} h2`, `${C.ours} .calc__title`, 'text'],
  ['format trigger', TRIG.exp, TRIG.ours],
  ['payment trigger', '#cyfry-2 [data-tg=p]', '.nums [data-calc-sel=payment] [data-calc-trig]'],
  ['area', `${C.exp} [data-cv=area]`, `${C.ours} [data-calc-v=area]`, 'text'],
  ['price', `${C.exp} [data-cv=price]`, `${C.ours} [data-calc-v=price]`, 'text'],
  ['first', `${C.exp} [data-cv=first]`, `${C.ours} [data-calc-v=first]`, 'text'],
  ['payback', `${C.exp} [data-cv=pay]`, `${C.ours} [data-calc-v=payback]`, 'text'],
  ['bars', `${C.exp} [data-hs=cbars]`, `${C.ours} .calc__bars`],
  ['cta', `${C.exp} [data-hs=acta]`, `${C.ours} .calc__cta`],
];

export default {
  neutralize: {
    exp: 'header,a[aria-label*="квіз"]{visibility:hidden!important}',
    ours: '.site-header{visibility:hidden!important}',
  },
  settle: 600,
  root: '.nums',
  states: {
    cards: {
      prepare: (page, side) => go(page, side, 0, STAGE),
      elements: [
        ['title', '#cyfry-2 > h2', '.nums__title', 'text'],
        ...cardParts(1), ...cardParts(2), ...cardParts(3),
      ],
    },
    calc: {
      prepare: (page, side) => go(page, side, 1, PANO),
      elements: [['pano', PANO.exp, PANO.ours], ...calcEls],
    },
    open: {
      prepare: async (page, side) => {
        await go(page, side, 1, PANO);
        await page.evaluate((s) => document.querySelector(s).click(), TRIG[side]);
        await page.waitForTimeout(900);
      },
      elements: [
        ['format list', '#cyfry-2 [data-hs=cfmts]', '.nums [data-calc-sel=format] .calc__list'],
        ['option 2', '#cyfry-2 [data-hs=cfmts] [data-f="1"]', '.nums [data-calc-sel=format] li:nth-child(2) .calc__opt'],
      ],
    },
  },
};
