/**
 * Переключатель языка: раскрытие списка, закрытие по клику вне, Esc и уходу фокуса.
 * Пункты — обычные ссылки на /<язык>/.
 */
export function initLangSwitch(root = document) {
  root.querySelectorAll('[data-lang-switch]').forEach((sw) => {
    const btn = sw.querySelector('[data-lang-toggle]');
    if (!btn) return;
    const set = (open) => {
      sw.toggleAttribute('data-open', open);
      btn.setAttribute('aria-expanded', String(open));
    };
    const isOpen = () => sw.hasAttribute('data-open');

    btn.addEventListener('click', () => set(!isOpen()));
    document.addEventListener('click', (e) => {
      if (isOpen() && !sw.contains(e.target)) set(false);
    });
    sw.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen()) {
        e.stopPropagation();
        set(false);
        btn.focus();
      }
    });
    sw.addEventListener('focusout', (e) => {
      if (isOpen() && e.relatedTarget && !sw.contains(e.relatedTarget)) set(false);
    });
  });
}
