/**
 * Общая проверка полей заявки: формы (lead-form.js), попап апартамента и квиз (4.17).
 * Один набор правил и одни тексты ошибок из siteSettings.form.errors.
 * - Телефон: «+380 (XX) XXX-XX-XX», лишние цифры и префиксы 380 / 0 отбрасываются.
 * - Ошибка — aria-invalid на поле; текст — в элементе, на который указывает aria-describedby
 *   (data-msg-required / data-msg-invalid — два текста у телефона).
 */
export const PHONE_DIGITS = 12;

export function formatPhone(value) {
  let d = value.replace(/\D/g, '');
  if (d.startsWith('380')) d = d.slice(3);
  else if (d.startsWith('0')) d = d.slice(1);
  d = d.slice(0, 9);
  if (!d) return '';
  const [a, b, c, e] = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)];
  return `+380 (${a}${d.length >= 2 ? ') ' : ''}${b}${c ? `-${c}` : ''}${e ? `-${e}` : ''}`;
}

export function setError(input, on, kind = 'required') {
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

/** Цифр в номере достаточно (маска +380: 12 цифр). */
export const phoneOk = (value) => value.replace(/\D/g, '').length >= PHONE_DIGITS;

/**
 * Номер без кода страны (квиз: код выбирается отдельно). Для +380 — «XX XXX XXXX», 9 цифр,
 * префиксы 380 / 0 отбрасываются, как в маске форм; для других кодов — до 12 цифр группами по 3.
 */
export function formatNational(value, code) {
  let d = value.replace(/\D/g, '');
  if (code === '+380') {
    if (d.startsWith('380')) d = d.slice(3);
    else if (d.startsWith('0')) d = d.slice(1);
    d = d.slice(0, 9);
    return [d.slice(0, 2), d.slice(2, 5), d.slice(5, 9)].filter(Boolean).join(' ');
  }
  return d.slice(0, 12).replace(/(\d{3})(?=\d)/g, '$1 ');
}

/** Номер без кода полный: +380 — 9 цифр (как 12 в маске форм), другие коды — от 7. */
export const nationalOk = (value, code) => value.replace(/\D/g, '').length >= (code === '+380' ? 9 : 7);
