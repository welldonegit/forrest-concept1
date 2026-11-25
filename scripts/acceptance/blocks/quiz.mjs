/**
 * Конфиг приёмки квиза (выгрузка 2026-11-25: design-export/updates/2026-11-25/quiz/quiz.html).
 * Состояния — шаги: s0 формат, s1 бюджет (выбран первый вариант), s2 месенджер, s3 форма (бонусы открыты).
 * Окно открывается кнопкой: в выгрузке — data-quiz-open, у нас — боковая вкладка (код квиза грузится по клику).
 * Под окном с обеих сторон — ровный фон white-sand: страница под затемнением не сравнивается.
 */
const STEP_WAIT = 2600; // шаг проявился, реплика менеджера «допечатана» (1.2 + .5 с)

const ui = {
  exp: { open: '[data-quiz-open]', format: '[data-qstep] [data-qopt]', budget: '[data-qstep] [data-qopt]', next: '[data-qfoot] [data-qnext]', messenger: '[data-qmg] [data-qopt]' },
  ours: { open: '[data-popup="quiz"]', format: '[data-quiz-format]', budget: '.quiz__step:not([hidden]) .quiz__opt', next: '[data-quiz-next]', messenger: '[data-quiz-messenger]' },
};

const go = (upTo) => async (page, side) => {
  const s = ui[side];
  await page.locator(s.open).first().dispatchEvent('click'); // кнопка скрыта neutralize
  await page.waitForTimeout(STEP_WAIT);
  if (upTo >= 1) { await page.locator(s.format).first().click(); await page.waitForTimeout(STEP_WAIT); }
  if (upTo >= 2) {
    await page.locator(s.budget).first().click();
    await page.locator(s.next).first().click();
    await page.waitForTimeout(STEP_WAIT);
  }
  if (upTo >= 3) { await page.locator(s.messenger).first().click(); await page.waitForTimeout(STEP_WAIT); }
};

const V = '.quiz__step:not([hidden])';
const common = [
  ['panel', '[data-qpanel]', '.quiz__panel'],
  ['eyebrow', '[data-qlbl]', '.quiz__eyebrow', 'text'],
  ['bar', '[data-qbar]', '.quiz__bar'],
  ['close', '[data-qx]', '.quiz__x'],
  ['body', '[data-qbody]', '.quiz__body'],
  ['title', '[data-qstep] h2', `${V} h2`, 'text'],
];
const side = [
  ['side', '[data-qside]', '.quiz__side'],
  ['manager', '[data-qmgr]', '.quiz__mgr'],
  ['manager photo', '[data-qph]', '.quiz__mgr-photo'],
  ['manager name', '[data-qmhd] > div:nth-child(2) > span:nth-child(1)', '.quiz__mgr-name', 'text'],
  ['bubble', '[data-qbub]', '.quiz__bub:not([hidden])'],
  ['bubble text', '[data-qbt]', '.quiz__bub:not([hidden]) .quiz__bub-text', 'text'],
];
const bonuses = [
  ['bonuses', '[data-qbon]', '.quiz__bonuses'],
  ['bonus 1', '[data-qbrow]', '.quiz__bonuses .quiz__bon'],
  ['bonus 1 title', '[data-qbrow] > span:nth-child(2)', '.quiz__bonuses .quiz__bon-title', 'text'],
];
const strip = [
  ['strip', '[data-qbm]', '.quiz__strip'],
  ['strip item 1', '[data-qbm] li', '.quiz__strip .quiz__bon'],
];
const foot = [
  ['foot', '[data-qfoot]', '.quiz__foot'],
  ['back', '[data-qbackbtn]', '.quiz__btn--back'],
];
const wide = (list) => ({ minWidth: 900, elements: [...common, ...side, ...bonuses, ...list] });
const narrow = (list) => ({ maxWidth: 899, elements: [...common, ...side, ...strip, ...list] });
const opt1 = ['option 1', '[data-qstep] [data-qopt]', `${V} .quiz__opt`];
const steps = {
  s0: [opt1],
  s1: [opt1, ['next', '[data-qfoot] [data-qnext]', '.quiz__foot [data-quiz-next]'], ...foot],
  s2: [['messenger 1', '[data-qmg] [data-qopt]', '[data-quiz-messenger]'], ['sub', '[data-qstep] p', `${V} .quiz__sub`, 'text'], ...foot],
  s3: [['input name', '[name=name]', '.quiz [name=name]'], ['input phone', '[name=phone]', '.quiz [name=phone]'], ['submit', 'form [data-qnext]', '.quiz__cta--submit'], ...foot],
};
const states = {};
for (const [name, list] of Object.entries(steps)) {
  const n = Number(name.slice(1));
  states[name] = { ...wide(list), prepare: go(n) };
  states[`${name}-col`] = { ...narrow(list), prepare: go(n) };
}

export default {
  export: 'updates/2026-11-25/quiz/quiz.html',
  neutralize: {
    exp: '.demo-open{visibility:hidden}',
    ours: 'body{background:var(--white-sand)!important} body *{visibility:hidden} dialog[open], dialog[open] *{visibility:visible}',
  },
  settle: 1200,
  root: 'dialog[open], [data-quiz]',
  states,
};
