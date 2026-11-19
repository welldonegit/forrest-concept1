/**
 * Конфиг приёмки Header (4.0): бар, список языков, полноэкранное меню.
 *
 * Конфиг блока:
 *   neutralize.exp / .ours — CSS, который убирает всё, кроме блока (одинаковый фон);
 *   states.<имя>.prepare(page, side) — довести страницу до состояния (клик, ожидание);
 *   states.<имя>.clip({w,h}) — область скриншота (по умолчанию — окно целиком);
 *   states.<имя>.minWidth / maxWidth — на каких ширинах состояние существует;
 *   states.<имя>.elements — [название, селектор в выгрузке, селектор в вёрстке, 'text'?].
 */
const BG = '#5B756A'; // ровный фон вместо фото Hero, чтобы дифф показывал только Header

export default {
  neutralize: {
    exp: `section[data-screen-label="Hero"]{background:${BG}!important}
      section[data-screen-label="Hero"]>*:not(header){visibility:hidden!important}
      a[href="#kvyz"],a[aria-label*="квіз"]{visibility:hidden!important}`,
    ours: `.hero__frame{background:${BG}!important}
      .hero__frame>*{visibility:hidden!important}`,
  },
  states: {
    normal: {
      clip: ({ w }) => ({ x: 0, y: 0, width: w, height: 100 }),
      elements: [
        ['bar', 'header', '.site-header__bar'],
        ['burger', '[data-hs=mburger]', '.site-header__burger'],
        ['logo', 'header a[href="#top"] img', '.site-header__logo-img'],
        ['lang', '[data-lsel] > button', '.lang-switch__toggle'],
        ['lang chip', '[data-lsel] > button > span', '.lang-switch__current'],
        ['lang chip text', '[data-lsel] > button > span', '.lang-switch__current', 'text'],
        ['lang chevron', '[data-lchev]', '.lang-switch__chev'],
        ['cta', 'header a[href="#forma"]', '.site-header__cta'],
        ['cta text', 'header a[href="#forma"] > span:first-child', '.site-header__cta-label', 'text'],
        ['cta circle', 'header a[href="#forma"] > span:last-child', '.site-header__cta-icon'],
      ],
    },
    lang: {
      minWidth: 900, // в выгрузке переключатель в баре скрыт на <900
      async prepare(page, side, { h }) {
        await page.click(side === 'exp' ? '[data-lsel] > button' : '.lang-switch__toggle');
        await page.waitForTimeout(900);
        await page.mouse.move(0, h - 1);
        await page.waitForTimeout(400);
      },
      clip: ({ w }) => ({ x: Math.max(0, w - 420), y: 0, width: Math.min(420, w), height: 480 }),
      elements: [
        ['panel', '[data-lpanel]', '.lang-switch__panel'],
        ['option 1', '[data-lopt]', '.lang-switch__option'],
        ['option 1 chip', '[data-lopt] [data-lchip]', '.lang-switch__chip'],
        ['option 1 name', '[data-lopt] > span:nth-child(2)', '.lang-switch__name', 'text'],
        ['option 1 check', '[data-lopt] svg', '.lang-switch__check'],
        ['option 2', '[data-lopt]:nth-of-type(2)', 'li:nth-child(2) > .lang-switch__option'],
        ['option 2 name', '[data-lopt]:nth-of-type(2) > span:nth-child(2)', 'li:nth-child(2) .lang-switch__name', 'text'],
      ],
    },
    menu: {
      async prepare(page, side, { w, h }) {
        await page.click(side === 'exp' ? '[data-hs=mburger]' : '.site-header__burger');
        await page.waitForTimeout(3200);
        await page.mouse.move(w - 1, h - 1);
        await page.waitForTimeout(400);
      },
      elements: [
        ['top row', '[data-hs=mtop]', '.site-menu__top'],
        ['logo', '[data-hs=mtop] img', '.site-menu__logo-img'],
        ['close', '[data-hs=mclose]', '.site-menu__close'],
        ['nav', '[data-hs=mmain] nav', '.site-menu__nav'],
        ...[1, 2, 3, 4, 5].map((i) => [`link ${i} text`, `[data-hs=mlist] li:nth-child(${i}) [data-hs=mlink]`, `.site-menu__item:nth-child(${i}) .site-menu__link`, 'text']),
        ...[1, 5].map((i) => [`sublink ${i}`, `[data-hs=msub] li:nth-child(${i}) [data-hs=msl]`, `.site-menu__sublist li:nth-child(${i}) .site-menu__sublink`, 'text']),
        ['photo', '[data-hs=mimg]', '.site-menu__figure'],
        ['caption', '[data-hs=mimg] figcaption', '.site-menu__caption'],
        ['caption text', '[data-hs=mimg] figcaption', '.site-menu__caption', 'text'],
        ['footer', '[data-hs=mfoot]', '.site-menu__foot'],
        ...[1, 2, 3, 4].map((i) => [`col ${i} label`, `[data-hs=mcol]:nth-child(${i}) > span:first-child`, `.site-menu__col:nth-child(${i}) .site-menu__label`, 'text']),
        ['phone', '[data-hs=mcol] a[href^="tel"]', '.site-menu__phone', 'text'],
        ['messenger 1', '[data-hs=mcol]:nth-child(2) [data-hs=mmsg]', '.site-menu__col:nth-child(2) .site-menu__social'],
        ['address', '[data-hs=mcol]:nth-child(3) > span:last-child', '.site-menu__address', 'text'],
        ['social 1', '[data-hs=mcol]:nth-child(4) [data-hs=mmsg]', '.site-menu__col:nth-child(4) .site-menu__social'],
      ],
    },
  },
};
