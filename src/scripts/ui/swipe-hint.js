/** Подсказка «Гортайте»: гаснет, когда ленту прокрутили больше чем на 24px (как в выгрузке). */
const THRESHOLD = 24;

export function initSwipeHints(root = document) {
  root.querySelectorAll('[data-swipe-hint]').forEach((hint) => {
    const track = document.getElementById(hint.dataset.swipeHint);
    if (!track) return;
    const start = track.scrollLeft;
    const onScroll = () => {
      if (Math.abs(track.scrollLeft - start) <= THRESHOLD) return;
      hint.dataset.gone = '';
      track.removeEventListener('scroll', onScroll);
    };
    track.addEventListener('scroll', onScroll, { passive: true });
  });
}
