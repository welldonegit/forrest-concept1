/**
 * Отложенный запуск скриптов дальних блоков (LAYOUT_RULES.md: скрипты не читают раскладку
 * далеко от окна; код блока не разбирается при загрузке страницы).
 * Модуль блока подгружается динамическим импортом и запускается, когда блок подходит
 * к экрану (запас — высота окна) или раньше, если в блок попал фокус (Tab, переход по якорю).
 * Разметка и вид до запуска — из CSS (`html.js`), скрипт только добавляет поведение.
 */
export function whenNear(selector, start, margin = '100% 0px') {
  const els = document.querySelectorAll(selector);
  if (!els.length) return;
  const run = (el) => {
    if (el.dataset.lazyInit !== undefined) return;
    el.dataset.lazyInit = '';
    io.unobserve(el);
    el.removeEventListener('focusin', onFocus);
    start(el);
  };
  const onFocus = (e) => run(e.currentTarget);
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => e.isIntersecting && run(e.target));
  }, { rootMargin: margin });
  els.forEach((el) => {
    io.observe(el);
    el.addEventListener('focusin', onFocus);
  });
}

/** Элементы по селектору внутри root, включая сам root. */
export function within(root, selector) {
  return root.matches?.(selector) ? [root] : [...root.querySelectorAll(selector)];
}
