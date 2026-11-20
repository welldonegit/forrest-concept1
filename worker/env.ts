/**
 * Окружение Worker. Типы привязок — из worker/worker-configuration.d.ts
 * (генерируется: npx wrangler types worker/worker-configuration.d.ts --config wrangler.jsonc).
 */
export interface Env {
  DB: D1Database;
  LEAD_RATE_LIMIT: RateLimit;
  /** Несекретные настройки — wrangler.jsonc → vars. Пустая строка = не задано. */
  TURNSTILE_SITE_KEY: string;
  TELEGRAM_CHAT_ID: string;
  CRM_SOURCE: string;
  CRM_STAGE_ID: string;
  CRM_BUILDING_ID: string;
  /** Секреты — только в секретах Cloudflare и в .dev.vars. Могут отсутствовать. */
  TURNSTILE_SECRET_KEY?: string;
  TELEGRAM_BOT_TOKEN?: string;
  CRM_TOKEN?: string;
  /** Только для тестов (.dev.vars / --env-file): адрес поддельного Bot API. В бою не задаётся. */
  TELEGRAM_API_BASE?: string;
  /** Только для тестов: адрес поддельного API CRM. */
  CRM_API_BASE?: string;
  /** wrangler.jsonc → vars: JSON { utm_source: '<ID кастомного поля>', … } — запасной вариант для UTM. */
  CRM_UTM_FIELDS?: string;
  /** wrangler.jsonc → vars: ID кастомных полей лида (способ связи, тип планировки, gclid, fbclid). */
  CRM_FIELD_CONTACT_METHOD?: string;
  CRM_FIELD_LAYOUT?: string;
  CRM_FIELD_GCLID?: string;
  CRM_FIELD_FBCLID?: string;
}
