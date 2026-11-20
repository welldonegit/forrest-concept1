/**
 * Отправка заявки в POST /api/lead — общая для всех источников: «Фінмодель», финальная форма,
 * квиз, попап апартамента (docs/LEADS.md, «Формат запроса»).
 * - Ключ повтора: один на попытку отправки. Повторное нажатие или повтор после сбоя сети
 *   с теми же данными идут с тем же ключом — сервер вернёт результат первой отправки.
 *   Изменили поле — новый ключ.
 * - Пока запрос идёт, кнопки отправки неактивны.
 * - Ошибка: текст из Sanity в [data-form-status] под кнопкой, видимо и для экранных дикторов (role=alert;
 *   капча — data-msg-turnstile, остальное — data-msg-send);
 *   введённые данные не сбрасываются.
 * - Успех: событие lead_submit в dataLayer — только форма и язык, без личных данных.
 */
import { attachCaptcha } from './captcha.js';

/** UUID v4: randomUUID есть только в защищённом контексте (https, localhost), getRandomValues — везде. */
function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function leadSender(form, formId) {
  const captcha = attachCaptcha(form);
  // текст ошибки — внутри формы или рядом с ней (попап апартамента: data-form-status="<id формы>")
  const status = form.querySelector('[data-form-status]') ?? (form.id ? document.querySelector(`[data-form-status="${form.id}"]`) : null);
  let key = null;
  let busy = false;
  const fresh = () => { key = null; };
  form.addEventListener('input', fresh);
  form.addEventListener('change', fresh);

  function showError(kind) {
    if (!status) return;
    status.textContent = status.dataset[kind === 'turnstile' ? 'msgTurnstile' : 'msgSend'] ?? '';
    status.hidden = false;
  }

  function setBusy(on) {
    busy = on;
    form.toggleAttribute('aria-busy', on);
    form.querySelectorAll('button[type=submit]').forEach((b) => { b.disabled = on; });
    // кнопка квиза стоит вне формы (form=…)
    if (form.id) document.querySelectorAll(`button[type=submit][form="${form.id}"]`).forEach((b) => { b.disabled = on; });
  }

  /** fields, quiz — см. формат запроса. Возвращает { number } при успехе, иначе null. */
  return async function send({ fields, quiz }) {
    if (busy) return null;
    setBusy(true);
    if (status) status.hidden = true;
    try {
      key ??= uuid();
      let turnstileToken;
      try {
        turnstileToken = await captcha.token();
      } catch (err) {
        // капча не настроена на этом адресе — это сбой сайта, а не посетителя
        showError(err?.message === 'captcha_not_configured' ? 'send' : 'turnstile');
        return null;
      }
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          key,
          form: formId,
          lang: document.documentElement.lang,
          page: location.origin + location.pathname + location.search,
          turnstileToken,
          website: form.elements.website?.value ?? '',
          fields,
          ...(quiz && { quiz }),
        }),
      });
      const data = await res.json().catch(() => ({}));
      captcha.reset();
      if (res.ok && data.ok) {
        key = null;
        return data;
      }
      showError(data.error === 'captcha' ? 'turnstile' : 'send');
      return null;
    } catch {
      captcha.reset();
      showError('send');
      return null;
    } finally {
      setBusy(false);
    }
  };
}

/** Событие успеха для GTM. done — после обработки события (или через timeout мс, если GTM ещё нет). */
export function pushLeadEvent(formId, done, timeout = 800) {
  let called = false;
  const finish = () => { if (!called) { called = true; done?.(); } };
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: 'lead_submit',
    lead_form: formId,
    lead_language: document.documentElement.lang,
    eventCallback: finish,
    eventTimeout: timeout,
  });
  setTimeout(finish, timeout + 200);
}
