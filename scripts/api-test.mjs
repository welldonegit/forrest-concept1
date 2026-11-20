/**
 * Тесты API заявок (шаг 5.1) против локального Worker: `wrangler dev` + локальная D1
 * во временной папке + тестовые ключи Turnstile (siteverify Cloudflare — нужен интернет).
 *
 * Запуск: npm run build (нужна dist/client со страницей 404) → npm run test:api
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { startWorker } from './lib/local-worker.mjs';

const PORT = 8791;
const BASE = `http://127.0.0.1:${PORT}`;
const DUMMY_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';
const API_HEADER = 'x-forrest-api';

if (!existsSync('dist/client/404.html')) {
  // Страница 404 собирается, только когда её тексты есть в источнике контента.
  console.error('Нет dist/client/404.html: сначала npm run build (или CONTENT_SOURCE=fixtures npm run build)');
  process.exit(1);
}

let worker;
before(async () => { worker = await startWorker(PORT); });
after(() => worker?.stop());
const sql = (q) => worker.sql(q);

let ipCounter = 0;
/** Каждый тест — свой «IP», чтобы лимит частоты не мешал соседним тестам. */
const freshIp = () => `198.51.100.${++ipCounter}`;

function lead(overrides = {}) {
  return {
    key: crypto.randomUUID(),
    form: 'finmodel',
    lang: 'uk',
    page: `${BASE}/uk/`,
    turnstileToken: DUMMY_TOKEN,
    website: '',
    fields: { name: 'Тест', phone: '+380 (67) 123-45-67', contactMethod: 'telegram', format: 'Апартамент' },
    ...overrides,
  };
}

