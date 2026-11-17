/**
 * Apartments: появление, как в выгрузке — строки заголовка поднимаются из маски,
 * стрелки и полоса проявляются снизу, карточки по очереди (шаг 0.12s) опускаются
 * на место и раскрываются clip-path сверху вниз. Запуск — когда лента видна на 12%.
 * Переходы — в apartments.css; копии карточек ленты получают тот же порядок.
 */
const THRESHOLD = 0.12;

export function init(root) {
  root.dataset.reveal = 'pre';
  const track = root.querySelector('[data-apts-track]');
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      root.dataset.reveal = 'in';
      io.disconnect();
    }
  }, { threshold: THRESHOLD });
  io.observe(track);
  return () => io.disconnect();
}
