/**
 * Колонки Footer — аккордеон только на мобильном (<768), как в выгрузке:
 * открыта одна колонка, по умолчанию все закрыты. На десктопе колонки всегда открыты,
 * заголовки не нажимаются (кнопки выключены).
 * Без JS все колонки открыты (CSS сворачивает только при html.js).
 */
export function initFooter(root = document) {
  const groups = [...root.querySelectorAll('[data-footer-group]')];
  if (!groups.length) return () => {};
  const toggles = groups.map((g) => g.querySelector('[data-footer-toggle]'));
  const mobile = window.matchMedia('(max-width: 767px)');

  const setOpen = (btn, open) => btn.setAttribute('aria-expanded', String(open));

  function sync() {
    toggles.forEach((btn) => {
      btn.disabled = !mobile.matches;
      setOpen(btn, !mobile.matches);
    });
  }

  function onClick(e) {
    const btn = e.currentTarget;
    const open = btn.getAttribute('aria-expanded') !== 'true';
    toggles.forEach((other) => setOpen(other, other === btn && open));
  }

  toggles.forEach((btn) => btn.addEventListener('click', onClick));
  mobile.addEventListener('change', sync);
  sync();

  return () => {
    toggles.forEach((btn) => btn.removeEventListener('click', onClick));
    mobile.removeEventListener('change', sync);
  };
}
