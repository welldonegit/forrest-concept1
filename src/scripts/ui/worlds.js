/**
 * Worlds: сцена прокрутки, как в выгрузке (frameOne). Прогресс p = 0…1 — доля прокрутки
 * секции, со сглаживанием 0.055 за кадр. По p:
 *   0.03–0.30  центральная карточка разворачивается из своего места на весь кадр,
 *              боковые уходят под неё и гаснут (0.22–0.30); заголовок гаснет (0–0.16) и уходит вверх;
 *   0.26–0.33  проявляется текст;
 *   0.36–0.62  волной открывается ROCK, 0.68–0.94 — SUN; активный слайд и метка — по середине волны.
 *
 * Отличия от выгрузки — те же кадры другими свойствами (LAYOUT_RULES.md, этап 6; см. отчёт):
 * - карточки не меняют width/height/border-radius: они размером с развёрнутый кадр, видимая
 *   часть — clip-path inset(… round r), фото внутри — transform (translate + scale), как FLIP;
 * - вместо filter: brightness() в волне — чёрная вуаль с прозрачностью 1 − яркость (тот же цвет);
 * - размеры читаются только при загрузке и изменении окна, в кадре — только scrollY.
 * prefers-reduced-motion: сцена та же, но без движения — состояния сменяются скачком
 * по середине каждого перехода (вариант на подтверждение, см. отчёт).
 */
const SMOOTH = 0.055;      // доля пути до цели за кадр
const SNAP = 0.25;         // скачок прогресса больше — без сглаживания
const HEAD_SHIFT = 64;     // px: заголовок уходит вверх
const UNDER = 0.1;         // боковые карточки уходят под центральную: поле 10% с каждой стороны
const DIM = 0.18;          // в выгрузке brightness(0.82 → 1)
const WAVE_SCALE = 0.08;   // scale(1.08 → 1)
const WAVE_SHIFT = 3;      // translateY(3% → 0)

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const smooth = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, w: a.w + (b.w - a.w) * t, h: a.h + (b.h - a.h) * t });
const px = (v) => `${v.toFixed(2)}px`;

