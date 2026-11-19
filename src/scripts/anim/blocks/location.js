/**
 * Location: появление, как в выгрузке.
 * - Текст (строки заголовка из маски, абзац и кнопка снизу) — когда левая колонка видна на 30%.
 * - Карта — когда видна на 30%: раскрывается clip-path, фото уменьшается с 1.2 и проявляется
 *   из приглушённого слоя; метки появляются по удалённости от курорта (ближние раньше),
 *   затем точка курорта, подпись и пульсирующие кольца.
 * Если карта стоит под текстом (узкий экран), задержка карты .1s, иначе .55s.
 * Переходы — в location.css.
 */
const THRESHOLD = 0.3;
const PIN_START = 1.25;
const PIN_STEP = 0.05;
const Y_WEIGHT = 1.26; // как в выгрузке: вертикаль карты «длиннее» горизонтали

export function init(root) {
  const left = root.querySelector('[data-loc-left]');
  const frame = root.querySelector('[data-loc-frame]');
  const resort = root.querySelector('[data-loc-resort]');
  if (!left || !frame || !resort) return () => {};

  const pos = (el) => [parseFloat(el.style.getPropertyValue('--x')), parseFloat(el.style.getPropertyValue('--y'))];
  const [fx, fy] = pos(resort);
  [...root.querySelectorAll('[data-loc-pin]')]
    .map((pin) => {
      const [x, y] = pos(pin);
      return [pin, Math.hypot(x - fx, (y - fy) * Y_WEIGHT)];
    })
    .sort((a, b) => a[1] - b[1])
    .forEach(([pin], i) => pin.style.setProperty('--d', `${(PIN_START + i * PIN_STEP).toFixed(2)}s`));

  const stacked = frame.getBoundingClientRect().top > left.getBoundingClientRect().bottom - 4;
  root.style.setProperty('--md', stacked ? '.1s' : '.55s');
  root.dataset.motion = '';

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      if (e.target === left) root.dataset.textIn = '';
      else root.dataset.mapIn = '';
      io.unobserve(e.target);
    });
  }, { threshold: THRESHOLD });
  io.observe(left);
  io.observe(frame);
  return () => io.disconnect();
}
