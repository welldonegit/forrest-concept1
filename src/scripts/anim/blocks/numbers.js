/**
 * Numbers: появление и сцена прокрутки, как в выгрузке (секция Numbers v2, n2).
 *
 * Появление: строки заголовка — когда заголовок виден на 20%; карточки (шторка clip-path,
 * текст, графики) — когда ряд карточек вошёл в окно (нижние 8% окна не считаются).
 *
 * Сцена (≥900, раскладка — numbers.css). Прогресс p = прокрутка дорожки / (её высота − окно):
 * - карточки по очереди переворачиваются (0.06…0.41), на обороте — части панорамы;
 * - 0.42…0.54 — промежутки между карточками закрываются, внутренние углы оборота становятся прямыми;
 * - с 0.555 вместо карточек — панорама; 0.56…0.8 — она раскрывается до полной ширины и высоты
 *   окна − 48 и темнеет до 0.6;
 * - 0.8…0.93 — появляется калькулятор (снизу на 40px, масштаб 0.96 → 1; если он выше панорамы —
 *   уменьшается под неё), после 0.5 этого отрезка растут столбики.
 *
 * Отличия от выгрузки (разрешённые свойства, LAYOUT_RULES.md): карточки сдвигаются translate,
 * а не left; панорама сразу полного размера, рамку раскрытия даёт clip-path, а фото масштабируется
 * transform так, чтобы кадр совпадал с background-size:cover выгрузки; углы оборота — clip-path.
 * <900 — без сцены: столбики растут, когда верх панорамы поднялся выше 80% окна.
 */
const R = 28;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const seg = (p, a, b) => clamp01((p - a) / (b - a));
const io3 = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const eo = (t) => 1 - (1 - t) ** 3;
const lerp = (a, b, t) => a + (b - a) * t;
const px = (v) => `${v.toFixed(2)}px`;

