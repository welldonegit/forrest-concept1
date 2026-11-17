/**
 * Model: сцена прокрутки, как в выгрузке (mframe, mdeck).
 *
 * Абзац: слова проявляются по прогрессу t = (0.82·vh − верх абзаца) / (высота + 0.3·vh),
 * сглаживание 0.12 за кадр; слово i — прозрачность 0.14 + 0.86·clamp(p − i), p = t·(N + 3).
 * Шаги (≥768): прогресс линии s — от верха списка, сглаживание 0.08; шаг «включается»,
 * когда s дошла до его левого края (на 768–900 — до k/5). Голова линии едет по s.
 * <768 — колода: блок прилипает к экрану, по прокрутке карточки по очереди улетают
 * влево и вправо с поворотом (transform + opacity), номера задних карточек гаснут.
 *
 * Отличия от выгрузки (LAYOUT_RULES.md, этап 6; варианты — в отчёте):
 * - голова линии двигается transform, а не left;
 * - у текста шага нет blur(8px), у карточки и точки тень и цвет меняются без перехода.
 * Размеры читаются при запуске и изменении окна; в кадре — только scrollY.
 */
const WORD_SMOOTH = 0.12;
const LINE_SMOOTH = 0.08;
const BASE = 0.14;

const clamp01 = (v) => Math.min(1, Math.max(0, v));

function splitWords(p) {
  const words = p.textContent.trim().split(/\s+/);
  p.textContent = '';
  return words.map((word, i) => {
    if (i) p.append(' ');
    const w = document.createElement('span');
    w.className = 'model__word';
    w.textContent = word;
    p.append(w);
    return w;
  });
}

export function init(root) {
  const lead = root.querySelector('[data-model-lead]');
  const wrap = root.querySelector('[data-model-wrap]');
  const stick = root.querySelector('[data-model-stick]');
  const list = root.querySelector('[data-model-steps]');
  const fill = root.querySelector('[data-model-fill]');
  const head = root.querySelector('[data-model-head]');
  const steps = [...root.querySelectorAll('[data-model-step]')];
  const nums = steps.map((li) => li.querySelector('[data-model-num]'));
  const words = splitWords(lead);
  const deckMq = window.matchMedia('(max-width: 767px)');
  const colMq = window.matchMedia('(max-width: 900px)');

  root.dataset.motion = '';
  let g = null;
  let wp = null; // сглаженный прогресс слов
  let ls = null; // сглаженный прогресс линии
  let raf = 0;

  function measure() {
    const deck = deckMq.matches;
    root.toggleAttribute('data-deck', deck);
    if (deck) {
      wrap.style.setProperty('--model-deck-moves', String(steps.length - 1));
      steps.forEach((li) => { li.dataset.on = ''; });
    } else {
      wrap.style.removeProperty('--model-stick-h');
      wrap.style.removeProperty('--model-stick-top');
      steps.forEach((li) => { li.style.transform = ''; li.style.zIndex = ''; li.style.opacity = ''; });
      nums.forEach((n) => { n.style.opacity = ''; });
    }
    const y = window.scrollY;
    const vh = window.innerHeight;
    const lr = lead.getBoundingClientRect();
    const or = list.getBoundingClientRect();
    g = {
      deck, col: colMq.matches, vh,
      leadTop: lr.top + y, leadH: lr.height,
      listTop: or.top + y, listH: or.height, listW: list.offsetWidth,
      at: steps.map((li, k) => (colMq.matches ? k / steps.length : li.offsetLeft / list.offsetWidth)),
    };
    if (deck) {
      const H = stick.offsetHeight;
      const T = H < vh ? (vh - H) / 2 : vh - H;
      wrap.style.setProperty('--model-stick-h', `${H}px`);
      wrap.style.setProperty('--model-stick-top', `${Math.round(T)}px`);
      g.H = H; g.T = T;
      g.wrapTop = wrap.getBoundingClientRect().top + y;
      g.wrapH = wrap.offsetHeight;
    }
  }

  // Колода (<768): прогресс по прилипшему блоку, без сглаживания (как в выгрузке).
  function deckFrame(y) {
    const N = steps.length;
    const top = g.wrapTop - y;
    const p = clamp01((g.T - top) / Math.max(1, g.wrapH - g.H)) * (N - 1);
    steps.forEach((li, k) => {
      const f = clamp01(p - k);
      const e = f * f * (3 - 2 * f);
      const b = Math.max(0, k - p);
      const bb = Math.min(b, 3);
      const dir = k % 2 ? 1 : -1;
      li.style.zIndex = String(N - k);
      li.style.transform = `translate(${(dir * e * 120).toFixed(2)}vw,${(bb * 16 - e * 40).toFixed(1)}px) rotate(${(dir * e * 18).toFixed(2)}deg) scale(${(1 - bb * 0.05).toFixed(3)})`;
      li.style.opacity = b > 2.6 ? '0' : '1';
      nums[k].style.opacity = Math.max(0, 1 - b * 2).toFixed(3);
    });
    return top <= g.T + 1;
  }

  function frame() {
    raf = 0;
    if (!g) return;
    const y = window.scrollY;
    const { vh } = g;
    let pinned = false;
    if (g.deck) pinned = deckFrame(y);

    // Слова абзаца
    let target = clamp01((vh * 0.82 - (g.leadTop - y)) / (g.leadH + vh * 0.3));
    if (pinned) target = 1;
    if (wp == null || Math.abs(target - wp) > 0.3) wp = target;
    else wp += (target - wp) * WORD_SMOOTH;
    let again = Math.abs(target - wp) > 0.0005;
    const p = wp * (words.length + 3);
    words.forEach((w, i) => w.style.setProperty('--o', (BASE + (1 - BASE) * clamp01(p - i)).toFixed(3)));

    // Линия и шаги (≥768)
    if (!g.deck) {
      const listTop = g.listTop - y;
      const st = g.col ? clamp01((vh * 0.7 - listTop) / g.listH) : clamp01((vh * 0.88 - listTop) / (vh * 0.55));
      if (ls == null || Math.abs(st - ls) > 0.5) ls = st;
      else ls += (st - ls) * LINE_SMOOTH;
      again ||= Math.abs(st - ls) > 0.0005;
      const s = ls;
      fill.style.transform = g.col ? `scaleY(${s.toFixed(4)})` : `scaleX(${s.toFixed(4)})`;
      if (!g.col) {
        head.style.transform = `translateX(${(s * g.listW).toFixed(1)}px)`;
        head.style.opacity = s > 0.005 && s < 0.995 ? '1' : '0';
      }
      steps.forEach((li, k) => {
        const at = g.at[k];
        if (s >= at + 0.004 || (k === 0 && s > 0.002)) li.dataset.on = '';
        else if (s < at - 0.02) delete li.dataset.on;
      });
    }
    if (again) raf = requestAnimationFrame(frame);
  }

  const request = () => { if (!raf) raf = requestAnimationFrame(frame); };
  const remeasure = () => { measure(); request(); };
  measure();
  frame();
  window.addEventListener('scroll', request, { passive: true });
  const ro = new ResizeObserver(remeasure);
  ro.observe(root);
  ro.observe(document.body); // блоки выше меняют высоту (шрифты, фото) — положение секции сдвигается
  document.fonts?.ready.then(remeasure);

  return () => {
    window.removeEventListener('scroll', request);
    ro.disconnect();
    cancelAnimationFrame(raf);
  };
}
