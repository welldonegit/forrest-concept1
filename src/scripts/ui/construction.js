/**
 * Construction B: листание, как в выгрузке.
 * Кнопки у заголовка — лента карточек на одну карточку (ширина + промежуток).
 * Кнопки на фото — лента фото своей карточки на одно фото; «вперёд» на последнем — к первому.
 * Reduced motion — без плавной прокрутки.
 */
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
const behavior = () => (reduce.matches ? 'auto' : 'smooth');
const dir = (el) => (getComputedStyle(el).direction === 'rtl' ? -1 : 1);

export function initConstruction(root = document) {
  root.querySelectorAll('[data-ct]').forEach((section) => {
    const row = section.querySelector('[data-ct-row]');
    const step = (d) => {
      const item = row.querySelector('[data-ct-item]');
      const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
      row.scrollBy({ left: d * dir(row) * ((item ? item.offsetWidth : row.clientWidth) + gap), behavior: behavior() });
    };
    section.querySelector('[data-ct-row-prev]').addEventListener('click', () => step(-1));
    section.querySelector('[data-ct-row-next]').addEventListener('click', () => step(1));

    section.querySelectorAll('[data-ct-item]').forEach((item) => {
      const slides = item.querySelector('[data-ct-slides]');
      item.querySelector('[data-ct-photo-prev]').addEventListener('click', () => {
        slides.scrollBy({ left: -slides.clientWidth * dir(slides), behavior: behavior() });
      });
      item.querySelector('[data-ct-photo-next]').addEventListener('click', () => {
        const atEnd = Math.abs(slides.scrollLeft) + slides.clientWidth >= slides.scrollWidth - 4;
        slides.scrollBy({ left: (atEnd ? -slides.scrollWidth : slides.clientWidth) * dir(slides), behavior: behavior() });
      });
    });
  });
}
