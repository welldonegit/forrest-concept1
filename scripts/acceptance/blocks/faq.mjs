/**
 * Конфиг приёмки FAQ (4.14).
 *   in   — секция у верха окна, всё проявилось, открыт первый вопрос (как при загрузке).
 *   q3   — открыт третий вопрос (первый закрыт).
 * На <900 карточка стоит под вопросами, под ответом видна плашка с цифрой.
 */
const SEC = { exp: '#faq', ours: '.faq' };

const top = async (page, side) => {
  for (const wait of [1500, 3000]) {
    await page.evaluate((sel) => {
      const s = document.querySelector(sel);
      scrollTo({ top: s.getBoundingClientRect().top + scrollY - 40, behavior: 'instant' });
    }, SEC[side]);
    await page.waitForTimeout(wait);
  }
};
const openThird = async (page, side) => {
  await top(page, side);
  await page.click(side === 'exp' ? '#faq [data-fqi]:nth-child(3) [data-fqb]' : '.faq__item:nth-child(3) .faq__q');
  await page.waitForTimeout(1600);
  await top(page, side);
};

const els = (n) => [
  ['section', SEC.exp, SEC.ours],
  ['title', '#faq h2', '.faq__title', 'text'],
  ['aside', '#faq [data-fqa]', '.faq__aside'],
  ['docs title', '#faq [data-fqdocs] > span', '.faq__docs-title', 'text'],
  ['doc 1', '#faq [data-fqdocs] a:nth-child(1)', '.faq__doc-list li:nth-child(1) .faq__doc'],
  ['doc 1 title', '#faq [data-fqdocs] a:nth-child(1) > span:nth-child(2) > span', '.faq__doc-list li:nth-child(1) .faq__doc-title', 'text'],
  ['doc 3', '#faq [data-fqdocs] a:nth-child(3)', '.faq__doc-list li:nth-child(3) .faq__doc'],
  ['cta title', '#faq [data-fqcta] > div > span:nth-child(1)', '.faq__cta-title', 'text'],
  ['cta text', '#faq [data-fqcta] > div > span:nth-child(2)', '.faq__cta-lead', 'text'],
  ['cta button', '#faq [data-fqcta] > a', '.faq__cta-button'],
  ['list', '#faq [data-fql]', '.faq__list'],
  ['item 1', '#faq [data-fqi]:nth-child(1)', '.faq__item:nth-child(1)'],
  ['q 1', '#faq [data-fqi]:nth-child(1) [data-fqb] > span:nth-child(2)', '.faq__item:nth-child(1) .faq__q-text', 'text'],
  ['num 1', '#faq [data-fqi]:nth-child(1) [data-fqb] > span:nth-child(1)', '.faq__item:nth-child(1) .faq__num'],
  ['x 1', '#faq [data-fqi]:nth-child(1) [data-fqx]', '.faq__item:nth-child(1) .faq__x'],
  [`item ${n}`, `#faq [data-fqi]:nth-child(${n})`, `.faq__item:nth-child(${n})`],
  [`answer ${n}`, `#faq [data-fqi]:nth-child(${n}) [data-fqc] p`, `.faq__item:nth-child(${n}) .faq__a`, 'text'],
  ['item 8', '#faq [data-fqi]:nth-child(8)', '.faq__item:nth-child(8)'],
];

export default {
  neutralize: {
    exp: 'header,a[aria-label*="квіз"]{visibility:hidden!important}',
    ours: '.site-header{visibility:hidden!important}',
  },
  settle: 1200,
  root: '.faq',
  states: {
    in: { prepare: top, elements: els(1) },
    q3: { prepare: openThird, elements: els(3) },
  },
};
