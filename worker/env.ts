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
}
