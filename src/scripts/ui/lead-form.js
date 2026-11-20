/**
 * Формы заявки (data-lead-form): «Фінмодель» (data-lead-form="finmodel") и финальная (="final").
 * - Телефон: «+380 (XX) XXX-XX-XX», лишние цифры и префиксы 380 / 0 отбрасываются.
 * - Пустое имя или неполный номер — aria-invalid на поле (красная рамка и встряска),
 *   текст ошибки из siteSettings — для экранных дикторов (в выгрузке текста нет).
 * - Отправка в POST /api/lead (lead-api.js: капча, ключ повтора, тексты ошибок из Sanity);
 *   после записи заявки — событие в dataLayer и переход на «Дякуємо» (data-thanks, /{lang}/thanks/).
 *   При ошибке данные остаются в полях.
 */
import { within } from './lazy.js';
import { formatPhone, setError, PHONE_DIGITS } from './form-fields.js';
import { preloadCaptcha } from './captcha.js';
import { leadSender, pushLeadEvent, ukText } from './lead-api.js';

function initForm(form) {
  if (form.dataset.leadReady !== undefined) return;
  form.dataset.leadReady = '';
  const formId = form.dataset.leadForm;
  // «Фінмодель»: format — формат и площадь; финальная: goal — цель покупки.
  const { name, phone, format, goal, contact } = form.elements;
  const send = leadSender(form, formId);
  // номер, введённый до загрузки модуля, — в тот же вид, что при наборе
  if (phone.value) phone.value = formatPhone(phone.value);
  phone.addEventListener('input', () => {
    phone.value = formatPhone(phone.value);
    setError(phone, false);
  });
  name.addEventListener('input', () => setError(name, false));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const badName = !name.value.trim();
    const digits = phone.value.replace(/\D/g, '').length;
    const badPhone = digits < PHONE_DIGITS;
    setError(name, badName);
    setError(phone, badPhone, digits ? 'invalid' : 'required');
    if (badName) { name.focus(); return; }
    if (badPhone) { phone.focus(); return; }

    // Значения — по-украински при любом языке страницы (data-uk, docs/LEADS.md).
    const opt = format?.selectedOptions[0];
    const goalOpt = goal?.selectedOptions[0];
    const checked = form.querySelector('input[name=contact]:checked');
    const result = await send({
      fields: {
        name: name.value.trim(),
        phone: phone.value,
        format: opt ? opt.dataset.format ?? ukText(opt) : undefined,
        areaFrom: opt?.dataset.areaFrom,
        areaTo: opt?.dataset.areaTo,
        purpose: goalOpt ? ukText(goalOpt) : undefined,
        contactMethod: checked ? ukText(checked.parentElement) : undefined,
      },
    });
    if (result) pushLeadEvent(formId, () => window.location.assign(form.dataset.thanks));
  });
  // посетитель нажал кнопку до загрузки модуля (main.js) — отправляем сейчас
  if (form.dataset.leadPending !== undefined) {
    delete form.dataset.leadPending;
    form.requestSubmit();
  }
}

export function initLeadForms(root = document) {
  const forms = within(root, '[data-lead-form]');
  if (forms.length) preloadCaptcha().catch(() => {});
  forms.forEach(initForm);
}
