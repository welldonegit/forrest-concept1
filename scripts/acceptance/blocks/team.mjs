/**
 * Конфиг приёмки Team v3 (4.13). Секция выгрузки — #komanda-2, у нас — .team (#komanda).
 *   first  — выбран первый участник (как при загрузке), секция у верха окна.
 *   third  — нажата третья вкладка («Управляюча компанія»).
 * Шапка сайта и вкладка квиза скрыты с обеих сторон.
 */
const E = '#komanda-2';
const SEC = { exp: E, ours: '.team' };
const top = async (page, side) => {
  await page.evaluate((s) => {
    const el = document.querySelector(s);
    scrollTo({ top: el.getBoundingClientRect().top + scrollY, behavior: 'instant' });
  }, SEC[side]);
  await page.waitForTimeout(1200);
};
const tab = (n) => [`${E} [data-ktc="${n}"]`, `.team__tab:nth-of-type(${n + 1})`];
const panel = (n, side) => (side === 'exp' ? `${E} [data-ktp="${n}"]` : `.team__panel:nth-of-type(${n + 1})`);
const parts = (n) => {
  const [e, o] = [`${E} [data-ktp="${n}"]`, `#komanda-panel-${n}`];
  return [
    [`tab ${n}`, tab(n)[0], `#komanda-tab-${n}`],
    [`tab ${n} logo`, `${tab(n)[0]} img`, `#komanda-tab-${n} .team__logo`],
    [`photo ${n}`, `${e} [data-ktph]`, `${o} .team__photo`],
    [`name ${n}`, `${e} h3`, `${o} .team__name`, 'text'],
    [`text ${n}`, `${e} h3 + p`, `${o} .team__text`, 'text'],
    [`stats ${n}`, `${e} h3 + p + div`, `${o} .team__stats`],
    [`quote ${n}`, `${e} figure`, `${o} .team__quote`],
    [`quote ${n} text`, `${e} blockquote`, `${o} .team__qtext`, 'text'],
  ];
};

export default {
  neutralize: {
    exp: 'header,a[aria-label*="квіз"]{visibility:hidden!important}',
    ours: '.site-header{visibility:hidden!important}',
  },
  settle: 1200,
  root: '.team',
  states: {
    first: {
      prepare: (page, side) => top(page, side),
      elements: [
        ['title', `${E} h2`, '.team__title', 'text'],
        ['subtitle', `${E} h2 + p`, '.team__sub', 'text'],
        ...parts(0),
        ['tab 1', tab(1)[0], '#komanda-tab-1'],
      ],
    },
    third: {
      prepare: async (page, side) => {
        await top(page, side);
        await page.evaluate((s) => document.querySelector(s).click(), side === 'exp' ? tab(2)[0] : '#komanda-tab-2');
        await page.waitForTimeout(1600);
        await top(page, side);
      },
      elements: [...parts(2)],
    },
  },
};
