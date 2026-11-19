/**
 * Общая доступность попапов (4.17) на нативном <dialog> (showModal):
 * - страница под окном недоступна (inert верхнего слоя), фокус переходит внутрь и не выходит
 *   по Tab/Shift+Tab (перебор по кругу внутри окна);
 * - Esc (событие cancel), нажатие на подложку и кнопки [data-popup-close] закрывают окно;
 * - фокус возвращается на кнопку, которая открыла окно;
 * - страница под окном не прокручивается (класс на <html>, popup.css).
 * Анимация закрытия: beforeClose() возвращает Promise — окно закрывается, когда она закончилась.
 */

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),iframe,[tabindex]:not([tabindex="-1"])';
const LOCK = 'is-pop-locked';
const shown = (el) => (el.checkVisibility ? el.checkVisibility({ visibilityProperty: true }) : el.getClientRects().length > 0);

export function createModal(dlg, { beforeClose, onClosed } = {}) {
  let back = null;
  let closing = null;

  function open(from) {
    back = from;
    document.documentElement.classList.add(LOCK);
    dlg.showModal();
  }

  function close() {
    if (!dlg.open) return Promise.resolve();
    closing ??= Promise.resolve(beforeClose?.()).then(() => { if (dlg.open) dlg.close(); });
    return closing;
  }

  dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  dlg.addEventListener('close', () => {
    closing = null;
    document.documentElement.classList.remove(LOCK);
    onClosed?.();
    const to = back;
    back = null;
    to?.focus({ preventScroll: true });
  });
  dlg.addEventListener('click', (e) => {
    const t = e.target;
    if (t === dlg || t.hasAttribute?.('data-popup-backdrop') || t.closest?.('[data-popup-close]')) close();
  });
  dlg.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const items = [...dlg.querySelectorAll(FOCUSABLE)].filter(shown);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const at = document.activeElement;
    if (e.shiftKey && (at === first || !dlg.contains(at))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (at === last || !dlg.contains(at))) { e.preventDefault(); first.focus(); }
  });

  return { open, close };
}
