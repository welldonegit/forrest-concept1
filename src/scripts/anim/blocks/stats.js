/**
 * Stats: появление карточек, как в выгрузке — карточка раскрывается сверху вниз (clip-path),
 * фото опускается и уменьшается до места, текст проявляется с задержкой; шаг между
 * карточками 0.22s. Запуск — когда секция видна на 30%; страховка через 2.5s, если секция
 * уже на экране. Сами переходы — в stats.css; здесь только стартовое и конечное состояние.
 */
const THRESHOLD = 0.3;
const SAFETY_MS = 2500;

export function init(root) {
  root.dataset.reveal = 'pre';
  const show = () => {
    root.dataset.reveal = 'in';
    io.disconnect();
    clearTimeout(safety);
  };
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) show();
  }, { threshold: THRESHOLD });
  io.observe(root);
  const safety = setTimeout(() => {
    const r = root.getBoundingClientRect();
    if (r.top < window.innerHeight * 0.7 && r.bottom > 0) show();
  }, SAFETY_MS);

  return () => {
    io.disconnect();
    clearTimeout(safety);
  };
}
