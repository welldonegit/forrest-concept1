/**
 * Конфиг приёмки Form (4.7).
 *   in — секция у верха окна, всё проявилось.
 * Картка эксперта: на ≥901 — в левой панели (a), на ≤900 — под формой (b).
 * Шапка сайта и вкладка квиза скрыты с обеих сторон.
 */
const SEC = { exp: '#forma', ours: '.form' };

// Дважды: блоки выше (колода Model на <768) меняют высоту, когда запускаются при прокрутке мимо них.
const top = async (page, side) => {
  for (const wait of [1500, 3500]) {
    await page.evaluate((sel) => {
      const s = document.querySelector(sel);
      scrollTo({ top: s.getBoundingClientRect().top + scrollY - 40, behavior: 'instant' });
    }, SEC[side]);
    await page.waitForTimeout(wait);
  }
};

const E = '#forma [data-hs=fgridf]';
const common = [
  ['section', SEC.exp, SEC.ours],
  ['info', `${E} > div:nth-child(1)`, '.form__info'],
  ['title', '#forma h2', '.form__title', 'text'],
  ['text', `${E} > div:nth-child(1) > p`, '.form__text', 'text'],
  ['bullets', '#forma [data-hs=fbuls]', '.form__bullets'],
  ['bullet 1', '#forma [data-hs=fbul]:nth-child(1)', '.form__bullet:nth-child(1)'],
  ['bullet 1 image', '#forma [data-hs=fbul]:nth-child(1) > span', '.form__bullet:nth-child(1) .form__bullet-media'],
  ['bullet 1 text', '#forma [data-hs=fbul]:nth-child(1) > span:nth-child(2) > span', '.form__bullet:nth-child(1) .form__bullet-text', 'text'],
  ['bullet 3', '#forma [data-hs=fbul]:nth-child(3)', '.form__bullet:nth-child(3)'],
  ['panel', `${E} > div:nth-child(2)`, '.form__panel'],
  ['label name', '#forma form label:nth-of-type(1) > span', '.form__field:nth-child(1) .form__label', 'text'],
  ['input name', '#forma [name=name]', '.form [name=name]'],
  ['input phone', '#forma [name=phone]', '.form [name=phone]'],
  ['select', '#forma [name=format]', '.form [name=format]'],
  ['legend', '#forma legend', '.form legend', 'text'],
  ['chip 1', '#forma [data-hs=fchip]:nth-child(1)', '.form__chip:nth-child(1)'],
  ['chip 4', '#forma [data-hs=fchip]:nth-child(4)', '.form__chip:nth-child(4)'],
  ['submit', '#forma [data-hs=fsubmit]', '.form__submit'],
];
const mgr = (v) => [
  ['manager', `#forma [data-fmgr=${v}]`, `.form__manager--${v}`],
  ['manager photo', `#forma [data-fmgr=${v}] img`, `.form__manager--${v} .manager__photo`],
  ['manager name', `#forma [data-fmgr=${v}] div span:nth-child(1)`, `.form__manager--${v} .manager__name`, 'text'],
  ['manager phone', `#forma [data-fmgr=${v}] [data-hs=fphone]`, `.form__manager--${v} .manager__phone`, 'text'],
  ['manager msg 1', `#forma [data-fmgr=${v}] [data-hs=fmsg]`, `.form__manager--${v} .manager__msg`],
];

export default {
  neutralize: {
    exp: 'header,a[aria-label*="квіз"]{visibility:hidden!important}',
    ours: '.site-header{visibility:hidden!important}',
  },
  settle: 1200,
  root: '.form',
  states: {
    in: { minWidth: 901, prepare: top, elements: [...common, ...mgr('a')] },
    'in-col': { maxWidth: 900, prepare: top, elements: [...common, ...mgr('b')] },
  },
};
