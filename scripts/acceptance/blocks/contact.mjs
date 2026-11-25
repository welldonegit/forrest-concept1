/**
 * Конфиг приёмки попапа «Звʼязатися» (выгрузка 2026-11-25: design-export/updates/2026-11-25-contact-popup/index.html).
 * Состояния: open — попап открыт кнопкой «Звʼязатися» (в выгрузке .fc-btn, у нас — кнопка шапки);
 * error — нажата отправка с пустым телефоном (ошибка под полем).
 * Под попапом с обеих сторон — ровный фон linen (как body выгрузки): страница под затемнением не сравнивается.
 * Фокус после открытия убран (blur): в выгрузке он ставится через 50 мс, у нас сразу — кольцо фокуса сравнивается отдельно.
 */
const OPEN_WAIT = 1200; // подложка .35s, карточка .7s

const open = (error = false) => async (page, side) => {
  await page.locator(side === 'exp' ? '.fc-btn' : '.site-header__cta').first().dispatchEvent('click');
  await page.waitForTimeout(OPEN_WAIT);
  if (error) {
    await page.locator(side === 'exp' ? '.fc-submit' : '.cpop__submit').click();
    await page.waitForTimeout(600);
  }
  await page.evaluate(() => document.activeElement?.blur());
  await page.waitForTimeout(400);
};

const els = (error) => [
  ['card', '.fc-pop__card', '.cpop__card'],
  ['photo', '.fc-pop__img', '.cpop__img'],
  ['body', '.fc-pop__body', '.cpop__body'],
  ['close', '.fc-pop__x', '.cpop__x'],
  ['title', '.fc-pop__title', '.cpop__title', 'text'],
  ['input name', '.fc-input[name=name]', '.cpop__input[name=name]'],
  ['input phone', '.fc-input[name=phone]', '.cpop__input[name=phone]'],
  ...(error ? [['error', '.fc-err', '.cpop__err:not(.cpop__status)', 'text']] : []),
  ['submit', '.fc-submit', '.cpop__submit'],
  ['submit icon', '.fc-submit__icon', '.cpop__submit-icon'],
];

export default {
  export: 'updates/2026-11-25-contact-popup/index.html',
  neutralize: {
    exp: '.demo-header{visibility:hidden} body{background:var(--linen, #F7F2E8)!important}',
    ours: 'body{background:var(--linen)!important} body *{visibility:hidden} dialog[open], dialog[open] *{visibility:visible}',
  },
  settle: 1200,
  root: 'dialog[open], .fc-pop:not([hidden])',
  states: {
    open: { elements: els(false), prepare: open() },
    error: { elements: els(true), prepare: open(true) },
  },
};