export function init(root) {
  const title = root.querySelector('.nums__title');
  const stage = root.querySelector('[data-nums-stage]');
  const track = root.querySelector('[data-nums-track]');
  const cards = [...root.querySelectorAll('[data-nums-card]')];
  const flips = cards.map((c) => c.querySelector('[data-nums-flip]'));
  const backs = cards.map((c) => c.querySelector('[data-nums-back]'));
  const pano = root.querySelector('[data-nums-pano]');
  const img = root.querySelector('[data-nums-pano-img]');
  const dark = root.querySelector('[data-nums-dark]');
  const form = root.querySelector('[data-nums-form]');
  const calcEl = root.querySelector('[data-calc]');
  const sceneMq = window.matchMedia('(min-width: 900px) and (prefers-reduced-motion: no-preference)');
  const iw = +img.getAttribute('width') || 16;
  const ih = +img.getAttribute('height') || 9;

  root.dataset.motion = '';
  const observers = [];
  const once = (el, attr, opts) => {
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) { root.dataset[attr] = ''; io.disconnect(); }
    }, opts);
    io.observe(el);
    observers.push(io);
  };
  once(title, 'in', { threshold: 0.2 });
  once(stage, 'on', { threshold: 0, rootMargin: '0px 0px -8% 0px' });

  const bars = () => { if (!calcEl.hasAttribute('data-bars')) calcEl.dataset.bars = ''; };

  let g = null;
  let raf = 0;

  function clear() {
    cards.forEach((c, i) => {
      c.style.translate = ''; c.style.visibility = '';
      flips[i].style.transform = ''; backs[i].style.clipPath = '';
    });
    for (const el of [pano, img, dark, form]) el.removeAttribute('style');
  }

  function measure() {
    if (!sceneMq.matches) { g = null; clear(); return; }
    const cs = getComputedStyle(root);
    const y = window.scrollY;
    const tr = track.getBoundingClientRect();
    const W = stage.clientWidth;
    g = {
      vh: window.innerHeight, W,
      cw: cards[0].offsetWidth, ch: cards[0].offsetHeight, Hf: pano.offsetHeight,
      gap: parseFloat(cs.getPropertyValue('--nums-scene-gap')) || 16,
      dark: parseFloat(cs.getPropertyValue('--nums-dark')) || 0.6,
      pad: Math.max(16, W * 0.025),
      trackTop: tr.top + y, trackH: track.offsetHeight,
      fh: form.offsetHeight || 1,
    };
  }

  function frame() {
    raf = 0;
    if (!g) {
      if (pano.getBoundingClientRect().top < window.innerHeight * 0.8) bars();
      return;
    }
    const { vh, W, cw, ch, Hf, gap: G } = g;
    const p = clamp01((window.scrollY - g.trackTop) / (g.trackH - vh));
    const gl = io3(seg(p, 0.42, 0.54));
    const gap = G * (1 - gl);
    const rw = 3 * cw + 2 * gap;
    const xs = (W - rw) / 2;
    const sw = p >= 0.555;
    const ri = R * (1 - gl);

    cards.forEach((c, i) => {
      c.style.translate = `${px((i - 1) * (gap - G))} 0`;
      c.style.visibility = sw ? 'hidden' : '';
      const f = io3(seg(p, 0.06 + i * 0.075, 0.26 + i * 0.075));
      flips[i].style.transform = `rotateY(${(180 * f).toFixed(2)}deg) scale(${(1 - 0.06 * Math.sin(Math.PI * f)).toFixed(4)})`;
      const rad = i === 0 ? [R, ri, ri, R] : i === 2 ? [ri, R, R, ri] : [ri, ri, ri, ri];
      backs[i].style.clipPath = `inset(0 round ${rad.map(px).join(' ')})`;
    });

    const ex = io3(seg(p, 0.56, 0.8));
    const pw = lerp(rw, W, ex);
    const ph = lerp(ch, Hf, ex);
    const left = lerp(xs, 0, ex);
    const v = (Hf - ph) / 2;
    pano.style.opacity = sw ? '1' : '0';
    pano.style.clipPath = `inset(${px(v)} ${px(W - left - pw)} ${px(v)} ${px(left)} round ${R}px)`;
    // кадр фото как у cover в рамке pw×ph (центр рамки = центр панорамы)
    const k = Math.max(pw / iw, ph / ih) / Math.max(W / iw, Hf / ih);
    img.style.transform = `scale(${k.toFixed(4)})`;
    dark.style.opacity = (g.dark * ex).toFixed(3);

    const fp = eo(seg(p, 0.8, 0.93));
    const s = Math.min(1, (Hf - 2 * g.pad) / g.fh);
    form.style.transform = `translateY(${(40 * (1 - fp)).toFixed(1)}px) scale(${(s * lerp(0.96, 1, fp)).toFixed(4)})`;
    form.style.opacity = fp.toFixed(3);
    form.style.pointerEvents = fp > 0.6 ? 'auto' : 'none';
    if (fp > 0.5) bars();
  }

  const request = () => { if (!raf) raf = requestAnimationFrame(frame); };
  const refresh = () => { measure(); request(); };

  // Клавиатура: фокус попал в скрытый калькулятор — докрутить сцену до него
  form.addEventListener('focusin', () => {
    if (!g || parseFloat(form.style.opacity || '1') > 0.6) return;
    window.scrollTo({ top: g.trackTop + 0.95 * (g.trackH - g.vh), behavior: 'instant' });
  });

  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', refresh);
  sceneMq.addEventListener('change', refresh);
  const ro = new ResizeObserver(refresh);
  ro.observe(form);
  document.fonts?.ready.then(refresh);
  refresh();

  return () => {
    observers.forEach((io) => io.disconnect());
    ro.disconnect();
    window.removeEventListener('scroll', request);
    window.removeEventListener('resize', refresh);
    sceneMq.removeEventListener('change', refresh);
  };
}
