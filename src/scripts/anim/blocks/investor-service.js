/**
 * Investor Service: появление и сцена прокрутки, как в выгрузке (секция Investor Service, data-sv).
 *
 * Заголовок и лид — когда заголовок виден на 25%.
 *
 * Сцена (≥900, раскладка — investor-service.css). Прогресс p складывается из подхода дорожки
 * к окну (до 0.32) и прокрутки внутри неё (до 0.893):
 * - 0…0.26 — ноутбук всплывает (снизу на 14vh, масштаб 0.84 → 1), 0.06…0.3 — открывается крышка;
 * - 0.22…0.5 — экран оживает: числа считаются от 0, рисуется линия графика, заливка, кольцо,
 *   строки отчётов и бронирований въезжают справа; блик проходит по экрану;
 * - 0.3…0.46 — телефон выезжает справа снизу;
 * - 0.44…0.56 — подпись «01» под ноутбуком;
 * - 0.46…0.79 — карточки 02–07 по очереди вылетают из центра на свои места (масштаб 0.72 → 1).
 * Мышь над сценой слегка поворачивает ноутбук (только точный указатель, ≥900).
 * <900 — без прилипания: ноутбук и карточки появляются по мере подхода к окну.
 *
 * Отличия от выгрузки (LAYOUT_RULES.md): блик — сдвиг слоя transform вместо background-position;
 * пульс точки «Онлайн» — отдельный круг (transform, opacity) вместо box-shadow; размытие карточек
 * при появлении — только ≥1280, как у текста Model (решение 2026-11-17).
 */
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const seg = (p, a, b) => clamp01((p - a) / (b - a));
const eo = (t) => 1 - (1 - t) ** 3;
const e4 = (t) => 1 - (1 - t) ** 4;
const io3 = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const group = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

