/**
 * Конфиг приёмки Apartments (4.6).
 *   in — секция у верха окна, карточки проявились; лента стоит на первой настоящей карточке
 *   (в обеих версиях слева и справа — копии карточек).
 * Шапка сайта и вкладка квиза скрыты с обеих сторон.
 */
const SEC = { exp: '#apartamenty', ours: '.apts' };
const card = (n, sub = '') => [
  `#apartamenty [data-apt]:not([data-clone]):nth-of-type(${n}) ${sub}`.trim(),
  `.apts__card:not([data-clone]):nth-of-type(${n}) ${sub}`.trim(),
];
// nth-of-type считает и копии (тоже article): номер первой настоящей = N + 1
const N = 5;
const first = (sub, oursSub = sub) => {
  const [e] = card(N + 1, sub);
  const [, o] = card(N + 1, oursSub);
  return [e, o];
};

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

const elements = [
  ['section', SEC.exp, SEC.ours],
  ['title', '#apartamenty h2', '.apts__title', 'text'],
  ['title line 2', '#apartamenty h2 > span:nth-child(2)', '.apts__mask:nth-child(2)', 'text'],
  ['prev', '#apartamenty [data-hs=anav][data-dir="-1"]', '.apts__arrow[data-apts-dir="-1"]'],
  ['next', '#apartamenty [data-hs=anav][data-dir="1"]', '.apts__arrow[data-apts-dir="1"]'],
  ['track', '#apartamenty [data-hs=atrack]', '.apts__track'],
  ['card 1', ...first('')],
  ['card 1 image', ...first('[data-hs=aimg]', '.apts__media')],
  ['card 1 name', ...first('h3', '.apts__name'), 'text'],
  ['card 1 area', ...first('h3 + div > span', '.apts__area'), 'text'],
  ['card 1 plan', ...first('[data-hs=aplan]', '.apts__plan')],
  ['card 2', ...card(N + 2)],
  ['swipe hint', '#apartamenty [data-swipe]', '.apts .swipe-hint'],
  ['bar', '#apartamenty [data-hs=abar]', '.apts__bar'],
  ['thumb', '#apartamenty [data-hs=aprog]', '.apts__thumb'],
];

export default {
  neutralize: {
    exp: 'header,a[aria-label*="квіз"]{visibility:hidden!important}',
    ours: '.site-header{visibility:hidden!important}',
  },
  settle: 1200,
  root: '.apts',
  states: {
    in: { prepare: top, elements },
  },
};
