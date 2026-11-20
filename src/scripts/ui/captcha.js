/**
 * Turnstile (Cloudflare) для форм заявки.
 * - Скрипт Cloudflare грузится один раз, когда посетитель дошёл до формы (preloadCaptcha),
 *   а виджет формы создаётся при первом касании её полей или при отправке — не на загрузке страницы.
 * - Вид «interaction-only»: виджет виден, только если Cloudflare попросит действие посетителя.
 * - Истёкший токен обновляется сам (refresh-expired: auto); после каждой отправки — новый токен.
 * - Ключ — __TURNSTILE_SITE_KEY__ (wrangler.jsonc → vars). Пусто — token() отклоняется,
 *   форма показывает ошибку отправки (заявка без капчи не уходит).
 */
const SITE_KEY = __TURNSTILE_SITE_KEY__;
const API = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__forrestTurnstile';
const TOKEN_TIMEOUT_MS = 20000;

let api = null;

export function preloadCaptcha() {
  if (!SITE_KEY) return Promise.reject(new Error('captcha_not_configured'));
  api ??= new Promise((resolve, reject) => {
    window.__forrestTurnstile = () => resolve(window.turnstile);
    const s = document.createElement('script');
    s.src = API;
    s.async = true;
    s.onerror = () => { api = null; reject(new Error('captcha_load')); };
    document.head.appendChild(s);
  });
  return api;
}

/** Капча формы: box — пустой контейнер [data-turnstile] внутри формы. */
export function attachCaptcha(form) {
  const box = form.querySelector('[data-turnstile]');
  let widget = null;
  let token = '';
  let waiters = [];

  const settle = (fn) => { const w = waiters; waiters = []; w.forEach(fn); };

  function render() {
    widget ??= preloadCaptcha().then((ts) => ts.render(box, {
      sitekey: SITE_KEY,
      appearance: 'interaction-only',
      'refresh-expired': 'auto',
      callback: (t) => { token = t; settle((w) => w.resolve(t)); },
      'expired-callback': () => { token = ''; },
      'error-callback': () => { token = ''; settle((w) => w.reject(new Error('captcha_error'))); },
      // Контейнер скрыт (CSS), пока Cloudflare не попросит действие посетителя: иначе пустой виджет сдвигает форму.
      'before-interactive-callback': () => { box.dataset.interactive = ''; },
      'after-interactive-callback': () => { delete box.dataset.interactive; },
    }));
    return widget;
  }

  form.addEventListener('focusin', () => { render().catch(() => {}); }, { once: true });

  return {
    async token() {
      await render();
      if (token) return token;
      return new Promise((resolve, reject) => {
        const w = { resolve, reject };
        waiters.push(w);
        setTimeout(() => { waiters = waiters.filter((x) => x !== w); reject(new Error('captcha_timeout')); }, TOKEN_TIMEOUT_MS);
      });
    },
    /** Токен одноразовый: после отправки просим новый. */
    reset() {
      token = '';
      widget?.then((id) => window.turnstile?.reset(id)).catch(() => {});
    },
  };
}