export function initWorlds(root = document) {
  const sec = root.querySelector('[data-worlds]');
  if (!sec) return () => {};
  const st = sec.querySelector('[data-worlds-stage]');
  const head = st.querySelector('[data-worlds-head]');
  const text = st.querySelector('[data-worlds-text]');
  const slides = [...st.querySelectorAll('[data-slide]')];
  const card = (k) => st.querySelector(`[data-card="${k}"]`);
  const cards = { l: card('l'), r: card('r'), c: card('c') };
  const reveals = [...st.querySelectorAll('[data-reveal-layer]')].map((el) => ({ el, dim: el.querySelector('.worlds__dim') }));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Фото: исходные пропорции и точка фокуса (hotspot) — для расчёта cover.
  const mediaOf = (el) => {
    const img = el.querySelector('img');
    return { el, iw: +img.getAttribute('width'), ih: +img.getAttribute('height'), fx: +img.dataset.fx, fy: +img.dataset.fy };
  };
  const base = { l: mediaOf(cards.l.querySelector('[data-media]')), r: mediaOf(cards.r.querySelector('[data-media]')), c: mediaOf(cards.c.querySelector(':scope > [data-media]')) };
  const revealMedia = reveals.map((r) => mediaOf(r.el.querySelector('[data-media]')));

  let g = null;   // геометрия: читается при загрузке и изменении размеров
  let ps = null;  // сглаженный прогресс
  let raf = 0;
  let active = -1;

  function measure() {
    const W = st.clientWidth;
    const H = st.clientHeight;
    const cs = getComputedStyle(st);
    const ip = parseFloat(cs.getPropertyValue('--worlds-card-inset'));
    const rad0 = parseFloat(cs.getPropertyValue('--worlds-card-radius-start'));
    const rad1 = parseFloat(cs.getPropertyValue('--worlds-card-radius-end'));
    const sr = st.getBoundingClientRect();
    const slot = (k) => {
      const r = st.querySelector(`[data-slot="${k}"]`).getBoundingClientRect();
      return { x: r.left - sr.left, y: r.top - sr.top, w: r.width, h: r.height };
    };
    const F = { x: ip, y: ip, w: W - ip * 2, h: H - ip * 2 };
    // Фото лежит как cover развёрнутого кадра; сдвиг и масштаб от этого положения — в кадре.
    const place = (m) => {
      m.s0 = Math.max(F.w / m.iw, F.h / m.ih);
      m.w0 = m.iw * m.s0;
      m.h0 = m.ih * m.s0;
      m.x0 = (F.w - m.w0) * m.fx;
      m.y0 = (F.h - m.h0) * m.fy;
      Object.assign(m.el.style, { left: px(m.x0), top: px(m.y0), width: px(m.w0), height: px(m.h0) });
    };
    [base.l, base.r, base.c, ...revealMedia].forEach(place);
    g = {
      F, rad0, rad1,
      slots: { l: slot('l'), c: slot('c'), r: slot('r') },
      top: sec.getBoundingClientRect().top + window.scrollY,
      total: Math.max(1, sec.offsetHeight - H),
    };
    sec.dataset.ready = '';
  }

  // Карточка: видимое окно rect (координаты кадра), фото — cover этого окна.
  function putCard(el, m, rect, radius, opacity) {
    const { F } = g;
    const t = rect.y - F.y;
    const l = rect.x - F.x;
    const b = F.y + F.h - (rect.y + rect.h);
    const r = F.x + F.w - (rect.x + rect.w);
    el.style.clipPath = `inset(${px(t)} ${px(r)} ${px(b)} ${px(l)} round ${px(radius)})`;
    if (opacity != null) el.style.opacity = opacity.toFixed(3);
    const s = Math.max(rect.w / m.iw, rect.h / m.ih);
    const x = l + (rect.w - m.iw * s) * m.fx;
    const y = t + (rect.h - m.ih * s) * m.fy;
    m.el.style.transform = `translate(${px(x - m.x0)},${px(y - m.y0)}) scale(${(s / m.s0).toFixed(5)})`;
  }

  // Волна: верхний край — синусоида, поднимается снизу; фото чуть уменьшается и поднимается.
  function wave({ el, dim }, r, seed) {
    if (r <= 0) {
      el.style.clipPath = 'inset(100% 0 0 0)';
      return;
    }
    if (r >= 1) {
      el.style.clipPath = 'none';
      el.style.transform = 'none';
      dim.style.opacity = '0';
      return;
    }
    const A = 5 * Math.pow(Math.sin(Math.PI * r), 1.4);
    const pts = [];
    for (let i = 0; i <= 64; i++) {
      const x = i / 64;
      const y = (1 - r) * 110 - 5 + A * Math.sin(x * Math.PI * 1.6 + r * 3.2 + seed) + A * 0.22 * Math.sin(x * Math.PI * 3.4 - r * 4 + seed);
      pts.push(`${(x * 100).toFixed(2)}% ${y.toFixed(2)}%`);
    }
    el.style.clipPath = `polygon(${pts.join(',')},100% 100%,0% 100%)`;
    el.style.transform = `scale(${(1 + WAVE_SCALE - WAVE_SCALE * r).toFixed(4)}) translateY(${((1 - r) * WAVE_SHIFT).toFixed(3)}%)`;
    dim.style.opacity = (DIM * (1 - r)).toFixed(3);
  }

  function setActive(k) {
    if (k === active) return;
    active = k;
    st.dataset.active = String(k);
    slides.forEach((s, i) => (s.inert = i !== k));
  }

  function frame() {
    raf = 0;
    if (!g) return;
    const target = clamp01((window.scrollY - g.top) / g.total);
    const still = reduced.matches;
    if (still || ps == null || Math.abs(target - ps) > SNAP) ps = target;
    else ps += (target - ps) * SMOOTH;
    if (!still && Math.abs(target - ps) > 0.0002) raf = requestAnimationFrame(frame);

    const p = ps;
    // Без движения: переход срабатывает целиком в своей середине.
    const m = (a, b) => (still ? (p >= (a + b) / 2 ? 1 : 0) : clamp01((p - a) / (b - a)));
    const e = ease(m(0.03, 0.3));
    const { F, slots, rad0, rad1 } = g;

    const C = lerp(slots.c, F, e);
    const under = { x: C.x + C.w * UNDER, y: C.y + C.h * UNDER, w: C.w * (1 - 2 * UNDER), h: C.h * (1 - 2 * UNDER) };
    const side = 1 - m(0.22, 0.3);
    putCard(cards.c, base.c, C, rad0 + (rad1 - rad0) * e);
    putCard(cards.l, base.l, lerp(slots.l, under, e), rad0, side);
    putCard(cards.r, base.r, lerp(slots.r, under, e), rad0, side);

    head.style.opacity = (1 - m(0, 0.16)).toFixed(3);
    head.style.transform = `translateY(${px(-e * HEAD_SHIFT)})`;
    const to = m(0.26, 0.33);
    text.style.opacity = to.toFixed(3);
    text.inert = to < 0.5;

    const r1 = smooth(m(0.36, 0.62));
    const r2 = smooth(m(0.68, 0.94));
    wave(reveals[0], r1, 0);
    wave(reveals[1], r2, 1.7);
    setActive(r2 > 0.5 ? 2 : r1 > 0.5 ? 1 : 0);
  }

  const onScroll = () => {
    if (!raf) raf = requestAnimationFrame(frame);
  };
  const onResize = () => {
    measure();
    onScroll();
  };

  measure();
  frame();
  window.addEventListener('scroll', onScroll, { passive: true });
  const ro = new ResizeObserver(onResize);
  ro.observe(st);
  document.fonts?.ready.then(onResize);
  reduced.addEventListener?.('change', onScroll);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('scroll', onScroll);
    ro.disconnect();
  };
}
