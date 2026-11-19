/**
 * Полноэкранное меню Header: открытие из точки кнопки, блокировка прокрутки,
 * ловушка фокуса, Esc, возврат фокуса на кнопку открытия.
 */
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
/** Задержка перевода фокуса на «Закрити», как в выгрузке. */
const FOCUS_DELAY = 500;

let api = { isOpen: () => false, close: () => {} };
export const isMenuOpen = () => api.isOpen();
export const closeMenu = (opts) => api.close(opts);

export function initMenu(root = document) {
  const menu = root.querySelector('[data-menu]');
  const openBtn = root.querySelector('[data-menu-open]');
  if (!menu || !openBtn) return () => {};
  const closeBtn = menu.querySelector('[data-menu-close]');
  let timer;

  const isOpen = () => menu.hasAttribute('data-open');
  const prime = () => menu.setAttribute('data-primed', '');

  function open() {
    prime();
    const r = openBtn.getBoundingClientRect();
    menu.style.setProperty('--menu-x', `${r.left + r.width / 2}px`);
    menu.style.setProperty('--menu-y', `${r.top + r.height / 2}px`);
    document.body.style.overflow = 'hidden';
    menu.setAttribute('aria-hidden', 'false');
    openBtn.setAttribute('aria-expanded', 'true');
    // кадр на появление фото в раскладке, затем запуск переходов
    requestAnimationFrame(() => menu.setAttribute('data-open', ''));
    clearTimeout(timer);
    timer = setTimeout(() => closeBtn?.focus({ preventScroll: true }), FOCUS_DELAY);
  }

  function close({ restoreFocus = true } = {}) {
    if (!isOpen()) return;
    clearTimeout(timer);
    document.body.style.overflow = '';
    menu.removeAttribute('data-open');
    menu.setAttribute('aria-hidden', 'true');
    openBtn.setAttribute('aria-expanded', 'false');
    if (restoreFocus) openBtn.focus({ preventScroll: true });
  }

  function onKey(e) {
    if (!isOpen()) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key !== 'Tab') return;
    const items = [...menu.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const inside = menu.contains(document.activeElement);
    if (e.shiftKey && (document.activeElement === first || !inside)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
      e.preventDefault();
      first.focus();
    }
  }

  openBtn.addEventListener('pointerenter', prime, { once: true });
  openBtn.addEventListener('focus', prime, { once: true });
  openBtn.addEventListener('touchstart', prime, { once: true, passive: true });
  openBtn.addEventListener('click', open);
  closeBtn?.addEventListener('click', () => close());
  // Любая якорная ссылка меню закрывает его, как в выгрузке. Если у якоря есть цель,
  // anchor-nav закроет меню сам и прокрутит после паузы; этот вызов тогда ничего не делает.
  menu.addEventListener('click', (e) => {
    if (e.target.closest('a[href^="#"]')) setTimeout(() => close({ restoreFocus: false }), 0);
  });
  document.addEventListener('keydown', onKey);

  api = { isOpen, close };
  return () => {
    openBtn.removeEventListener('click', open);
    document.removeEventListener('keydown', onKey);
  };
}
