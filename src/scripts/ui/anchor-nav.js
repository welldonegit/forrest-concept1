/**
 * Переходы по якорям, как в выгрузке: плавная прокрутка, адрес обновляется без записи в историю;
 * из открытого меню — сначала закрыть меню, затем прокрутить (через 60 мс).
 * #top — к началу страницы. Фокус переносится на цель для клавиатуры и скринридеров.
 * Перед расчётом цели секции с content-visibility:auto (layout.css) отрисовываются целиком:
 * иначе их высота — оценка, и прокрутка останавливается не там.
 */
import { isMenuOpen, closeMenu } from './menu.js';

const MENU_CLOSE_DELAY = 60;

function targetTop(target) {
  return target.getBoundingClientRect().top + window.scrollY;
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
