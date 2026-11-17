/**
 * Infrastructure: лента карточек, как в выгрузке.
 * - Бесконечная: за карточками идут копии; прокрутка за набор переносится на набор назад.
 * - Сама медленно едет (скорость --infra-speed, px/мс). Пауза: мышь над лентой, фокус
 *   внутри, колесо (1.8 с), касание (2.5 с), перетаскивание (1.5 с). Едет, только пока лента
 *   на экране и вкладка открыта. При prefers-reduced-motion сама не едет.
 * - Мышью ленту можно тянуть; клик после перетаскивания не срабатывает.
 * - Кнопка «i» (телефон, сенсор): открывает плашку карточки, закрывает остальные;
 *   нажатие на открытую плашку или Esc — закрывает.
 */
const PAUSE = { wheel: 1800, touch: 2500, drag: 1500 };
const DRAG_MIN = 4;
const MAX_FRAME = 64;

function initRibbon(section) {
  const track = section.querySelector('[data-infra-track]');
  const row = section.querySelector('[data-infra-row]');
  if (!track || !row) return;
  const first = row.querySelector('li:not([data-clone])');
  const firstClone = row.querySelector('li[data-clone]');
  const setWidth = () => (first && firstClone ? firstClone.offsetLeft - first.offsetLeft : row.scrollWidth / 2);

  const wrap = () => {
    const w = setWidth();
    if (w <= 0) return;
    if (track.scrollLeft >= w) track.scrollLeft -= w;
    else if (track.scrollLeft <= 0) track.scrollLeft += w;
  };
  track.addEventListener('scroll', wrap, { passive: true });
  track.scrollLeft = 1;

  // перетаскивание мышью
  let drag = null;
  track.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    drag = { x: e.clientX, left: track.scrollLeft, moved: false };
  });
  window.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > DRAG_MIN) { drag.moved = true; track.dataset.drag = ''; }
    track.scrollLeft = drag.left - dx;
    wrap();
    pause(PAUSE.drag);
  });
  window.addEventListener('pointerup', () => {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    delete track.dataset.drag;
    pause(PAUSE.drag);
    if (moved) track.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); }, { capture: true, once: true });
  });

  // автопрокрутка
  let hold = 0;
  let hover = false;
  let focusIn = false;
  function pause(ms) { hold = performance.now() + ms; }
  track.addEventListener('wheel', () => pause(PAUSE.wheel), { passive: true });
  track.addEventListener('touchstart', () => pause(PAUSE.touch), { passive: true });
  track.addEventListener('mouseenter', () => { hover = true; });
  track.addEventListener('mouseleave', () => { hover = false; });
  track.addEventListener('focusin', () => { focusIn = true; });
  track.addEventListener('focusout', () => { focusIn = false; });

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const speed = parseFloat(getComputedStyle(section).getPropertyValue('--infra-speed')) || 0;
  let raf = 0;
  let last = 0;
  let acc = 0;
  let visible = false;
  const tick = (t) => {
    const dt = Math.min(MAX_FRAME, t - (last || t));
    last = t;
    if (!drag && !hover && !focusIn && t > hold) {
      acc += dt * speed;
      const step = Math.floor(acc);
      if (step) { track.scrollLeft += step; acc -= step; }
    }
    raf = requestAnimationFrame(tick);
  };
  const run = () => {
    const on = visible && !document.hidden && !reduce.matches && speed > 0;
    if (on && !raf) { last = 0; raf = requestAnimationFrame(tick); }
    if (!on && raf) { cancelAnimationFrame(raf); raf = 0; }
  };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; run(); }).observe(track);
  document.addEventListener('visibilitychange', run);
  reduce.addEventListener('change', run);
}

function initInfo(section) {
  const close = (card) => {
    card.removeAttribute('data-open');
    card.querySelector('[data-infra-info]')?.setAttribute('aria-expanded', 'false');
  };
  section.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-infra-info]');
    const card = e.target.closest('[data-infra-card]');
    if (!card) return;
    if (btn) {
      const was = card.hasAttribute('data-open');
      section.querySelectorAll('[data-infra-card][data-open]').forEach(close);
      if (!was) { card.dataset.open = ''; btn.setAttribute('aria-expanded', 'true'); }
      return;
    }
    if (card.hasAttribute('data-open') && e.target.closest('.infra__plate')) close(card);
  });
  section.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const card = e.target.closest('[data-infra-card][data-open]');
    if (!card) return;
    close(card);
    card.querySelector('[data-infra-info]')?.focus();
  });
}

export function initInfra(root = document) {
  root.querySelectorAll('.infra').forEach((section) => {
    initRibbon(section);
    initInfo(section);
  });
}
