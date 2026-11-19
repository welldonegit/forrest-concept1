/**
 * FAQ: аккордеон, как в выгрузке.
 * - Нажатие открывает пункт и закрывает остальные; повторное нажатие закрывает открытый.
 * - Стрелки вверх/вниз, Home, End — переход фокуса между вопросами (по кругу).
 * - Свечение в карточке сдвигается к открытому пункту (--faq-k, переход в faq.css).
 */
export function initFaq(root = document) {
  root.querySelectorAll('[data-faq]').forEach((section) => {
    const items = [...section.querySelectorAll('[data-faq-item]')];
    const buttons = items.map((it) => it.querySelector('[data-faq-button]'));
    const glow = section.querySelector('[data-faq-glow]');

    const set = (it, on) => {
      it.toggleAttribute('data-open', on);
      it.querySelector('[data-faq-button]').setAttribute('aria-expanded', String(on));
    };

    items.forEach((it, k) => {
      buttons[k].addEventListener('click', () => {
        const was = it.hasAttribute('data-open');
        items.forEach((o) => set(o, false));
        if (!was) {
          set(it, true);
          glow?.style.setProperty('--faq-k', String(k));
        }
      });
      buttons[k].addEventListener('keydown', (e) => {
        const to = { ArrowDown: k + 1, ArrowUp: k - 1, Home: 0, End: items.length - 1 }[e.key];
        if (to === undefined) return;
        e.preventDefault();
        buttons[(to + items.length) % items.length].focus();
      });
    });
  });
}
