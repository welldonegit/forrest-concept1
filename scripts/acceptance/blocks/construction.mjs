/**
 * Конфиг приёмки Construction B (4.12). Секция выгрузки — #budivnytstvo-2, у нас — .ct (#budivnytstvo).
 *   base — заголовок и первая карточка у верха окна.
 *   next — лента прокручена кнопкой «вперёд» на одну карточку.
 *   arch — <768: карточка «Всі» (лента в конце).
 * Шапка сайта и вкладка квиза скрыты с обеих сторон.
 */
const E = '#budivnytstvo-2';
const SEC = { exp: E, ours: '.ct' };
const ROW = { exp: `${E} [data-cb2row]`, ours: '.ct__row' };

const top = async (page, side, extra = 0) => {
  await page.evaluate(([s, e]) => {
    const el = document.querySelector(s);
    scrollTo({ top: el.getBoundingClientRect().top + scrollY - e, behavior: 'instant' });
  }, [SEC[side], extra]);
  await page.waitForTimeout(1200);
};
const item = (n) => [`${E} [data-cb2]:nth-of-type(${n})`, `.ct__item:nth-of-type(${n})`];
const parts = (n) => {
  const [e, o] = item(n);
  return [
    [`item ${n} month`, `${e} time`, `${o} .ct__month`, 'text'],
    [`item ${n} queue`, `${e} [data-cb2h] > span`, `${o} .ct__queue`, 'text'],
    [`item ${n} card`, `${e} [data-cb2card]`, `${o} .ct__card`],
    [`item ${n} photo`, `${e} [data-cb2card] > div:first-child`, `${o} .ct__media`],
    [`item ${n} title`, `${e} h3`, `${o} .ct__item-title`, 'text'],
    [`item ${n} text`, `${e} h3 + p`, `${o} .ct__text`, 'text'],
    [`item ${n} works`, `${e} ul`, `${o} .ct__works`],
  ];
};

export default {
  neutralize: {
    exp: 'header,a[aria-label*="квіз"]{visibility:hidden!important}',
    ours: '.site-header{visibility:hidden!important}',
  },
  settle: 600,
  root: '.ct',
  states: {
    base: {
      prepare: (page, side) => top(page, side, 0),
      elements: [
        ['title', `${E} h2`, '.ct__title', 'text'],
        ['row prev', `${E} [aria-label="Попередня картка"]`, '[data-ct-row-prev]'],
        ...parts(1),
        ['photo next', `${E} [data-cb2]:nth-of-type(1) [aria-label="Наступне фото"]`, '.ct__item:nth-of-type(1) [data-ct-photo-next]'],
        ['video', `${E} [data-cb2]:nth-of-type(1) [aria-label="Дивитися drone-video"]`, '.ct__item:nth-of-type(1) [data-ct-video]'],
      ],
    },
    next: {
      prepare: async (page, side) => {
        await top(page, side, 0);
        await page.evaluate((s) => document.querySelector(s).click(), side === 'exp' ? `${E} [aria-label="Наступна картка"]` : '[data-ct-row-next]');
        await page.waitForTimeout(1500);
      },
      elements: [...parts(2)],
    },
    arch: {
      maxWidth: 767,
      prepare: async (page, side) => {
        await top(page, side, 0);
        await page.evaluate((s) => { const r = document.querySelector(s); r.scrollTo({ left: r.scrollWidth, behavior: 'instant' }); }, ROW[side]);
        await page.waitForTimeout(800);
      },
      elements: [
        ['arch', `${E} [data-cb2arch]`, '.ct__arch'],
        ['arch title', `${E} [data-cb2arch] > span > span:first-child`, '.ct__arch-title', 'text'],
        ['arch text', `${E} [data-cb2arch] > span > span:last-child`, '.ct__arch-p', 'text'],
      ],
    },
  },
};
