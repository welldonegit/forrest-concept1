/**
 * Конфиг приёмки блоков ukraine-bukovel (выгрузка 2026-11-25: design-export/updates/2026-11-25/ukraine-bukovel/blocks.html):
 * «Переваги інвестування в Україну», фото между блоками, «Буковель».
 * Блоки видны только на en, выгрузка — на украинском: попиксельно сверяется сборка, где у блоков временно
 * снят язык (scripts/acceptance/why-uk-build.sh); en и +40% — отдельной проверкой «ничего не вылезает».
 * Состояния: ua — к верху окна заголовок «Україна», cards — карточки, band — фото, bv — заголовок Буковеля, rows — строки.
 */
const SEL = {
  ua: { exp: '[data-ua]', ours: '.why-ua' },
  cards: { exp: '[data-uag]', ours: '.why-ua__cards' },
  band: { exp: '[data-bvimg]', ours: '.why-band' },
  bv: { exp: '[data-bvhd]', ours: '.why-bv .why__head' },
  rows: { exp: '[data-bvlist]', ours: '.why-bv__rows' },
};
const WAIT = 3800; // самая длинная анимация — 2.8 с (фото) + задержки

const to = (key) => async (page, side) => {
  await page.evaluate((sel) => {
    document.querySelectorAll('[data-uab],[data-bvb],[data-reveal]').forEach((e) => { e.dataset.in = ''; });
    document.querySelector(sel).scrollIntoView({ block: 'start', behavior: 'instant' });
  }, SEL[key][side]);
  await page.waitForTimeout(WAIT);
};

const head = (exp, ours) => [
  ['title', `${exp} h2`, `${ours} h2`, 'text'],
  ['title line 2', `${exp} h2 span:nth-child(2)`, `${ours} h2 .why__line:nth-child(2)`, 'text'],
  ['lead', `${exp} > p, ${exp} p[data-uar], ${exp} p[data-bvr]`, `${ours} .why__lead`, 'text'],
];
const card = (n) => [
  [`card ${n}`, `[data-uag] article:nth-child(${n})`, `.why-ua__card:nth-child(${n})`],
  [`card ${n} tag`, `[data-uag] article:nth-child(${n}) > span`, `.why-ua__card:nth-child(${n}) .why-ua__tag`],
  [`card ${n} title`, `[data-uag] article:nth-child(${n}) h3`, `.why-ua__card:nth-child(${n}) h3`, 'text'],
  [`card ${n} text`, `[data-uag] article:nth-child(${n}) h3 + p`, `.why-ua__card:nth-child(${n}) .why-ua__text`, 'text'],
];
const row = (n) => [
  [`row ${n}`, `[data-bvrow]:nth-child(${n})`, `.why-bv__row:nth-child(${n})`],
  [`row ${n} value`, `[data-bvrow]:nth-child(${n}) p[data-ual]`, `.why-bv__row:nth-child(${n}) .why-bv__value`],
  [`row ${n} title`, `[data-bvrow]:nth-child(${n}) h3`, `.why-bv__row:nth-child(${n}) h3`, 'text'],
  [`row ${n} text`, `[data-bvrow]:nth-child(${n}) > p[data-bvc]`, `.why-bv__row:nth-child(${n}) .why-bv__text`, 'text'],
];

export default {
  export: 'updates/2026-11-25/ukraine-bukovel/blocks.html',
  neutralize: {
    exp: '',
    ours: 'header, .site-header, .quiz-tab, [data-popup="quiz"], main > :not(.why):not(.why-band), .site-footer{visibility:hidden!important}',
  },
  settle: 1200,
  root: 'main',
  states: {
    ua: { prepare: to('ua'), elements: [['section', '[data-ua]', '.why-ua'], ...head('[data-uah]', '.why-ua .why__head'), ...card(1), ...card(2), ...card(3)] },
    cards: { prepare: to('cards'), elements: [['cards', '[data-uag]', '.why-ua__cards'], ['card 1 value', '[data-uag] article:nth-child(1) p[data-ual]', '.why-ua__card:nth-child(1) .why__value'], ['card 2 bar', '[data-uag] article:nth-child(2) [aria-hidden]', '.why-ua__bar'], ['card 3 stars', '[data-uastars]', '.why-ua__stars'], ...card(1), ...card(3)] },
    band: { prepare: to('band'), elements: [['photo', '[data-bvimg]', '.why-band'], ['bv head', '[data-bvhd]', '.why-bv .why__head'], ...head('[data-bvhd]', '.why-bv .why__head')] },
    bv: { prepare: to('bv'), elements: [...head('[data-bvhd]', '.why-bv .why__head'), ['rows', '[data-bvlist]', '.why-bv__rows'], ...row(1)] },
    rows: { prepare: to('rows'), elements: [['rows', '[data-bvlist]', '.why-bv__rows'], ...row(1), ...row(2), ...row(3)] },
  },
};
