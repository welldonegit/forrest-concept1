/**
 * Ядро анимаций блоков.
 * Блок помечается data-anim-block="<имя>"; модуль src/scripts/anim/blocks/<имя>.js
 * экспортирует init(root, { gsap, ScrollTrigger }) и возвращает функцию очистки.
 * GSAP и ScrollTrigger загружаются один раз — когда к экрану подходит первый блок,
 * модуль которого объявил export const usesGsap = true. Блоки на CSS-переходах GSAP не тянут.
 * data-anim-eager — первый экран: запуск сразу, без ожидания.
 * prefers-reduced-motion: reduce — ничего не запускается, контент в конечном виде.
 */
const modules = import.meta.glob('./blocks/*.js');
let libs;

export function loadGsap() {
  libs ??= Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(([g, st]) => {
    const gsap = g.gsap ?? g.default;
    const { ScrollTrigger } = st;
    gsap.registerPlugin(ScrollTrigger);
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
    return { gsap, ScrollTrigger };
  });
  return libs;
}

async function start(el) {
  const load = modules[`./blocks/${el.dataset.animBlock}.js`];
  if (!load) return;
  const mod = await load();
  const lib = mod.usesGsap ? await loadGsap() : {};
  mod.init?.(el, lib);
}

export function initAnimations() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const blocks = document.querySelectorAll('[data-anim-block]');
  if (!blocks.length) return;
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        start(e.target);
      }
    },
    { rootMargin: '0px 0px 25% 0px' },
  );
  blocks.forEach((el) => (el.hasAttribute('data-anim-eager') ? start(el) : io.observe(el)));
}
