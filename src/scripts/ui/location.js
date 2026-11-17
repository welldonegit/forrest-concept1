/**
 * Location: карточка курорта у точки на карте.
 *
 * ≥768 — как в выгрузке: наведение и фокус с клавиатуры показывают её через CSS (location.css);
 * нажатие закрепляет — aria-expanded. Esc и нажатие мимо закрывают; после Esc карточка не
 * появляется снова, пока точка не потеряет фокус.
 *
 * <768 (решение 2026-11-17): на карте карточка обрезалась и уменьшалась вместе с картой. Нажатие
 * на точку переносит ту же карточку в <dialog> и открывает его поверх страницы (showModal: верхний
 * слой, ничем не обрезается; Esc и запирание фокуса — встроенные). Закрывают кнопка, нажатие вне
 * карточки и Esc; карточка возвращается на место, фокус — на точку.
 */
const mobile = window.matchMedia('(max-width: 767px)');

export function initLocation(root = document) {
  root.querySelectorAll('[data-loc-resort]').forEach((resort) => {
    const dot = resort.querySelector('[data-loc-dot]');
    const card = resort.querySelector('[data-loc-card]');
    const modal = resort.parentElement.querySelector('[data-loc-modal]');
    const set = (open) => dot.setAttribute('aria-expanded', String(open));
    const isModal = () => modal?.open;

    const openModal = () => {
      modal.append(card);
      modal.showModal();
      set(true);
      modal.querySelector('[data-loc-close]').focus();
    };

    if (modal) {
      modal.addEventListener('close', () => {
        dot.after(card);
        set(false);
        dot.focus({ preventScroll: true });
      });
      modal.querySelector('[data-loc-close]').addEventListener('click', () => modal.close());
      // нажатие вне карточки: цель — само окно (подложка ::backdrop принадлежит ему)
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.close();
      });
      // окно на телефоне, а экран стал шире (поворот) — закрыть, карточка вернётся на карту
      mobile.addEventListener('change', (e) => {
        if (!e.matches && isModal()) modal.close();
      });
    }

    dot.addEventListener('click', () => {
      dot.removeAttribute('data-dismissed');
      if (modal && mobile.matches) {
        openModal();
        return;
      }
      set(dot.getAttribute('aria-expanded') !== 'true');
    });
    dot.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      set(false);
      dot.dataset.dismissed = '';
    });
    dot.addEventListener('blur', () => dot.removeAttribute('data-dismissed'));
    document.addEventListener('pointerdown', (e) => {
      if (isModal()) return;
      if (dot.getAttribute('aria-expanded') === 'true' && !e.target.closest('[data-loc-resort]')) set(false);
    });
  });
}
