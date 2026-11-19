/**
 * Формы заявки (data-lead-form): маска телефона и проверка полей, как в выгрузке.
 * - Телефон: «+380 (XX) XXX-XX-XX», лишние цифры и префиксы 380 / 0 отбрасываются.
 * - Пустое имя или неполный номер — aria-invalid на поле (красная рамка и встряска),
 *   текст ошибки из siteSettings — для экранных дикторов (в выгрузке текста нет).
 * TODO(5.2–5.4): отправка в POST /api/lead (Turnstile, UTM) и стан успеха — ставить
 * data-sent на секцию только после ответа об успешной записи заявки. Сейчас форма
 * после проверки никуда не отправляется.
 */
import { within } from './lazy.js';
import { formatPhone, setError, PHONE_DIGITS } from './form-fields.js';

function initForm(form) {
  const { name, phone } = form.elements;
  phone.addEventListener('input', () => {
    phone.value = formatPhone(phone.value);
    setError(phone, false);
  });
  name.addEventListener('input', () => setError(name, false));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const badName = !name.value.trim();
    const digits = phone.value.replace(/\D/g, '').length;
    const badPhone = digits < PHONE_DIGITS;
    setError(name, badName);
    setError(phone, badPhone, digits ? 'invalid' : 'required');
    if (badName) { name.focus(); return; }
    if (badPhone) { phone.focus(); return; }
    // TODO(5.4): отправка; при успехе — form.closest('[data-lead-section]').dataset.sent = '';
    // при ошибке — текст из [data-form-status] (data-msg-turnstile / data-msg-send).
  });
}

export function initLeadForms(root = document) {
  within(root, '[data-lead-form]').forEach(initForm);
}
