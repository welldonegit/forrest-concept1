/**
 * Подсказка «Гортайте»: гаснет, когда ленту прокрутили больше чем на 24px (как в выгрузке).
 * Лента, которая сама сдвигает прокрутку (Apartments: переход к набору копий), шлёт
 * событие swipehintreset — точка отсчёта переносится, подсказка не гаснет.
 *
 * Точка отсчёта (scrollLeft) читается не при загрузке, а когда лента подходит к экрану
 * (LAYOUT_RULES.md: скрипты не читают раскладку дальних блоков). До этого прокрутить
 * ленту может только сам скрипт ленты — такая прокрутка становится точкой отсчёта.
 */
const THRESHOLD = 24;

export function initSwipeHints(root = document) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      e.target.dispatchEvent(new Event('swipehintreset'));
    });
  }, { rootMargin: '100% 0px' });

  root.querySelectorAll('[data-swipe-hint]').forEach((hint) => {
    const track = document.getElementById(hint.dataset.swipeHint);
    if (!track) return;
    let start = null;
    const onScroll = () => {
      if (start === null) { start = track.scrollLeft; return; }
      if (Math.abs(track.scrollLeft - start) <= THRESHOLD) return;
      hint.dataset.gone = '';
      track.removeEventListener('scroll', onScroll);
    };
    track.addEventListener('scroll', onScroll, { passive: true });
    track.addEventListener('swipehintreset', () => { start = track.scrollLeft; });
    io.observe(track);
  });
}
