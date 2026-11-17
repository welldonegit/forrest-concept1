/**
 * Location: карточка курорта у точки на карте.
 * Наведение и фокус с клавиатуры показывают её через CSS (location.css); нажатие (касание)
 * закрепляет — aria-expanded. Esc и нажатие мимо закрывают; после Esc карточка не
 * появляется снова, пока точка не потеряет фокус.
 */
export function initLocation(root = document) {
  root.querySelectorAll('[data-loc-dot]').forEach((dot) => {
    const set = (open) => dot.setAttribute('aria-expanded', String(open));
    dot.addEventListener('click', () => {
      dot.removeAttribute('data-dismissed');
      set(dot.getAttribute('aria-expanded') !== 'true');
    });
    dot.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      set(false);
      dot.dataset.dismissed = '';
    });
    dot.addEventListener('blur', () => dot.removeAttribute('data-dismissed'));
    document.addEventListener('pointerdown', (e) => {
      if (dot.getAttribute('aria-expanded') === 'true' && !e.target.closest('[data-loc-resort]')) set(false);
    });
  });
}
