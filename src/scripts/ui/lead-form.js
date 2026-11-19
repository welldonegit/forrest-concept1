/**
 * Формы заявки (data-lead-form): маска телефона и проверка полей, как в выгрузке.
 * - Телефон: «+380 (XX) XXX-XX-XX», лишние цифры и префиксы 380 / 0 отбрасываются.
 * - Пустое имя или неполный номер — aria-invalid на поле (красная рамка и встряска),
 *   текст ошибки из siteSettings — для экранных дикторов (в выгрузке текста нет).
 * TODO(5.2–5.4): отправка в POST /api/lead (Turnstile, UTM) и стан успеха — ставить
 * data-sent на секцию только после ответа об успешной записи заявки. Сейчас форма
 * после проверки никуда не отправляется.
 */
const PHONE_DIGITS = 12;

function formatPhone(value) {
  let d = value.replace(/\D/g, '');
  if (d.startsWith('380')) d = d.slice(3);
  else if (d.startsWith('0')) d = d.slice(1);
  d = d.slice(0, 9);
  if (!d) return '';
  const [a, b, c, e] = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)];
  return `+380 (${a}${d.length >= 2 ? ') ' : ''}${b}${c ? `-${c}` : ''}${e ? `-${e}` : ''}`;
}

function setError(input, on, kind = 'required') {
  const err = document.getElementById(input.getAttribute('aria-describedby'));
  // у телефона два текста: пустое поле и неполный номер (siteSettings.form.errors)
  if (on && err) {
    const msg = err.dataset[kind === 'invalid' ? 'msgInvalid' : 'msgRequired'];
    if (msg) err.textContent = msg;
  }
  if (on) {
    // перезапуск встряски при повторной ошибке
    input.removeAttribute('aria-invalid');
    void input.offsetWidth;
    input.setAttribute('aria-invalid', 'true');
  } else {
    input.removeAttribute('aria-invalid');
  }
  if (err) err.hidden = !on;
}

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

export function initLeadForms() {
  document.querySelectorAll('[data-lead-form]').forEach(initForm);
}
