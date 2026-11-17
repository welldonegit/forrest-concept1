/**
 * Apartments: бесконечная лента, как в выгрузке (aptLoop, aptProg, aptClick).
 * - Карточки копируются слева и справа (копии скрыты от экранных дикторов и фокуса);
 *   после остановки прокрутки лента незаметно переносится так, чтобы первой стояла
 *   настоящая карточка (в выгрузке первой могла остаться копия).
 * - Стрелки листают на одну карточку; мышью ленту можно тянуть (с привязкой к карточке).
 * - Полоса: бегунок шириной 1/N показывает положение; по полосе можно кликнуть или тянуть.
 * Работает и при prefers-reduced-motion (это управление, а не анимация).
 * TODO: письмо справа налево — scrollLeft в RTL отрицательный, перепроверить при включении.
 */
const NORM_DELAY = 160;

function initTrack(root) {
  const track = root.querySelector('[data-apts-track]');
  const thumb = root.querySelector('[data-apts-thumb]');
  const bar = root.querySelector('[data-apts-bar]');
  const end = track.querySelector('.apts__end');
  const orig = [...track.querySelectorAll('[data-apts-card]')];
  const N = orig.length;
  if (N < 2) return;

  const clone = (card) => {
    const c = card.cloneNode(true);
    c.setAttribute('aria-hidden', 'true');
    c.querySelectorAll('button').forEach((b) => { b.tabIndex = -1; });
    c.dataset.clone = '';
    return c;
  };
  orig.forEach((c) => track.insertBefore(clone(c), orig[0]));
  orig.forEach((c) => track.insertBefore(clone(c), end));
  track.dataset.js = '';

  const W = () => orig[0].offsetLeft - track.firstElementChild.offsetLeft; // ширина одного набора
  const step = () => orig[1].offsetLeft - orig[0].offsetLeft;
  const jump = (left) => {
    track.style.scrollBehavior = 'auto';
    track.scrollLeft = left;
    track.style.scrollBehavior = '';
  };
  const norm = () => {
    const w = W();
    const half = step() / 2;
    if (!w) return;
    if (track.scrollLeft < w - half) jump(track.scrollLeft + w);
    else if (track.scrollLeft >= 2 * w - half) jump(track.scrollLeft - w);
  };

  const progress = () => {
    const w = W();
    if (!w) return;
    const share = 1 / N;
    const t = ((((track.scrollLeft - w) % w) + w) % w) / w;
    const x = Math.min(1, t / ((N - 1) / N)) * (1 - share);
    thumb.style.transform = `translateX(${((x / share) * 100).toFixed(2)}%)`;
  };

  let drag = false;
  let tm = 0;
  track.addEventListener('scroll', () => {
    progress();
    clearTimeout(tm);
    if (!drag) tm = setTimeout(norm, NORM_DELAY);
  }, { passive: true });

  // Стрелки
  root.querySelectorAll('[data-apts-dir]').forEach((btn) => {
    btn.addEventListener('click', () => {
      track.scrollBy({ left: Number(btn.dataset.aptsDir) * step(), behavior: 'smooth' });
    });
  });

  // Перетаскивание мышью
  let x0 = 0;
  let l0 = 0;
  let moved = false;
  track.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    drag = true; moved = false; x0 = e.clientX; l0 = track.scrollLeft;
    track.dataset.drag = '';
    track.style.scrollBehavior = 'auto';
  });
  window.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - x0;
    if (Math.abs(dx) > 5) moved = true;
    track.scrollLeft = l0 - dx;
  });
  window.addEventListener('pointerup', () => {
    if (!drag) return;
    drag = false;
    delete track.dataset.drag;
    track.style.scrollBehavior = '';
    if (moved) {
      const s = step();
      track.scrollTo({ left: Math.round(track.scrollLeft / s) * s, behavior: 'smooth' });
      setTimeout(norm, 700);
    }
  });
  // после перетаскивания клик по фото/кнопке не срабатывает
  track.addEventListener('click', (e) => {
    if (!moved) return;
    e.stopPropagation(); e.preventDefault(); moved = false;
  }, true);
  track.addEventListener('dragstart', (e) => e.preventDefault());

  // Полоса: клик и перетаскивание бегунка
  let barDown = false;
  const goBar = (e) => {
    const r = bar.getBoundingClientRect();
    const share = 1 / N;
    const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width - share / 2)) / (1 - share);
    jump(W() + Math.round(x * (N - 1)) * step());
  };
  bar.addEventListener('pointerdown', (e) => { barDown = true; bar.setPointerCapture(e.pointerId); goBar(e); });
  bar.addEventListener('pointermove', (e) => { if (barDown) goBar(e); });
  bar.addEventListener('pointerup', () => { barDown = false; });

  const fit = () => { jump(W() + Math.round(((track.scrollLeft - W()) / (step() || 1))) * step()); norm(); progress(); };
  jump(W());
  progress();
  window.addEventListener('resize', fit);
  document.fonts?.ready.then(fit);
}

export function initApartments() {
  document.querySelectorAll('[data-apts]').forEach(initTrack);
}
