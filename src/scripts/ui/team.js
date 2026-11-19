/**
 * Team v3: выбор участника, как в выгрузке.
 * Нажатие на вкладку открывает её панель и закрывает остальные.
 * ≤900 (аккордеон) повторное нажатие на открытую вкладку её сворачивает.
 * ≥901 высота строк вкладок: выбранная забирает остаток высоты (строка --team-rows на сетке).
 */
import { within } from './lazy.js';
const accordion = window.matchMedia('(max-width: 900px)');

export function initTeam(root = document) {
  within(root, '[data-team]').forEach((section) => {
    const grid = section.querySelector('[data-team-grid]');
    const tabs = [...section.querySelectorAll('[data-team-tab]')];
    const panels = tabs.map((t) => section.querySelector(`#${CSS.escape(t.getAttribute('aria-controls'))}`));

    const select = (sel) => {
      tabs.forEach((t, i) => {
        t.setAttribute('aria-expanded', String(i === sel));
        panels[i].toggleAttribute('data-open', i === sel);
      });
      const at = sel < 0 ? 0 : sel; // на широком экране что-то всегда выбрано
      grid.style.setProperty('--team-rows', tabs.map((_, i) => `minmax(var(--team-tab-min), ${i === at ? 'var(--team-tab-grow)' : 'var(--team-tab-rest)'})`).join(' '));
    };

    tabs.forEach((t, i) => t.addEventListener('click', () => {
      const open = t.getAttribute('aria-expanded') === 'true';
      if (open && !accordion.matches) return;
      select(open ? -1 : i);
    }));
    // С телефона на широкий экран со свёрнутым аккордеоном — открыть первого
    accordion.addEventListener('change', () => {
      if (!accordion.matches && !tabs.some((t) => t.getAttribute('aria-expanded') === 'true')) select(0);
    });
  });
}
