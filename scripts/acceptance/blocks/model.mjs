/**
 * Конфиг приёмки Model (4.5).
 *   steps (≥768) — секция поднята на 350px над верхом окна: абзац проявлен целиком, все шаги «включены».
 *   deck-0 / deck-mid / deck-end (<768) — колода: начало прилипания, середина (p = 1.5), конец.
 * Шапка сайта и вкладка квиза скрыты с обеих сторон.
 */
const SEC = { exp: '#model', ours: '.model' };
const WRAP = { exp: '[data-mwrap]', ours: '[data-model-wrap]' };
const STICK = { exp: '[data-mstick]', ours: '[data-model-stick]' };

const lift = (d) => async (page, side) => {
  await page.evaluate(([sel, d]) => {
    const s = document.querySelector(sel);
    scrollTo({ top: s.getBoundingClientRect().top + scrollY + d, behavior: 'instant' });
  }, [SEC[side], d]);
  await page.waitForTimeout(4500);
};
// Колода: доля f прокрутки прилипшего блока (0 — начало, 1 — конец).
const deck = (f) => async (page, side) => {
  // сначала подвести блок к экрану: сцена запускается при подходе и меняет высоту колоды
  await page.evaluate((w) => {
    const wrap = document.querySelector(w);
    scrollTo({ top: wrap.getBoundingClientRect().top + scrollY - innerHeight / 2, behavior: 'instant' });
  }, WRAP[side]);
  await page.waitForTimeout(1500);
  await page.evaluate(([w, st, f]) => {
    const wrap = document.querySelector(w);
    const stick = document.querySelector(st);
    const H = stick.offsetHeight, vh = innerHeight;
    const T = H < vh ? (vh - H) / 2 : vh - H;
    const top = wrap.getBoundingClientRect().top + scrollY;
    scrollTo({ top: top - T + f * (wrap.offsetHeight - H) + 2, behavior: 'instant' });
  }, [WRAP[side], STICK[side], f]);
  await page.waitForTimeout(2500);
  // второй проход: размеры колоды пересчитываются после прилипания
  await page.evaluate(() => dispatchEvent(new Event('scroll')));
  await page.waitForTimeout(800);
};

const step = (n) => [
  [`step ${n}`, `[data-ms]:nth-child(${n})`, `.model__step:nth-child(${n})`],
  [`step ${n} num`, `[data-ms]:nth-child(${n}) [data-hs=mnum]`, `.model__step:nth-child(${n}) .model__num`, 'text'],
  [`step ${n} card`, `[data-ms]:nth-child(${n}) [data-hs=mcard]`, `.model__step:nth-child(${n}) .model__card`],
  [`step ${n} title`, `[data-ms]:nth-child(${n}) [data-hs=mtitle]`, `.model__step:nth-child(${n}) .model__title`, 'text'],
  [`step ${n} text`, `[data-ms]:nth-child(${n}) [data-hs=mdesc]`, `.model__step:nth-child(${n}) .model__text`, 'text'],
];
const desktop = [
  ['section', SEC.exp, SEC.ours],
  ['lead', '#model [data-mstick] > p', '.model__lead', 'text'],
  ['steps', '[data-hs=msteps]', '.model__steps'],
  ['line', '[data-hs=mline]', '.model__line'],
  ['dot 1', '[data-ms]:nth-child(1) [data-hs=mdot]', '.model__step:nth-child(1) .model__dot'],
  ...step(1), ...step(3), ...step(5),
];
const mobile = [
  ['lead', '#model [data-mstick] > p', '.model__lead', 'text'],
  ...step(1), ...step(2),
];

export default {
  neutralize: {
    exp: 'header,a[aria-label*="квіз"]{visibility:hidden!important}',
    ours: '.site-header{visibility:hidden!important}',
  },
  settle: 1200,
  root: '.model',
  states: {
    steps: { minWidth: 768, prepare: lift(350), elements: desktop },
    'deck-0': { maxWidth: 767, prepare: deck(0), elements: mobile },
    'deck-mid': { maxWidth: 767, prepare: deck(0.375), elements: mobile },
    'deck-end': { maxWidth: 767, prepare: deck(1), elements: mobile },
  },
};
