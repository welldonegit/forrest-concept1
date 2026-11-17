/**
 * Калькулятор дохода (блок Numbers), как в выгрузке:
 * - два списка (формат, вариант оплаты): кнопка открывает список, выбор закрывает его;
 *   Esc и нажатие вне списка — закрывают;
 * - после выбора числа пересчитываются (src/lib/calc.ts) и «докручиваются» до новых значений
 *   (--calc-tween-fast-dur, замедление к концу), столбики графика перекрашиваются.
 * Начальные значения посчитаны при сборке; при prefers-reduced-motion числа меняются сразу.
 * Отличие от выгрузки: во время докрутки число не размывается (filter — LAYOUT_RULES.md).
 */
import { calc, fill, formatNumber } from '../../lib/calc';

const ease = (k) => 1 - (1 - k) ** 4;

function initCalc(el) {
  const d = el.dataset;
  const lang = d.lang;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  let dur = 0; // читается при первом пересчёте: getComputedStyle при загрузке — лишний расчёт стилей
  const sels = [...el.querySelectorAll('[data-calc-sel]')];
  const sel = (kind) => sels.find((s) => s.dataset.calcSel === kind);
  const picked = (kind) => sel(kind).querySelector('[data-calc-opt][aria-pressed="true"]');
  const out = (k) => el.querySelector(`[data-calc-v="${k}"]`);
  const bars = [...el.querySelectorAll('.calc__bar')];
  const money = (n) => `${d.currency}${formatNumber(n, lang)}`;
  const dec = (n) => (n % 1 ? 1 : 0);

  const input = () => {
    const f = picked('format').dataset;
    const p = picked('payment').dataset;
    return { area: +f.area, yieldPercent: +f.yield, pricePerM2: +d.priceM2, firstPercent: +p.first, months: +p.months };
  };

  const values = new Map();
  const tween = (key, to, fmt) => {
    const node = out(key);
    const from = values.get(key) ?? to;
    values.set(key, to);
    cancelAnimationFrame(node._raf);
    if (reduce.matches || from === to) { node.textContent = fmt(to); return; }
    dur ||= parseFloat(getComputedStyle(el).getPropertyValue('--calc-tween-fast-dur')) || 900;
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      node.textContent = fmt(from + (to - from) * ease(k));
      if (k < 1) node._raf = requestAnimationFrame(step);
    };
    node._raf = requestAnimationFrame(step);
  };

  const render = () => {
    const i = input();
    const r = calc(i);
    out('area').textContent = `${formatNumber(i.area, lang, dec(i.area))} ${d.areaUnit}`;
    tween('price', r.price, money);
    tween('first', r.first, money);
    tween('month', r.month, (v) => (i.months ? money(v) : d.noMonthly));
    tween('income', r.income, money);
    tween('yield', i.yieldPercent, (v) => `${formatNumber(v, lang, dec(i.yieldPercent))}%`);
    tween('payback', r.payback, (v) => fill(d.paybackFormat, formatNumber(v, lang, 1)));
    out('be').textContent = fill(d.breakEvenFormat, String(r.breakEvenYear));
    bars.forEach((b, k) => b.toggleAttribute('data-paid', k + 1 >= r.breakEvenYear));
  };

  // начальные значения — те, что в HTML (посчитаны при сборке)
  {
    const i = input();
    const r = calc(i);
    [['price', r.price], ['first', r.first], ['month', r.month], ['income', r.income], ['yield', i.yieldPercent], ['payback', r.payback]]
      .forEach(([k, v]) => values.set(k, v));
  }

  const close = (s, focus = false) => {
    const trig = s.querySelector('[data-calc-trig]');
    if (trig.getAttribute('aria-expanded') !== 'true') return;
    trig.setAttribute('aria-expanded', 'false');
    if (focus) trig.focus();
  };

  el.addEventListener('click', (e) => {
    const trig = e.target.closest('[data-calc-trig]');
    if (trig) {
      const open = trig.getAttribute('aria-expanded') !== 'true';
      sels.forEach((s) => close(s));
      trig.setAttribute('aria-expanded', String(open));
      return;
    }
    const opt = e.target.closest('[data-calc-opt]');
    if (!opt) return;
    const s = opt.closest('[data-calc-sel]');
    s.querySelectorAll('[data-calc-opt]').forEach((o) => o.setAttribute('aria-pressed', String(o === opt)));
    s.querySelector('[data-calc-name]').textContent = opt.querySelector('[data-calc-opt-name]').textContent;
    s.querySelector('[data-calc-sub]').textContent = opt.querySelector('[data-calc-opt-sub]').textContent;
    close(s, true);
    el.dataset.fast = '';
    render();
  });
  el.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const s = e.target.closest('[data-calc-sel]');
    if (s) close(s, true);
  });
  document.addEventListener('pointerdown', (e) => {
    sels.forEach((s) => { if (!s.contains(e.target)) close(s); });
  });
}

export function initNumbers(root = document) {
  root.querySelectorAll('[data-calc]').forEach(initCalc);
}
