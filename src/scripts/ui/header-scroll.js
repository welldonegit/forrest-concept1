/**
 * Шапка при прокрутке (решение 2026-11-24): вниз — уезжает за верх окна, при любой прокрутке
 * вверх — возвращается; у верха страницы видна всегда. Движение — только transform
 * (header.css, [data-hidden]). В обработчике прокрутки читается лишь scrollY, раскладка — нет:
 * высота шапки меряется при запуске и при изменении размера окна.
 * Не прячется, пока открыто меню или список языков и пока фокус с клавиатуры внутри шапки.
 * Переход по якорю (anchor-nav.js) прячет шапку до конца прокрутки, чтобы заголовок секции
 * не оказался под ней.
 */
import { isMenuOpen } from './menu.js';

/** Порог, px: столько нужно прокрутить в одну сторону, чтобы шапка спряталась или вернулась. */
const THRESHOLD = 8;
/** Запас на конец программной прокрутки, если браузер не знает события scrollend. */
const SCROLL_END_FALLBACK = 150;

let api = { hold: () => {} };
/** Анкорный переход к точке y: шапка прячется (если цель не у верха) и не реагирует на эту прокрутку. */
export const holdHeaderFor = (y) => api.hold(y);

export function initHeaderScroll() {
  const header = document.querySelector('.site-header');
  if (!header) return;
  const langSwitch = header.querySelector('[data-lang-switch]');

  let topZone = header.offsetHeight;
  let lastY = Math.max(0, window.scrollY);
  let acc = 0;
  let ticking = false;
  let held = false;
  let releaseTimer;

  const keepVisible = () =>
    isMenuOpen() || langSwitch?.hasAttribute('data-open') || header.querySelector(':focus-visible') !== null;

  const set = (hide) => header.toggleAttribute('data-hidden', hide);

  function update() {
    ticking = false;
    const y = Math.max(0, window.scrollY);
    const d = y - lastY;
    lastY = y;
    if (held) return;
    if (y <= topZone) {
      acc = 0;
      set(false);
      return;
    }
    if (d === 0) return;
    if (d > 0 !== acc > 0) acc = 0;
    acc += d;
    if (acc > THRESHOLD) set(!keepVisible());
    else if (acc < -THRESHOLD) set(false);
  }

  function release() {
    held = false;
    lastY = Math.max(0, window.scrollY);
    acc = 0;
  }

  function onScroll() {
    if (held && !('onscrollend' in window)) {
      clearTimeout(releaseTimer);
      releaseTimer = setTimeout(release, SCROLL_END_FALLBACK);
    }
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('scrollend', () => held && release());
  window.addEventListener('resize', () => {
    topZone = header.offsetHeight;
  });
  // фокус с клавиатуры пришёл в спрятанную шапку — показать
  header.addEventListener('focusin', (e) => {
    if (e.target.matches(':focus-visible')) set(false);
  });

  // страница открылась не у верха (ссылка с якорем, восстановление прокрутки) — шапка спрятана
  set(lastY > topZone);

  api = {
    hold(y) {
      if (y <= topZone) {
        set(false);
        return;
      }
      set(true);
      held = true;
      clearTimeout(releaseTimer);
      // уже на месте — прокрутки и scrollend не будет
      if (Math.abs(y - window.scrollY) < 1) releaseTimer = setTimeout(release, SCROLL_END_FALLBACK);
    },
  };
}
