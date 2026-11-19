/** Кривая cubic-bezier как функция прогресса: для кадров WAAPI, которые считаются в JS. */
export function cubicBezier(x1, y1, x2, y2) {
  const at = (a, b, t) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0, hi = 1, t = x;
    for (let i = 0; i < 24; i++) {
      t = (lo + hi) / 2;
      if (at(x1, x2, t) < x) lo = t; else hi = t;
    }
    return at(y1, y2, t);
  };
}

/** Кривая из CSS-переменной вида cubic-bezier(a,b,c,d). */
export function cssEase(el, name) {
  const m = getComputedStyle(el).getPropertyValue(name).match(/cubic-bezier\(([^)]+)\)/);
  const [a, b, c, d] = m ? m[1].split(',').map(Number) : [0.25, 0.1, 0.25, 1];
  return cubicBezier(a, b, c, d);
}

/** Число из CSS-переменной (мс и коэффициенты попапов лежат в tokens.css). */
export const cssNum = (el, name) => parseFloat(getComputedStyle(el).getPropertyValue(name)) || 0;
