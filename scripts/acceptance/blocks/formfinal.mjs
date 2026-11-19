/**
 * Конфиг приёмки Final Form (4.15).
 *   in — секция у верха окна, всё проявилось.
 * Картка эксперта: на ≥901 — в левой панели (a), на ≤900 — под формой (b).
 * Шапка сайта и вкладка квиза скрыты с обеих сторон.
 */
const SEC = { exp: '#forma-final', ours: '#forma-final' };

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

const E = '#forma-final [data-hs=fgridf]';
const common = [
  ['section', SEC.exp, SEC.ours],
  ['info', `${E} > div:nth-child(1)`, '#forma-final .form__info'],
  ['title', '#forma-final h2', '#forma-final .form__title', 'text'],
  ['text', `${E} > div:nth-child(1) > p`, '#forma-final .form__text', 'text'],
  ['bullets', '#forma-final [data-hs=fbuls]', '#forma-final .form__bullets'],
  ['bullet 1', '#forma-final [data-hs=fbul]:nth-child(1)', '#forma-final .form__bullet:nth-child(1)'],
  ['bullet 1 image', '#forma-final [data-hs=fbul]:nth-child(1) > span', '#forma-final .form__bullet:nth-child(1) .form__bullet-media'],
  ['bullet 1 text', '#forma-final [data-hs=fbul]:nth-child(1) > span:nth-child(2) > span', '#forma-final .form__bullet:nth-child(1) .form__bullet-text', 'text'],
  ['bullet 3', '#forma-final [data-hs=fbul]:nth-child(3)', '#forma-final .form__bullet:nth-child(3)'],
  ['panel', `${E} > div:nth-child(2)`, '#forma-final .form__panel'],
  ['label name', '#forma-final form label:nth-of-type(1) > span', '#forma-final .form__field:nth-child(1) .form__label', 'text'],
  ['input name', '#forma-final [name=name]', '#forma-final [name=name]'],
  ['input phone', '#forma-final [name=phone]', '#forma-final [name=phone]'],
  ['select', '#forma-final [name=goal]', '#forma-final [name=goal]'],
  ['legend', '#forma-final legend', '#forma-final legend', 'text'],
  ['chip 1', '#forma-final [data-hs=fchip]:nth-child(1)', '#forma-final .form__chip:nth-child(1)'],
  ['chip 4', '#forma-final [data-hs=fchip]:nth-child(4)', '#forma-final .form__chip:nth-child(4)'],
  ['note', '#forma-final form > div > p', '#forma-final .form__note', 'text'],
  ['submit', '#forma-final [data-hs=fsubmit]', '#forma-final .form__submit'],
];
const mgr = (v) => [
  ['manager', `#forma-final [data-fmgr=${v}]`, `#forma-final .form__manager--${v}`],
  ['manager photo', `#forma-final [data-fmgr=${v}] img`, `#forma-final .form__manager--${v} .manager__photo`],
  ['manager name', `#forma-final [data-fmgr=${v}] div span:nth-child(1)`, `#forma-final .form__manager--${v} .manager__name`, 'text'],
  ['manager phone', `#forma-final [data-fmgr=${v}] [data-hs=fphone]`, `#forma-final .form__manager--${v} .manager__phone`, 'text'],
  ['manager msg 1', `#forma-final [data-fmgr=${v}] [data-hs=fmsg]`, `#forma-final .form__manager--${v} .manager__msg`],
];

export default {
  neutralize: {
    exp: 'header,a[aria-label*="квіз"]{visibility:hidden!important}',
    ours: '.site-header{visibility:hidden!important}',
  },
  settle: 1200,
  root: '#forma-final',
  states: {
    in: { minWidth: 901, prepare: top, elements: [...common, ...mgr('a')] },
    'in-col': { maxWidth: 900, prepare: top, elements: [...common, ...mgr('b')] },
  },
};
