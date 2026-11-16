/**
 * Hero: сезонный переключатель (iris лето/зима), контур зданий для переднего плана,
 * положение кнопки сезона на мобильном. Всё считается при загрузке и при изменении
 * размера кадра, не в обработчиках прокрутки.
 */

// Геометрия iris из выгрузки: центр круга — центр кнопки сезона по формулам её размера
// и отступов (D — диаметр, R — отступ справа, B — снизу), от ширины окна.
const clamp = (min, v, max) => Math.min(max, Math.max(min, v));
function irisCenter(w, h, vw) {
  const D = clamp(84, vw * 0.081, 120);
  const R = clamp(16, vw * 0.032, 40);
  const B = clamp(40, 108 - (vw - 600) * 0.24, 108);
  return [w - R - D / 2, h - B - D / 2];
}

/** Контур зданий: точки в пикселях фото → координаты кадра при object-fit: cover. */
function skylinePolygon(sky, w, h) {
  const s = Math.max(w / sky.width, h / sky.height);
  const ox = (w - sky.width * s) / 2;
  const oy = (h - sky.height * s) / 2;
  return `polygon(${sky.points.map(([x, y]) => `${(x * s + ox).toFixed(1)}px ${(y * s + oy).toFixed(1)}px`).join(',')})`;
}

export function initHero(root = document) {
  const frame = root.querySelector('[data-hero]');
  if (!frame) return () => {};
  const btn = frame.querySelector('[data-hero-season]');
  const label = frame.querySelector('[data-hero-season-label]');
  const content = frame.querySelector('[data-hero-content]');
  const deferred = frame.querySelectorAll('[data-hero-deferred]');
  const sky = JSON.parse(frame.dataset.skyline || 'null');
  const mobile = window.matchMedia('(max-width: 767px)');

  // Летнее фото — только когда понадобится (наведение, фокус, касание, клик).
  let primed;
  const prime = () => {
    primed ??= Promise.all([...deferred].map((img) => {
      img.srcset = img.dataset.srcset;
      img.src = img.dataset.src;
      return img.decode().catch(() => {});
    }));
    return primed;
  };

  function layout() {
    const w = frame.clientWidth;
    const h = frame.clientHeight;
    if (sky) frame.style.setProperty('--skyline', skylinePolygon(sky, w, h));
    const [x, y] = irisCenter(w, h, window.innerWidth);
    frame.style.setProperty('--iris-x', `${x}px`);
    frame.style.setProperty('--iris-y', `${y}px`);
    // На мобильном кнопка стоит над текстом: на 16px выше его верхнего края (как в выгрузке).
    if (mobile.matches && content) {
      // offsetTop не зависит от transform появления текста.
      const offset = Math.round(h - content.offsetTop + 16);
      frame.style.setProperty('--hero-season-bottom', `${offset}px`);
    } else {
      frame.style.removeProperty('--hero-season-bottom');
    }
  }

  async function toggle() {
    await prime();
    const winter = frame.dataset.season !== 'winter';
    frame.dataset.season = winter ? 'winter' : 'summer';
    if (label) label.textContent = winter ? btn.dataset.toSummer : btn.dataset.toWinter;
  }

  btn?.addEventListener('pointerenter', prime, { once: true });
  btn?.addEventListener('focus', prime, { once: true });
  btn?.addEventListener('touchstart', prime, { once: true, passive: true });
  btn?.addEventListener('click', toggle);

  // кадр и блок текста: позиция кнопки на мобильном зависит от высоты текста
  const ro = new ResizeObserver(layout);
  ro.observe(frame);
  if (content) ro.observe(content);
  document.fonts?.ready.then(layout);
  layout();

  // Hero вне экрана — «дыхание» кнопки и пульс колец на паузе (hero.css).
  const io = new IntersectionObserver(([e]) => {
    frame.toggleAttribute('data-offscreen', !e.isIntersecting);
  });
  io.observe(frame);

  return () => {
    io.disconnect();
    ro.disconnect();
    btn?.removeEventListener('click', toggle);
  };
}
