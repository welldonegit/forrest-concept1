/**
 * Form: появление, как в выгрузке — строки заголовка из маски, абзац снизу, три карточки
 * по очереди раскрываются clip-path сверху (фото внутри уменьшается с 1.3), карточка
 * эксперта проявляется последней; тёмная панель раскрывается clip-path, поля — по очереди.
 * Запуск — когда секция видна на 15%. Переходы — в form.css.
 *
 * Отличие от выгрузки (LAYOUT_RULES.md, этап 6): у абзаца нет blur(6px) — filter
 * не анимируем в сценариях прокрутки.
 */
const THRESHOLD = 0.15;

export function init(root) {
  root.dataset.reveal = 'pre';
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      root.dataset.reveal = 'in';
      io.disconnect();
    }
  }, { threshold: THRESHOLD });
  io.observe(root);
  return () => io.disconnect();
}
