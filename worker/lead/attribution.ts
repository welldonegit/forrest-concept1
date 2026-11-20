/**
 * Источник визита из cookie gp_utm (ставит скрипт сайта, шаг 5.2):
 * encodeURIComponent(JSON) с ключами ниже; 30 дней, по последнему переходу.
 * Неизвестные ключи отбрасываются, значения обрезаются.
 */
export const ATTRIBUTION_KEYS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  'gclid', 'fbclid', 'referrer', 'landing',
] as const;

export type Attribution = Partial<Record<(typeof ATTRIBUTION_KEYS)[number], string>>;

const COOKIE = 'gp_utm';
const MAX = 500;

export function readAttribution(cookieHeader: string | null): Attribution {
  const raw = cookieHeader
    ?.split(';')
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeURIComponent(raw));
  } catch {
    return {};
  }
  if (typeof parsed !== 'object' || parsed === null) return {};
  const out: Attribution = {};
  for (const k of ATTRIBUTION_KEYS) {
    const v = (parsed as Record<string, unknown>)[k];
    if (typeof v === 'string' && v.trim()) out[k] = v.trim().slice(0, MAX);
  }
  return out;
}
