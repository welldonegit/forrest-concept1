/**
 * Infrastructure: появление, как в выгрузке — строки заголовка из маски, лента выезжает слева
 * и проявляется. Запуск — когда секция видна на 20%. Переходы — в infrastructure.css.
 */
const THRESHOLD = 0.2;

export function init(root) {
  root.dataset.motion = '';
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      root.dataset.in = '';
      io.disconnect();
    }
  }, { threshold: THRESHOLD });
  io.observe(root);
  return () => io.disconnect();
}
