/**
 * Окно «Детальніше» мира (выгрузка 2026-11-25, section-popups): разметка — components/popups/WorldPopup.astro.
 * - Открывает кнопка карточки Worlds (data-world = номер мира), вкладки WIND / ROCK / SUN переключают мир.
 * - Появление как в выгрузке: панель раскрывается снизу (clip-path), фото приближается, тексты поднимаются;
 *   закрытие — панель уходит вниз, окно закрывается после анимации. prefers-reduced-motion — без анимаций (world.css).
 * - Фокус при открытии — на «Закрити» (как в выгрузке); Esc, подложка и крестик закрывают (dialog.js).
 * - Заявка — форма world: имя, телефон, способ связи и секция (WIND/ROCK/SUN; в CRM — в note).
 *   Успех — «Дякуємо» с событием generate_lead (goThanks), ошибка — текст под полями.
 */
import { createModal } from './dialog.js';
import { formatPhone, setError, PHONE_DIGITS } from '../ui/form-fields.js';
import { preloadCaptcha } from '../ui/captcha.js';
import { leadSender, goThanks, ukText } from '../ui/lead-api.js';

const CLOSE_MS = 600; // = --wpop-close-dur (world.css)
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function init(dlg) {
  const tabs = [...dlg.querySelectorAll('[data-wpop-tab]')];
  const right = dlg.querySelector('.wpop__right');
  const grid = dlg.querySelector('.wpop__grid');

  function select(w, focusTab = false) {
    const n = Math.max(0, Math.min(tabs.length - 1, Number(w) || 0));
    dlg.dataset.w = String(n);
    tabs.forEach((t, i) => {
      t.setAttribute('aria-selected', String(i === n));
      t.tabIndex = i === n ? 0 : -1;
    });
    const name = dlg.querySelector(`.wpop__intro [data-w="${n}"] h2`);
    if (name) dlg.setAttribute('aria-labelledby', name.id);
    right.scrollTop = 0;
    if (focusTab) tabs[n].focus();
  }

  const modal = createModal(dlg, {
    beforeClose: () => {
      delete dlg.dataset.open;
      return still() ? null : new Promise((ok) => setTimeout(ok, CLOSE_MS));
    },
    onClosed: () => { right.scrollTop = 0; grid.scrollTop = 0; },
  });

  tabs.forEach((t, i) => t.addEventListener('click', () => select(i)));
  // стрелки, Home, End — по вкладкам (шаблон WAI-ARIA Tabs)
  dlg.querySelector('[role=tablist]').addEventListener('keydown', (e) => {
    const at = tabs.indexOf(document.activeElement);
    if (at < 0) return;
    const to = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    select((to + tabs.length) % tabs.length, true);
  });

  preloadCaptcha().catch(() => {});
  dlg.querySelectorAll('[data-wpop-form]').forEach(initForm);

  function open(from) {
    select(from?.dataset.world);
    modal.open(from);
    dlg.querySelector('.wpop__x').focus({ preventScroll: true });
    // кадр после showModal: исходное состояние отрисовано, переход запускается
    requestAnimationFrame(() => requestAnimationFrame(() => { dlg.dataset.open = ''; }));
  }

  return { open, close: modal.close, select };
}

function initForm(form) {
  const name = form.elements.name;
  const tel = form.elements.phone;
  tel.addEventListener('input', () => {
    tel.value = formatPhone(tel.value);
    setError(tel, false);
  });
  name.addEventListener('input', () => setError(name, false));

  const send = leadSender(form, 'world');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const badName = !name.value.trim();
    const digits = tel.value.replace(/\D/g, '').length;
    const badPhone = digits < PHONE_DIGITS;
    setError(name, badName);
    setError(tel, badPhone, digits ? 'invalid' : 'required');
    if (badName) { name.focus(); return; }
    if (badPhone) { tel.focus(); return; }
    const checked = form.querySelector('input[name=contact]:checked');
    const result = await send({
      fields: {
        name: name.value.trim(),
        phone: tel.value,
        contactMethod: checked ? ukText(checked.parentElement) : undefined,
        world: form.dataset.worldName,
      },
    });
    if (result) goThanks('world', result.number, { phone: tel.value });
  });
}
