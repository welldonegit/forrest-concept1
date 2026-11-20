/**
 * POST /api/lead — порядок (docs/LEADS.md):
 * адрес и размер → лимит частоты → поля и ловушка → ключ повтора → Turnstile →
 * запись в D1 → ответ посетителю → отправка в каналы в фоне.
 * Личные данные в журналы не выводятся.
 */
import type { Env } from '../env';
import { error, json } from '../http';
import { ensureSchema } from '../db/schema';
import { claimKey, releaseKey } from '../db/requests';
import { insertLead } from '../db/leads';
import { dispatch } from '../channels/dispatch';
import { validateLead } from './validate';
import { readAttribution } from './attribution';
import { captchaSecret, verifyTurnstile } from './turnstile';

const MAX_BODY = 32 * 1024;

function backToPage(request: Request, url: URL): Response {
  let target = `${url.origin}/`;
  try {
    const ref = new URL(request.headers.get('referer') ?? '');
    if (ref.origin === url.origin) target = ref.origin + ref.pathname;
  } catch { /* нет referer — на главную */ }
  return new Response(null, { status: 303, headers: { location: target, 'cache-control': 'no-store', 'x-forrest-api': '1' } });
}

export async function handleLead(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (request.method !== 'POST') return error('method_not_allowed', 405, {}, { allow: 'POST' });

  const url = new URL(request.url);
  // Запрос с чужого сайта: браузер всегда ставит Origin у POST из fetch.
  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin) return error('forbidden', 403);

  const type = (request.headers.get('content-type') ?? '').toLowerCase();
  // Форма отправлена без JS (обычный POST браузера): ничего не принимаем — возвращаем на ту же
  // страницу сайта, там вместо кнопки телефон и мессенджеры. Данные формы в адрес не попадают.
  if (type.startsWith('application/x-www-form-urlencoded') || type.startsWith('multipart/form-data')) {
    return backToPage(request, url);
  }
  if (!type.startsWith('application/json')) {
    return error('unsupported_media_type', 415);
  }

  const ip = request.headers.get('cf-connecting-ip');
  const { success: underLimit } = await env.LEAD_RATE_LIMIT.limit({ key: ip ?? 'unknown' });
  if (!underLimit) return error('rate_limited', 429, {}, { 'retry-after': '60' });

  const text = await request.text();
  if (text.length > MAX_BODY) return error('payload_too_large', 413);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return error('invalid_json', 400);
  }

  const checked = validateLead(body);
  if (!checked.ok) return error('validation', 400, { fields: checked.fields });
  const input = checked.value;

  // Ловушка заполнена — бот. Отвечаем как при успехе, ничего не записываем.
  if (input.honeypot) return json({ ok: true });

  // Без ключей Turnstile (или с тестовыми на боевом домене) заявки не принимаются.
  const secret = captchaSecret(env, url.hostname);
  if (!secret) return error('captcha_unavailable', 503);

  try {
    await ensureSchema(env.DB);

    const claim = await claimKey(env.DB, input.key);
    if (claim.state === 'done') return json({ ok: true, number: claim.number });
    if (claim.state === 'busy') return error('in_progress', 409);

    const captcha = await verifyTurnstile(secret, input.turnstileToken, ip, url.hostname);
    if (captcha !== 'ok') {
      await releaseKey(env.DB, input.key);
      return captcha === 'failed' ? error('captcha', 403) : error('captcha_unavailable', 503);
    }

    const lead = await insertLead(env, input, readAttribution(request.headers.get('cookie')), new Date().toISOString());
    console.log('lead_saved', { lead: lead.id, form: lead.form, lang: lead.lang });
    ctx.waitUntil(dispatch(env, lead));
    return json({ ok: true, number: lead.number });
  } catch (err) {
    console.error('lead_failed', { error: err instanceof Error ? err.name : 'error' });
    await releaseKey(env.DB, input.key).catch(() => {});
    return error('server_error', 500);
  }
}
