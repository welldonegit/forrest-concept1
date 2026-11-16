/**
 * Hero: параллакс заголовка при прокрутке, как в выгрузке — заголовок уходит вверх
 * со скоростью 0.8 от прокрутки и гаснет к половине высоты окна.
 * Кадр стоит в начале страницы, поэтому сдвиг считается от scrollY без чтения размеров;
 * высота окна читается только при изменении размера.
 */
const SPEED = 0.8;
const FADE_AT = 0.5;

export function init(root) {
  const titles = root.querySelectorAll('[data-hero-title]');
  if (!titles.length) return () => {};
  let vh = window.innerHeight;
  let raf = 0;

  const frame = () => {
    raf = 0;
    const y = Math.max(0, window.scrollY);
    const t = `translate3d(0,${(-y * SPEED).toFixed(1)}px,0)`;
    const o = Math.max(0, 1 - y / (vh * FADE_AT)).toFixed(3);
    titles.forEach((el) => {
      el.style.transform = t;
      el.style.opacity = o;
    });
  };
  const onScroll = () => {
    if (!raf) raf = requestAnimationFrame(frame);
  };
  const onResize = () => {
    vh = window.innerHeight;
    onScroll();
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  onScroll();

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
  };
}
