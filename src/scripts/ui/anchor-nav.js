/**
 * Переходы по якорям, как в выгрузке: плавная прокрутка, адрес обновляется без записи в историю;
 * из открытого меню — сначала закрыть меню, затем прокрутить (через 60 мс).
 * #top — к началу страницы. Фокус переносится на цель для клавиатуры и скринридеров.
 */
import { isMenuOpen, closeMenu } from './menu.js';

const MENU_CLOSE_DELAY = 60;

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
      const top = target && id !== 'top' ? target.getBoundingClientRect().top + window.scrollY : 0;
      window.scrollTo({ top, behavior: reduce.matches ? 'auto' : 'smooth' });
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