function post(body, { ip = freshIp(), headers = {} } = {}) {
  return fetch(`${BASE}/api/lead`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE, 'cf-connecting-ip': ip, ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const leadCount = (key) => sql(`SELECT COUNT(*) AS n FROM leads WHERE request_key = '${key}'`)[0].n;

test('статика идёт мимо Worker', async () => {
  for (const p of ['/uk/', '/en/', '/robots.txt']) {
    const r = await fetch(`${BASE}${p}`);
    assert.equal(r.status, 200, p);
    assert.equal(r.headers.get(API_HEADER), null, `${p} обработан Worker`);
  }
  const root = await fetch(`${BASE}/`, { redirect: 'manual' });
  assert.equal(root.status, 301);
  assert.equal(root.headers.get(API_HEADER), null);
});

test('несуществующий адрес: страница 404 сервера статики, не Worker', async () => {
  for (const [p, lang] of [['/uk/net-takoi-stranicy/', 'uk'], ['/en/no-such-page/', 'en'], ['/no-such-page/', 'uk']]) {
    const r = await fetch(`${BASE}${p}`, { headers: { 'sec-fetch-mode': 'navigate', accept: 'text/html' } });
    assert.equal(r.status, 404, p);
    assert.equal(r.headers.get(API_HEADER), null, `${p} дошёл до Worker`);
    const html = await r.text();
    assert.match(html, new RegExp(`<html[^>]*lang="${lang}"`), p);
    assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1, `${p}: один h1`);
  }
});

test('/api/* обрабатывает Worker', async () => {
  const get = await fetch(`${BASE}/api/lead`);
  assert.equal(get.status, 405);
  assert.equal(get.headers.get(API_HEADER), '1');
  const other = await fetch(`${BASE}/api/unknown`);
  assert.equal(other.status, 404);
  assert.equal(other.headers.get(API_HEADER), '1');
});

test('приём заявки: запись в D1, каналы «не настроен», UTM из cookie', async () => {
  const body = lead();
  const cookie = `gp_utm=${encodeURIComponent(JSON.stringify({ utm_source: 'google', utm_campaign: 'test', evil: 'x' }))}`;
  const r = await post(body, { headers: { cookie } });
  assert.equal(r.status, 200);
  const res = await r.json();
  assert.equal(res.ok, true);
  assert.match(res.number, /^FR-\d{6}$/);

  const [row] = sql(`SELECT id, form, lang, data, attribution FROM leads WHERE request_key = '${body.key}'`);
  assert.equal(row.form, 'finmodel');
  assert.equal(JSON.parse(row.data).fields.phone, '+380671234567');
  assert.deepEqual(JSON.parse(row.attribution), { utm_source: 'google', utm_campaign: 'test' });
  const deliveries = sql(`SELECT channel, status FROM lead_deliveries WHERE lead_id = ${row.id} ORDER BY channel`);
  assert.deepEqual(deliveries, [{ channel: 'crm', status: 'not_configured' }, { channel: 'telegram', status: 'not_configured' }]);
});

test('отказ без капчи', async () => {
  const noToken = lead({ turnstileToken: '' });
  const r1 = await post(noToken);
  assert.equal(r1.status, 403);
  assert.equal((await r1.json()).error, 'captcha');

  // Токен из одних пробелов — тоже без капчи.
  const blank = lead({ turnstileToken: '   ' });
  const r2 = await post(blank);
  assert.equal(r2.status, 403);
  assert.equal((await r2.json()).error, 'captcha');

  assert.equal(leadCount(noToken.key), 0);
  assert.equal(leadCount(blank.key), 0);
  // Ключ снят: тот же ключ с исправленной капчей проходит.
  const retry = await post({ ...noToken, turnstileToken: DUMMY_TOKEN });
  assert.equal(retry.status, 200);
});

test('двойное нажатие: одна заявка, оба ответа — тот же номер', async () => {
  const body = lead();
  const ip = freshIp();
  const [a, b] = await Promise.all([post(body, { ip }), post(body, { ip })]);
  const [ra, rb] = [await a.json(), await b.json()];
  assert.equal(a.status, 200, JSON.stringify(ra));
  assert.equal(b.status, 200, JSON.stringify(rb));
  assert.equal(ra.number, rb.number);
  // Поздний повтор того же ключа — тот же результат без новой записи.
  const c = await post(body, { ip });
  assert.equal((await c.json()).number, ra.number);
  assert.equal(leadCount(body.key), 1);
});

test('проверка полей', async () => {
  const r = await post(lead({ fields: { name: '', phone: '12' } }));
  assert.equal(r.status, 400);
  const res = await r.json();
  assert.equal(res.error, 'validation');
  assert.deepEqual(res.fields.sort(), ['name', 'phone']);
  // В попапе апартамента имя не обязательно.
  const apt = await post(lead({ form: 'apartment', fields: { phone: '+380671234567' } }));
  assert.equal(apt.status, 200);
  const bad = await post('{не json');
  assert.equal((await bad.json()).error, 'invalid_json');
});

test('ловушка: ответ как при успехе, без записи', async () => {
  const body = lead({ website: 'http://spam.example' });
  const r = await post(body);
  assert.equal(r.status, 200);
  assert.equal(leadCount(body.key), 0);
});

test('чужой Origin отклоняется', async () => {
  const r = await post(lead(), { headers: { origin: 'https://evil.example' } });
  assert.equal(r.status, 403);
  assert.equal((await r.json()).error, 'forbidden');
});

test('тестовые ключи Turnstile работают только локально и на превью', async () => {
  // Локальный сервер всегда видит адрес 127.0.0.1, поэтому правило проверяется напрямую.
  const { captchaSecret } = await import('../worker/lead/turnstile.ts');
  const test = { TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA' };
  assert.equal(captchaSecret(test, 'forrestresort.com'), null);
  assert.equal(captchaSecret(test, 'forrest-trinity-resort.forrestresort-com.workers.dev'), test.TURNSTILE_SECRET_KEY);
  assert.equal(captchaSecret(test, 'localhost'), test.TURNSTILE_SECRET_KEY);
  assert.equal(captchaSecret({ TURNSTILE_SECRET_KEY: '0x4AAAAAAAreal-secret' }, 'forrestresort.com'), '0x4AAAAAAAreal-secret');
  assert.equal(captchaSecret({}, 'forrestresort.com'), null);
  assert.equal(captchaSecret({ TURNSTILE_SECRET_KEY: '  ' }, 'localhost'), null);
});

test('лимит частоты: шестая заявка с одного IP за минуту — 429', async () => {
  const ip = freshIp();
  const statuses = [];
  for (let i = 0; i < 6; i++) statuses.push((await post(lead({ fields: { phone: '12' } }), { ip })).status);
  assert.deepEqual(statuses, [400, 400, 400, 400, 400, 429]);
});

test('форма без JS (обычный POST): возврат на страницу, ничего не записано', async () => {
  const before = sql('SELECT COUNT(*) AS n FROM leads')[0].n;
  const r = await fetch(`${BASE}/api/lead`, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded', origin: BASE, referer: `${BASE}/en/?x=1` },
    body: 'name=Test&phone=%2B380671234567',
  });
  assert.equal(r.status, 303);
  assert.equal(r.headers.get('location'), `${BASE}/en/`);
  assert.equal(sql('SELECT COUNT(*) AS n FROM leads')[0].n, before);
});
