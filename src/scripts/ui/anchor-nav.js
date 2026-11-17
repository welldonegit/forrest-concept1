/**
 * Переходы по якорям, как в выгрузке: плавная прокрутка, адрес обновляется без записи в историю;
 * из открытого меню — сначала закрыть меню, затем прокрутить (через 60 мс).
 * #top — к началу страницы. Фокус переносится на цель для клавиатуры и скринридеров.
 * Перед расчётом цели секции с content-visibility:auto (layout.css) отрисовываются целиком:
 * иначе их высота — оценка, и прокрутка останавливается не там.
 * Блоки по пути могут менять высоту, когда запускаются (колода Model на <768), поэтому
 * после остановки прокрутки цель проверяется и при сдвиге больше 2px — догоняется (до 2 раз).
 */
import { isMenuOpen, closeMenu } from './menu.js';

const MENU_CLOSE_DELAY = 60;
const SETTLE_IDLE = 150;   // прокрутка считается остановленной без событий scroll столько мс
const SETTLE_TRIES = 2;

function targetTop(target) {
  return target.getBoundingClientRect().top + window.scrollY;
}

// Ждёт остановки прокрутки и догоняет цель, если она сместилась.
function settle(target, behavior, tries = SETTLE_TRIES) {
  let t = 0;
  const done = () => {
    window.removeEventListener('scroll', onScroll);
    const off = target.getBoundingClientRect().top;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (Math.abs(off) > 2 && window.scrollY < max - 2 && tries > 0) {
      window.scrollTo({ top: targetTop(target), behavior });
      settle(target, behavior, tries - 1);
    }
  };
  const onScroll = () => { clearTimeout(t); t = setTimeout(done, SETTLE_IDLE); };
  window.addEventListener('scroll', onScroll, { passive: true });
  t = setTimeout(done, SETTLE_IDLE * 2);
}

export function initAnchorNav() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = decodeURIComponent(a.getAttribute('href').slice(1));
    if (!id) {
      e.preventDefault();
      return;
    }
    const target = document.getElementById(id);
    if (!target && id !== 'top') return;
    e.preventDefault();

    const go = () => {
      document.documentElement.dataset.cvOff = '';
      const behavior = reduce.matches ? 'auto' : 'smooth';
      const top = target && id !== 'top' ? targetTop(target) : 0;
      window.scrollTo({ top, behavior });
      if (target && id !== 'top') settle(target, behavior);
      history.replaceState(null, '', `#${id}`);
      if (target) {
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      }
    };

    if (isMenuOpen()) {
      closeMenu({ restoreFocus: false });
      setTimeout(go, MENU_CLOSE_DELAY);
    } else {
      go();
    }
  });
}
