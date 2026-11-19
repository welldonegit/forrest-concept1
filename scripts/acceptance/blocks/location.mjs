/**
 * Конфиг приёмки Location (4.8).
 *   in — секция у верха окна, текст и карта проявились (метки появляются до ~4 с).
 * Шапка сайта и вкладка квиза скрыты с обеих сторон.
 */
const SEC = { exp: '#lokatsiya-google', ours: '.loc' };

// Дважды: блоки выше (колода Model на <768) меняют высоту, когда запускаются при прокрутке мимо них.
const top = async (page, side) => {
  for (const wait of [1500, 4500]) {
    await page.evaluate((sel) => {
      const s = document.querySelector(sel);
      scrollTo({ top: s.getBoundingClientRect().top + scrollY - 40, behavior: 'instant' });
    }, SEC[side]);
    await page.waitForTimeout(wait);
  }
};

const M = '#lokatsiya-google [data-gmap]';
const pin = (n) => [`pin ${n}`, `${M} > div:nth-of-type(${n}) > span`, `.loc__pin:nth-child(${n}) .loc__pin-label`];

export default {
  neutralize: {
    exp: 'header,a[aria-label*="квіз"]{visibility:hidden!important}',
    ours: '.site-header{visibility:hidden!important}',
  },
  settle: 1200,
  root: '.loc',
  states: {
    in: {
      prepare: top,
      elements: [
        ['section', SEC.exp, SEC.ours],
        ['left', '#lokatsiya-google [data-gleft]', '.loc__left'],
        ['title', '#lokatsiya-google h2', '.loc__title', 'text'],
        ['text', '#lokatsiya-google [data-gleft] > p', '.loc__text', 'text'],
        ['link', '#lokatsiya-google [data-gleft] a', '.loc__link', 'text'],
        ['map', M, '.loc__map'],
        pin(1),
        pin(6),
        pin(13),
        pin(19),
        ['resort dot', '#lokatsiya-google [data-gdot]', '.loc__dot'],
        ['resort tag', '#lokatsiya-google [data-gtag]', '.loc__tag', 'text'],
      ],
    },
  },
};
