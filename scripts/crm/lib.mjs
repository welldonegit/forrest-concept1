/**
 * Общее для команд CRM (npm run crm:explore | crm:check | crm:delete).
 * Токен — только из окружения (CRM_TOKEN), в файлы и в чат не попадает.
 * Несекретные настройки (источник, этап, здание) — из wrangler.jsonc → vars.
 */
import { wranglerVar } from '../../src/integrations/wrangler-vars.ts';

// Понятные ошибки (HTTP-статус) — одной строкой, без трассировки.
process.on('uncaughtException', (err) => { console.error(err.message); process.exit(1); });

export const BASE = (process.env.CRM_API_BASE || 'https://crm.g-plus.app').replace(/\/+$/, '');
export const TEST_NAME = 'ТЕСТ сайт Forrest — не обробляти';

export function token() {
  const t = process.env.CRM_TOKEN?.trim();
  if (!t) {
    console.error('Немає CRM_TOKEN у середовищі. Запуск: CRM_TOKEN=… npm run <команда> (токен технічного користувача «Сайт»; у чат і файли не вставляти).');
    process.exit(2);
  }
  return t;
}

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { authorization: `Token ${token()}`, accept: 'application/json', ...(body && { 'content-type': 'application/json' }) },
    body: body && JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* не JSON */ }
  return { status: res.status, json, text };
}

export function must(r, what) {
  if (r.status >= 200 && r.status < 300) return r.json;
  const hint = r.status === 401 ? ' — токен не принят' : r.status === 403 ? ' — у токена нет права на это (scope)' : '';
  throw new Error(`${what}: HTTP ${r.status}${hint}`);
}

/** Настройки CRM из wrangler.jsonc (переменная окружения с тем же именем перекрывает). */
export const settings = () => ({
  CRM_SOURCE: wranglerVar('CRM_SOURCE'),
  CRM_STAGE_ID: wranglerVar('CRM_STAGE_ID'),
  CRM_BUILDING_ID: wranglerVar('CRM_BUILDING_ID'),
  CRM_UTM_FIELDS: wranglerVar('CRM_UTM_FIELDS'),
});

/** Телефон в выводе — только последние 2 цифры. */
export const maskPhone = (p) => String(p ?? '').replace(/\d(?=\d{2})/g, '•');
