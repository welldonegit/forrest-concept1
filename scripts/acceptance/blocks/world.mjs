/**
 * Конфиг приёмки окна «Детальніше» мира (выгрузка 2026-11-25: design-export/updates/2026-11-25/section-popups/index.html).
 * Состояния: w0/w1/w2 — окно открыто кнопкой мира (верх содержимого), w0-form — прокручено до формы.
 * Окно открывается кнопкой: в выгрузке — data-section-open, у нас — кнопка карточки Worlds (код окна грузится по клику).
 * Под окном с обеих сторон — ровный фон white-sand: страница под затемнением не сравнивается.
 */
const OPEN_WAIT = 2400; // панель раскрылась (1 с), тексты поднялись (.58 + 1 с)

const open = (n, toForm = false) => async (page, side) => {
  const sel = side === 'exp' ? `[data-section-open="${n}"]` : `[data-popup="world"][data-world="${n}"]`;
  await page.locator(sel).first().dispatchEvent('click'); // кнопка скрыта neutralize
  await page.waitForTimeout(OPEN_WAIT);
  if (toForm) {
    await page.evaluate((side) => {
      const narrow = innerWidth < 900;
      const box = side === 'exp'
        ? document.querySelector(narrow ? '[data-hs=zmgrid]' : '[data-hs=zmright]')
        : document.querySelector(narrow ? '.wpop__grid' : '.wpop__right');
      box.scrollTop = box.scrollHeight;
    }, side);
    await page.waitForTimeout(400);
  }
};

const els = (n) => {
  const E = `[data-hs=zmright] [data-hs=zmw][data-w="${n}"]`;
  const O = `.wpop__pane[data-w="${n}"]`;
  return [
    ['panel', '[data-hs=zmpanel]', '.wpop__panel'],
    ['left', '[data-hs=zmleft]', '.wpop__left'],
    ['overline', `[data-hs=zmleft] [data-hs=zmw][data-w="${n}"] span:nth-child(1)`, `.wpop__intro [data-w="${n}"] .wpop__overline`, 'text'],
    ['name', `[data-hs=zmleft] [data-hs=zmw][data-w="${n}"] span:nth-child(2)`, `.wpop__intro [data-w="${n}"] h2`, 'text'],
    ['tagline', `[data-hs=zmleft] [data-hs=zmw][data-w="${n}"] span:nth-child(3)`, `.wpop__intro [data-w="${n}"] .wpop__tagline`, 'text'],
    ['tabs', '[role=tablist]', '.wpop__tabs'],
    ['tab 1', '[data-hs=zmtab][data-w="0"]', '.wpop__tab[data-wpop-tab="0"]'],
    ['close', '[data-hs=zmx]', '.wpop__x'],
    ['about label', `${E} section span`, `${O} .wpop__about .wpop__label`, 'text'],
    ['about', `${E} section p`, `${O} .wpop__text`, 'text'],
    ['facts', `${E} [data-hs=zmfacts]`, `${O} .wpop__facts`],
    ['fact 1 value', `${E} [data-hs=zmfacts] > div:nth-child(1) span:nth-child(2)`, `${O} .wpop__fact:nth-child(1) dd`, 'text'],
    ['chips', `${E} [data-hs=zminfra]`, `${O} .wpop__chips`],
    ['chip 1', `${E} [data-hs=zminfra] li`, `${O} .wpop__chip`, 'text'],
    ['form card', `${E} section:has(form)`, `${O} .wpop__card`],
    ['form title', `${E} form h3`, `${O} .wpop__form h3`, 'text'],
    ['input name', `${E} form [name=name]`, `${O} [name=name]`],
    ['input phone', `${E} form [name=phone]`, `${O} [name=phone]`],
    ['chip telegram', `${E} form [data-hs=zmchip] span`, `${O} .wpop__opt span`],
    ['submit', `${E} form [data-hs=zmsubmit]`, `${O} .wpop__submit`],
    ['consent', `${E} form [data-hs=zmsubmit] + span`, `${O} .wpop__consent`, 'text'],
  ];
};

export default {
  export: 'updates/2026-11-25/section-popups/index.html',
  neutralize: {
    exp: '.demo-open, .demo{visibility:hidden} body{background:var(--white-sand, #F2EAD8)!important}',
    ours: 'body{background:var(--white-sand)!important} body *{visibility:hidden} dialog[open], dialog[open] *{visibility:visible}',
  },
  settle: 1200,
  root: 'dialog[open], [data-hs=zmodal]',
  states: {
    w0: { elements: els(0), prepare: open(0) },
    w1: { elements: els(1), prepare: open(1) },
    w2: { elements: els(2), prepare: open(2) },
    'w0-form': { elements: els(0), prepare: open(0, true) },
  },
};
