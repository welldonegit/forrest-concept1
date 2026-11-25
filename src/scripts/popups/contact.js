/**
 * Попап «Звʼязатися» (выгрузка 2026-11-25-contact-popup): разметка — components/popups/ContactPopup.astro.
 * - Открывает кнопка «Звʼязатися» в шапке; каждое открытие — форма с чистого листа, фокус в поле «Імʼя»
 *   (как в выгрузке). Esc, подложка и крестик закрывают, фокус возвращается на кнопку (dialog.js).
 * - Заявка — форма contact: имя по желанию, телефон обязателен (тексты ошибок — общие из Sanity).
 *   Успех — «Дякуємо» с событием generate_lead (goThanks), ошибка отправки — текст под кнопкой.
 */
import { createModal } from './dialog.js';
import { formatPhone, setError, PHONE_DIGITS } from '../ui/form-fields.js';
import { preloadCaptcha } from '../ui/captcha.js';
import { leadSender, goThanks } from '../ui/lead-api.js';

export function init(dlg) {
  const modal = createModal(dlg);
  const form = dlg.querySelector('[data-cpop-form]');
  const name = form.elements.name;
  const tel = form.elements.phone;
  const status = form.querySelector('[data-form-status]');

  tel.addEventListener('input', () => {
    tel.value = formatPhone(tel.value);
    setError(tel, false);
  });

  preloadCaptcha().catch(() => {});
  const send = leadSender(form, 'contact');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const digits = tel.value.replace(/\D/g, '').length;
    const bad = digits < PHONE_DIGITS;
    setError(tel, bad, digits ? 'invalid' : 'required');
    if (bad) { tel.focus(); return; }
    const result = await send({ fields: { name: name.value.trim() || undefined, phone: tel.value } });
    if (result) goThanks('contact', result.number, { phone: tel.value });
  });

  function open(from) {
    // форма, где заявка уже ушла (переход на «Дякуємо»), не сбрасывается
    if (!form.hasAttribute('aria-busy')) {
      form.reset();
      setError(tel, false);
      status.hidden = true;
    }
    modal.open(from);
    name.focus({ preventScroll: true });
  }

  return { open, close: modal.close };
}
