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
 * - Успех: форма остаётся заблокированной (второе нажатие до ухода со страницы не даёт второй заявки),
 *   goThanks() кладёт данные события generate_lead в sessionStorage (lead_event) и ведёт на «Дякуємо»;
 *   событие отправляет в dataLayer сама «Дякуємо» (Base.astro). docs/LEADS.md, «Аналитика».
 */
import { attachCaptcha } from './captcha.js';
import { LEAD_FORMS } from '../../lib/lead-forms';

/** Украинская подпись варианта (data-uk) или показанная, если страница украинская. */
export function ukText(el) {
  const input = el.matches?.('input') ? el : el.querySelector?.('input[data-uk]');
  return (el.dataset.uk ?? input?.dataset.uk ?? el.textContent).trim();
}

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
  // заявка записана, идёт переход на «Дякуємо»: новых отправок нет. Возврат «Назад» из bfcache — форма снова доступна.
  let sent = false;
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

  addEventListener('pageshow', (e) => {
    if (e.persisted && sent) { sent = false; setBusy(false); }
  });

  /** fields, quiz — см. формат запроса. Возвращает { number } при успехе, иначе null. */
  return async function send({ fields, quiz }) {
    if (busy || sent) return null;
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
        sent = true;
        return data;
      }
      showError(data.error === 'captcha' ? 'turnstile' : 'send');
      return null;
    } catch {
      captcha.reset();
      showError('send');
      return null;
    } finally {
      if (!sent) setBusy(false);
    }
  };
}

/** Телефон из маски («+380 (67) 123-45-67», «+380 67 123 45 67») — в E.164: «+380671234567». */
export function toE164(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '');
  return digits ? `+${digits}` : undefined;
}

/**
 * После успешной заявки: данные события generate_lead — в sessionStorage (lead_event), затем переход
 * на «Дякуємо» этого языка (html[data-thanks]). Там событие читается, сразу удаляется и уходит в dataLayer.
 * user_data — только заполненные поля формы; ни одного — без user_data. Личные данные живут
 * в sessionStorage только до чтения на «Дякуємо»; в журналы и localStorage не попадают.
 * sessionStorage недоступен (запрещён, приватный режим) — запасной путь: lead_id, form_id и form_location
 * в параметрах адреса «Дякуємо», без телефона и email; событие тогда уходит без user_data.
 */
export function goThanks(formId, number, { email, phone } = {}) {
  const { id: form_id, name: form_name } = LEAD_FORMS[formId];
  const event = { event: 'generate_lead', lead_id: number, form_id, form_name, form_location: location.pathname };
  const thanks = document.documentElement.dataset.thanks;
  const user = {};
  const mail = email?.trim();
  if (mail) user.email = mail;
  const tel = toE164(phone);
  if (tel) user.phone_number = tel;
  if (Object.keys(user).length) event.user_data = user;
  try {
    sessionStorage.setItem('lead_event', JSON.stringify(event));
  } catch {
    const query = new URLSearchParams({ lead_id: number, form_id, form_location: event.form_location });
    location.assign(`${thanks}?${query}`);
    return;
  }
  location.assign(thanks);
}
