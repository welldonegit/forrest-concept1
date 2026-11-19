/**
 * Конфиг приёмки Investor Service (4.11).
 *   head  — заголовок и лид у верха окна.
 *   scene — всё показано: ≥900 — конец сцены (дорожка прокручена до конца), <900 — мок у верха окна.
 *   cards — <900: карточки сервисов (вторая половина столбца) у верха окна.
 * Шапка сайта и вкладка квиза скрыты с обеих сторон.
 */
const S = { exp: '#servis', ours: '.svc' };
const TRACK = { exp: '#servis [data-svtrack]', ours: '.svc__track' };
const LAP = { exp: '#servis [data-svlap]', ours: '.svc__lap' };
const CARD = (k) => ({ exp: `#servis [data-svcard][data-k="${k}"]`, ours: `.svc__card[data-k="${k}"]` });

const scrollTo = async (page, sel, extra = 0, p = null) => {
  for (const wait of [1200, 3000]) {
    await page.evaluate(([s, e, pr]) => {
      const el = document.querySelector(s);
      const top = el.getBoundingClientRect().top + scrollY;
      window.scrollTo({ top: pr === null ? top - e : top + pr * (el.offsetHeight - innerHeight), behavior: 'instant' });
    }, [sel, extra, p]);
    await page.waitForTimeout(wait);
  }
};

const card = (k, n) => {
  const c = CARD(k);
  return [
    [`card ${n}`, c.exp, c.ours],
    [`card ${n} title`, `${c.exp} h3`, `${c.ours} h3`, 'text'],
    [`card ${n} text`, `${c.exp} p`, `${c.ours} p`, 'text'],
  ];
};

export default {
  neutralize: {
    exp: 'header,a[aria-label*="квіз"]{visibility:hidden!important}',
    ours: '.site-header{visibility:hidden!important}',
  },
  settle: 600,
  root: '.svc',
  states: {
    head: {
      prepare: (page, side) => scrollTo(page, S[side], 0),
      elements: [
        ['frame', '#servis > div', '.svc__frame'],
        ['title', '#servis h2', '.svc__title', 'text'],
        ['lead', '#servis [data-lead]', '.svc__lead', 'text'],
      ],
    },
    scene: {
      prepare: async (page, side) => {
        const w = page.viewportSize().width;
        if (w >= 900) await scrollTo(page, TRACK[side], 0, 1);
        else await scrollTo(page, LAP[side], 24);
      },
      elements: [
        ['laptop', LAP.exp, LAP.ours],
        ['phone', '#servis [data-svphone]', '.svc__phone'],
        ['caption title', '#servis [data-svcap] h3', '.svc__cap-title', 'text'],
        ['caption text', '#servis [data-svcap] p', '.svc__cap-text', 'text'],
        ...card(0, '02'), ...card(1, '05'), ...card(4, '04'), ...card(5, '07'),
      ],
    },
    cards: {
      maxWidth: 899,
      prepare: (page, side) => scrollTo(page, CARD(3)[side], 24),
      elements: [...card(3, '06'), ...card(5, '07')],
    },
  },
};
