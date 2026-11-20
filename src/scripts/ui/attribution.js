/**
 * Источник визита для заявок: cookie gp_utm на 30 дней, по последнему переходу (docs/LEADS.md).
 * Перезаписывается, когда посетитель пришёл по ссылке с метками (utm_*, gclid, fbclid)
 * или с другого сайта; переходы внутри сайта (в том числе смена языка) и прямые заходы её не трогают.
 * Сервер читает cookie сам (worker/lead/attribution.ts) — в теле заявки меток нет.
 */
const KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid'];
const MAX_AGE = 30 * 24 * 60 * 60;
const MAX_VALUE = 300;
const MAX_COOKIE = 3500;

export function trackAttribution() {
  try {
    const query = new URLSearchParams(location.search);
    let referrer = '';
    try {
      if (document.referrer && new URL(document.referrer).host !== location.host) referrer = document.referrer;
    } catch { /* нечитаемый referrer — как прямой заход */ }
    const marked = KEYS.some((k) => query.get(k));
    if (!marked && !referrer) return;

    const v = {};
    for (const k of KEYS) {
      const x = query.get(k)?.trim();
      if (x) v[k] = x.slice(0, MAX_VALUE);
    }
    if (referrer) v.referrer = referrer.slice(0, MAX_VALUE);
    v.landing = (location.origin + location.pathname + location.search).slice(0, MAX_VALUE);

    let value = encodeURIComponent(JSON.stringify(v));
    if (value.length > MAX_COOKIE) {
      delete v.landing;
      delete v.referrer;
      value = encodeURIComponent(JSON.stringify(v));
    }
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `gp_utm=${value}; Max-Age=${MAX_AGE}; Path=/; SameSite=Lax${secure}`;
  } catch { /* cookie недоступны — заявка уйдёт без меток */ }
}