export function init(root) {
  const q = (s) => root.querySelector(s);
  const qa = (s) => [...root.querySelectorAll(s)];
  const head = q('[data-svc-head]');
  const track = q('[data-svc-track]');
  const stick = q('[data-svc-stick]');
  const grid = q('[data-svc-grid]');
  const par = q('[data-svc-par]');
  const lap = q('[data-svc-lap]');
  const lid = q('[data-svc-lid]');
  const glow = q('[data-svc-glow]');
  const glare = q('[data-svc-glare]');
  const phone = q('[data-svc-phone]');
  const cap = q('[data-svc-cap]');
  const path = q('[data-svc-path]');
  const area = q('[data-svc-area]');
  const ring = q('[data-svc-ring]');
  const nums = qa('[data-svc-num]');
  const rows = qa('[data-svc-row]');
  const cards = qa('[data-svc-card]').sort((a, b) => a.dataset.k - b.dataset.k);
  const ringTo = parseFloat(ring.style.getPropertyValue('--ring')) || 0;

  const sceneMq = window.matchMedia('(min-width: 900px)');
  const blurMq = window.matchMedia('(min-width: 1280px)');
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');

  root.dataset.motion = '';
  const io = new IntersectionObserver((es) => {
    if (es.some((e) => e.isIntersecting)) { root.dataset.in = ''; io.disconnect(); }
  }, { threshold: 0.25 });
  io.observe(head);

  // Экран мока: s — 0…1
  const screenAt = (s) => {
    const e = e4(s);
    nums.forEach((n) => { n.textContent = `${n.dataset.pre}${group(+n.dataset.to * e)}${n.dataset.suf}`; });
    path.style.strokeDashoffset = (1 - io3(s)).toFixed(4);
    area.style.opacity = eo(seg(s, 0.4, 1)).toFixed(3);
    ring.style.strokeDashoffset = (1 - ringTo * e).toFixed(4);
    rows.forEach((r, i) => {
      const t = eo(seg(s, 0.2 + (i % 3) * 0.15, 0.6 + (i % 3) * 0.15));
      r.style.opacity = t.toFixed(3);
      r.style.transform = `translateX(${(1.5 * (1 - t)).toFixed(2)}em)`;
    });
  };
  const lapAt = (p) => {
    const a = e4(seg(p, 0, 0.26));
    const l = io3(seg(p, 0.06, 0.3));
    const ph = e4(seg(p, 0.3, 0.46));
    const gl = seg(p, 0.22, 0.5);
    lap.style.opacity = a.toFixed(3);
    lap.style.transform = `translateY(${(14 * (1 - a)).toFixed(2)}vh) scale(${(0.84 + 0.16 * a).toFixed(4)})`;
    lid.style.transform = `rotateX(${(-88 * (1 - l)).toFixed(2)}deg)`;
    glow.style.opacity = l.toFixed(3);
    // background-position 100% → 0% у слоя 250% = сдвиг −60% → 0
    glare.style.transform = `translateX(${(-60 * (1 - gl)).toFixed(2)}%)`;
    phone.style.opacity = ph.toFixed(3);
    phone.style.transform = `translate(${(10 * (1 - ph)).toFixed(2)}em, ${(6 * (1 - ph)).toFixed(2)}em) rotate(${(6 * (1 - ph)).toFixed(2)}deg)`;
    screenAt(gl);
  };

  let off = [];
  const measure = () => {
    if (!sceneMq.matches) { off = []; return; }
    const g = grid.getBoundingClientRect();
    const cx = g.left + g.width / 2;
    const cy = g.top + g.height / 2;
    off = cards.map((c) => {
      const t = c.style.transform;
      c.style.transform = 'none';
      const r = c.getBoundingClientRect();
      c.style.transform = t;
      return [cx - (r.left + r.width / 2), cy - (r.top + r.height / 2)];
    });
  };

  let raf = 0;
  const frame = () => {
    raf = 0;
    const vh = window.innerHeight;
    if (!sceneMq.matches) {
      const r = lap.getBoundingClientRect();
      lapAt(clamp01((vh * 0.95 - r.top) / (vh * 0.8)) * 0.55);
      cap.style.opacity = '1';
      cap.style.transform = 'none';
      cards.forEach((c) => {
        const t = e4(clamp01((vh * 0.96 - c.getBoundingClientRect().top) / (vh * 0.3)));
        c.style.opacity = t.toFixed(3);
        c.style.filter = '';
        c.style.transform = `translateY(${(48 * (1 - t)).toFixed(1)}px) scale(${(0.96 + 0.04 * t).toFixed(4)})`;
      });
      return;
    }
    const tr = track.getBoundingClientRect();
    const pre = clamp01((vh * 0.9 - tr.top) / (vh * 0.9));
    const p = pre * 0.32 + clamp01(-tr.top / (track.offsetHeight - vh)) * 0.573;
    lapAt(p);
    const cp = eo(seg(p, 0.44, 0.56));
    cap.style.opacity = cp.toFixed(3);
    cap.style.transform = `translateY(${(20 * (1 - cp)).toFixed(1)}px)`;
    cards.forEach((c, k) => {
      const t = e4(seg(p, 0.46 + k * 0.033, 0.592 + k * 0.033));
      const [ox, oy] = off[k] || [0, 0];
      const m = (1 - t) * 0.55;
      c.style.opacity = t.toFixed(3);
      c.style.filter = blurMq.matches && t < 0.999 ? `blur(${(14 * (1 - t)).toFixed(2)}px)` : '';
      c.style.transform = `translate(${(ox * m).toFixed(1)}px, ${(oy * m).toFixed(1)}px) scale(${(0.72 + 0.28 * t).toFixed(4)})`;
    });
  };
  const request = () => { if (!raf) raf = requestAnimationFrame(frame); };
  const refresh = () => { measure(); request(); };

  const tilt = (e) => {
    if (!sceneMq.matches) return;
    const x = e.clientX / window.innerWidth - 0.5;
    const y = e.clientY / window.innerHeight - 0.5;
    par.style.transform = `perspective(1800px) rotateY(${(x * 5).toFixed(2)}deg) rotateX(${(-y * 4).toFixed(2)}deg)`;
  };
  const untilt = () => { par.style.transform = ''; };
  if (fine.matches) {
    stick.addEventListener('pointermove', tilt);
    stick.addEventListener('pointerleave', untilt);
  }

  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', refresh);
  sceneMq.addEventListener('change', refresh);
  document.fonts?.ready.then(refresh);
  refresh();
  const late = setTimeout(refresh, 400);

  return () => {
    io.disconnect();
    clearTimeout(late);
    window.removeEventListener('scroll', request);
    window.removeEventListener('resize', refresh);
    sceneMq.removeEventListener('change', refresh);
    stick.removeEventListener('pointermove', tilt);
    stick.removeEventListener('pointerleave', untilt);
  };
}
