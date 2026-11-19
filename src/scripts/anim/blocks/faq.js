/**
 * FAQ: появление, как в выгрузке — строки заголовка из маски (вторая с задержкой .12s),
 * вопросы снизу по очереди (шаг .07s), карточка снизу с лёгким увеличением.
 * Шапка, список и карточка запускаются отдельно, когда каждый виден на 12%. Переходы — в faq.css.
 */
const THRESHOLD = 0.12;

export function init(root) {
  const targets = ['[data-faq-head]', '[data-faq-list]', '[data-faq-aside]']
    .map((s) => root.querySelector(s))
    .filter(Boolean);
  root.dataset.reveal = 'pre';
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.dataset.in = '';
      io.unobserve(e.target);
    });
  }, { threshold: THRESHOLD });
  targets.forEach((t) => io.observe(t));
  return () => io.disconnect();
}
