/**
 * Конфиг приёмки Worlds (4.4): кадры сцены прокрутки при фиксированном прогрессе p
 * (доля прокрутки секции). После прокрутки ждём, пока сглаживание догонит цель.
 *   intro p=0 — заголовок и три карточки; card p=0.3 — карточка развёрнута, слайд WIND;
 *   wave p=0.5 — середина волны ROCK; rock p=0.66; sun p=1.
 * Шапка сайта и вкладка квиза скрыты с обеих сторон.
 */
const SEC = { exp: 'section[data-screen-label=Worlds]', ours: '.worlds' };

const at = (p) => async (page, side) => {
  await page.evaluate(([sel, p]) => {
    const s = document.querySelector(sel);
    const top = s.getBoundingClientRect().top + scrollY;
    const st = s.firstElementChild;
    scrollTo({ top: top + p * (s.offsetHeight - st.clientHeight), behavior: 'instant' });
  }, [SEC[side], p]);
  await page.waitForTimeout(3000);
};
const slide = (i) => {
  const e = `[data-hs=wstage] [data-slide="${i}"]`;
  const o = `.worlds [data-slide="${i}"]`;
  return [
    [`slide ${i} overline`, `${e} > span`, `${o} .worlds__overline`, 'text'],
    [`slide ${i} name`, `${e} h3 > span:first-child`, `${o} .worlds__name-main`, 'text'],
    [`slide ${i} subtitle`, `${e} h3 > span:last-child`, `${o} .worlds__subtitle`, 'text'],
    [`slide ${i} button`, `${e} a`, `${o} .worlds__btn`],
    [`slide ${i} button icon`, `${e} a > span`, `${o} .worlds__btn-icon`],
  ];
};
const dots = [0, 1, 2].map((i) => [`dot ${i}`, `[data-hs=wdot][data-dot="${i}"]`, `.worlds__dot[data-dot="${i}"]`, 'text']);
const intro = [
  ['title', '[data-hs=whead]', '.worlds__title'],
  ...[1, 2, 3].map((i) => [`title line ${i}`, `[data-hs=whead] > span:nth-child(${i})`, `.worlds__line:nth-child(${i})`, 'text']),
  ['pill 1', '[data-hs=whead] > span:nth-child(1) > span', '.worlds__line:nth-child(1) .worlds__pill'],
  ['pill 2', '[data-hs=whead] > span:nth-child(2) > span', '.worlds__line:nth-child(2) .worlds__pill'],
  ...['l', 'c', 'r'].map((k) => [`slot ${k}`, `[data-ph=${k}]`, `.worlds__slot[data-slot=${k}]`]),
];

export default {
  neutralize: {
    exp: 'header,a[aria-label*="квіз"]{visibility:hidden!important}',
    ours: '.site-header{visibility:hidden!important}',
  },
  settle: 1200,
  root: '.worlds',
  states: {
    intro: { prepare: at(0), elements: intro },
    card: { prepare: at(0.3), elements: [...slide(0), ...dots] },
    wave: { prepare: at(0.5), elements: [] },
    rock: { prepare: at(0.66), elements: [...slide(1), ...dots] },
    sun: { prepare: at(1), elements: [...slide(2), ...dots] },
  },
};
