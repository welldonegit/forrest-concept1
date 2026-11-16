/**
 * Season: появление, как в выгрузке — слова заголовка поднимаются из маски с поворотом
 * (шаг 0.08s), текст проявляется снизу, кадр раскрывается clip-path, затем плашка «60 сек»
 * и кнопка. Запуск — когда секция видна на 18%. Переходы — в season.css.
 *
 * Отличия от выгрузки (правила LAYOUT_RULES.md, этап 6; см. отчёт):
 * - у текста нет blur(6px) — filter не анимируем в сценариях прокрутки;
 * - у плашки неподвижно стекло (backdrop-filter), движутся только обводка и подпись.
 *
 * Слова оборачиваются в маски здесь, при запуске: в разметке заголовок цельный.
 */
const THRESHOLD = 0.18;

function splitWords(lines) {
  let i = 0;
  lines.forEach((line) => {
    const words = line.textContent.trim().split(/\s+/);
    line.textContent = '';
    words.forEach((word, k) => {
      if (k) line.append(' ');
      const mask = document.createElement('span');
      mask.className = 'season__mask';
      const w = document.createElement('span');
      w.className = 'season__word';
      w.style.setProperty('--w', String(i++));
      w.textContent = word;
      mask.append(w);
      line.append(mask);
    });
  });
}

export function init(root) {
  splitWords(root.querySelectorAll('[data-season-line]'));
  root.dataset.reveal = 'pre';

  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      root.dataset.reveal = 'in';
      io.disconnect();
    }
  }, { threshold: THRESHOLD });
  io.observe(root);

  // Пульс кольца вне экрана — на паузе.
  const vis = new IntersectionObserver(([e]) => {
    root.toggleAttribute('data-offscreen', !e.isIntersecting);
  });
  vis.observe(root);

  return () => {
    io.disconnect();
    vis.disconnect();
  };
}
