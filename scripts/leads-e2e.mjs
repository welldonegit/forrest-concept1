/**
 * Сквозная проверка заявок в браузере (шаг 5.2): четыре источника — «Фінмодель», финальная форма,
 * квиз, попап апартамента. Заход по ссылке с UTM, переход на другую страницу и язык, отправка;
 * в D1 — заявка из каждого источника с метками из cookie gp_utm. Плюс: событие dataLayer без
 * личных данных, ошибка отправки сохраняет введённое, без JS вместо кнопки — телефон.
 *
 * Запуск: CONTENT_SOURCE=fixtures npm run build (тестовый ключ превью — из wrangler.jsonc)
 *         → npm run test:e2e   (нужен интернет: капча Cloudflare с тестовыми ключами)
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { wranglerVar } from '../src/integrations/wrangler-vars.ts';
import { startWorker, TEST_SITE_KEY } from './lib/local-worker.mjs';

const PORT = 8794;
const UTM = { utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'e2e-spring', gclid: 'test-gclid' };

const chunks = readdirSync('dist/client/_astro').filter((f) => f.endsWith('.js'));
if (!chunks.some((f) => readFileSync(`dist/client/_astro/${f}`, 'utf8').includes(TEST_SITE_KEY))) {
  console.error('В сборке нет тестового ключа Turnstile (wrangler.jsonc → TURNSTILE_PREVIEW_SITE_KEY): CONTENT_SOURCE=fixtures npm run build');
  process.exit(1);
}

let worker, browser, context;
before(async () => {
  worker = await startWorker(PORT);
  browser = await chromium.launch();
  context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  // Заход по рекламной ссылке на украинскую главную, затем переход на английскую.
  const page = await context.newPage();
  await page.goto(`${worker.base}/uk/?${new URLSearchParams(UTM)}`);
  await page.goto(`${worker.base}/en/`);
  await page.close();
});
after(async () => {
  await browser?.close();
  worker?.stop();
});

const PHONE = '671234567';
const leadsOf = (form) => worker.sql(`SELECT id, lang, page, data, attribution FROM leads WHERE form = '${form}' ORDER BY id`);

function checkLead(form, lang) {
  const rows = leadsOf(form);
  assert.equal(rows.length, 1, `${form}: одна заявка в D1`);
  const [row] = rows;
  assert.equal(row.lang, lang);
  const attribution = JSON.parse(row.attribution);
  for (const [k, v] of Object.entries(UTM)) assert.equal(attribution[k], v, `${form}: ${k}`);
  assert.match(attribution.landing, /\/uk\/\?utm_source=google/);
  return JSON.parse(row.data);
}

async function leadEvents(page) {
  return page.evaluate(() => (window.dataLayer ?? []).filter((e) => e && e.event === 'lead_submit').map(({ event, lead_form, lead_language, ...rest }) => ({ event, lead_form, lead_language, extra: Object.keys(rest) })));
}

test('«Фінмодель» (en): заявка в D1 с UTM, переход на «Дякуємо»', async () => {
  const page = await context.newPage();
  await page.goto(`${worker.base}/en/`);
  const form = page.locator('form[data-lead-form="finmodel"]');
  await form.scrollIntoViewIfNeeded();
  await form.locator('input[name=name]').fill('E2E Finmodel');
  await form.locator('input[name=phone]').pressSequentially(PHONE);
  await form.locator('label.form__chip').last().click();
  await Promise.all([page.waitForURL('**/en/thanks/', { timeout: 30000 }), form.locator('button[type=submit]').click()]);
  const data = checkLead('finmodel', 'en');
  assert.equal(data.fields.phone, '+380671234567');
  assert.equal(data.fields.name, 'E2E Finmodel');
  // выбранные значения — по-украински на английской странице
  assert.equal(data.fields.format, 'Ще не визначився, потрібна консультація');
  assert.equal(data.fields.contactMethod, 'Дзвінок');
  await page.close();
});

test('клик раньше загрузки скрипта формы: заявка уходит через API, без перезагрузки', async () => {
  const page = await context.newPage();
  // скрипт формы приходит с задержкой 2 с — посетитель успевает заполнить и нажать
  await page.route(/\/_astro\/lead-form\.[^/]+\.js$/, async (r) => { await new Promise((ok) => setTimeout(ok, 2000)); await r.continue(); });
  const posts = [];
  page.on('request', (r) => { if (r.url().endsWith('/api/lead')) posts.push(r.headers()['content-type']); });
  await page.goto(`${worker.base}/en/`);
  const before = leadsOf('finmodel').length;
  const form = page.locator('form[data-lead-form="finmodel"]');
  await form.scrollIntoViewIfNeeded();
  await form.locator('input[name=name]').fill('E2E Early');
  await form.locator('input[name=phone]').fill(PHONE);
  assert.equal(await form.evaluate((f) => f.dataset.leadReady), undefined, 'модуль уже загружен — тест не проверяет ранний клик');
  await Promise.all([page.waitForURL('**/en/thanks/', { timeout: 30000 }), form.locator('button[type=submit]').click()]);
  assert.deepEqual(posts, ['application/json']);
  const rows = leadsOf('finmodel');
  assert.equal(rows.length, before + 1);
  assert.equal(JSON.parse(rows.at(-1).data).fields.phone, '+380671234567');
  await page.close();
});

test('финальная форма (uk): заявка в D1 с UTM, переход на «Дякуємо»', async () => {
  const page = await context.newPage();
  await page.goto(`${worker.base}/uk/archive/`);
  await page.goto(`${worker.base}/uk/`);
  const form = page.locator('form[data-lead-form="final"]');
  await form.scrollIntoViewIfNeeded();
  await form.locator('input[name=name]').fill('E2E Final');
  await form.locator('input[name=phone]').pressSequentially(PHONE);
  await form.locator('select[name=goal]').selectOption({ index: 1 });
  await Promise.all([page.waitForURL('**/uk/thanks/', { timeout: 30000 }), form.locator('button[type=submit]').click()]);
  const data = checkLead('final', 'uk');
  // вопрос «Який формат інвестиції…» — цель покупки
  assert.equal(data.fields.purpose, 'Зростання вартості активу');
  assert.equal(data.fields.format, undefined);
  await page.close();
});

test('квиз (uk): ответы и расчёт в D1, шаг «Дякуємо», событие без личных данных', async () => {
  const page = await context.newPage();
  await page.goto(`${worker.base}/uk/`);
  await page.locator('[data-popup="quiz"]').first().click();
  const dlg = page.locator('dialog[open]');
  await dlg.locator('[data-quiz-format]').first().click();
  await dlg.locator('[data-quiz-step="1"]:not([hidden])').waitFor();
  await dlg.locator('label.quiz__opt--row').first().click();
  await dlg.locator('[data-quiz-next]').click();
  await dlg.locator('[data-quiz-step="2"]:not([hidden])').waitFor();
  await dlg.locator('input[name=phone]').pressSequentially(PHONE);
  await dlg.locator('input[name=email]').fill('e2e@example.com');
  await dlg.locator('[data-quiz-submit]').click();
  await dlg.locator('[data-quiz-step="3"]:not([hidden])').waitFor({ timeout: 30000 });
  const data = checkLead('quiz', 'uk');
  assert.equal(data.fields.phone, '+380671234567');
  assert.equal(data.fields.email, 'e2e@example.com');
  assert.equal(data.quiz.answers.length, 2);
  assert.ok(data.quiz.answers.every((a) => a.question && a.answer));
  assert.ok(Object.keys(data.quiz.calc).length > 0);
  const events = await leadEvents(page);
  assert.equal(events.length, 1);
  assert.equal(events[0].lead_form, 'quiz');
  assert.equal(events[0].lead_language, 'uk');
  // Кроме формы и языка — только служебные поля GTM, никаких данных посетителя.
  const allowed = ['eventCallback', 'eventTimeout', 'gtm.uniqueEventId'];
  assert.deepEqual(events[0].extra.filter((k) => !allowed.includes(k)), []);
  await page.close();
});

test('попап апартамента (en): заявка в D1, кнопка «успех»', async () => {
  const page = await context.newPage();
  await page.goto(`${worker.base}/en/`);
  await page.locator('[data-popup="apartments"]').first().scrollIntoViewIfNeeded();
  await page.locator('button[data-popup="apartments"]').first().click();
  const panel = page.locator('dialog[open] [data-apop-panel]:not([hidden])');
  const form = panel.locator('form[data-apop-form]');
  await form.locator('input[name=phone]').pressSequentially(PHONE);
  await form.locator('button[type=submit]').click();
  await page.waitForFunction(() => document.querySelector('dialog[open] [data-apop-panel]:not([hidden]) form[data-apop-form]')?.hasAttribute('data-sent'), null, { timeout: 30000 });
  const data = checkLead('apartment', 'en');
  assert.ok(data.fields.apartment);
  assert.equal(data.fields.name, undefined);
  await page.close();
});

test('ошибка отправки: текст из Sanity, введённое остаётся', async () => {
  const page = await context.newPage();
  await page.route('**/api/lead', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"ok":false,"error":"server_error"}' }));
  await page.goto(`${worker.base}/uk/`);
  const form = page.locator('form[data-lead-form="finmodel"]');
  await form.scrollIntoViewIfNeeded();
  await form.locator('input[name=name]').fill('E2E Error');
  await form.locator('input[name=phone]').pressSequentially(PHONE);
  await form.locator('button[type=submit]').click();
  const status = form.locator('[data-form-status]');
  await status.waitFor({ state: 'visible' });
  assert.equal(await status.textContent(), await status.getAttribute('data-msg-send'));
  assert.equal(await form.locator('input[name=name]').inputValue(), 'E2E Error');
  assert.equal(page.url(), `${worker.base}/uk/`);
  assert.equal(await form.locator('button[type=submit]').isDisabled(), false);
  await page.close();
});

test('боевой адрес: виджет с боевым ключом, тестовый секрет сервер не принимает — заявки нет, видна ошибка', async () => {
  const b = await chromium.launch({ args: [`--host-resolver-rules=MAP forrest-prod.test 127.0.0.1`] });
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
  // свой «IP»: предыдущие тесты с того же адреса уже исчерпали лимит 5 заявок в минуту
  await page.setExtraHTTPHeaders({ 'cf-connecting-ip': '198.51.100.250' });
  // Turnstile подменён заглушкой: запоминает ключ виджета и сразу выдаёт токен.
  await page.route('https://challenges.cloudflare.com/**', (r) => r.fulfill({
    contentType: 'application/javascript',
    body: `window.__sitekeys = []; window.turnstile = {
      render(el, o) { window.__sitekeys.push(o.sitekey); setTimeout(() => o.callback('stub-token')); return 'w1'; },
      reset() {}, remove() {} };
      window.__forrestTurnstile && window.__forrestTurnstile();`,
  }));
  const responses = [];
  page.on('response', async (r) => { if (r.url().includes('/api/lead')) responses.push(await r.json().catch(() => null)); });
  await page.goto(`http://forrest-prod.test:${PORT}/uk/`);
  const before = leadsOf('finmodel').length;
  const form = page.locator('form[data-lead-form="finmodel"]');
  await form.scrollIntoViewIfNeeded();
  await form.locator('input[name=name]').fill('E2E Prod');
  await form.locator('input[name=phone]').pressSequentially(PHONE);
  await form.locator('button[type=submit]').click();
  const status = form.locator('[data-form-status]');
  await status.waitFor({ state: 'visible' });
  const siteKey = wranglerVar('TURNSTILE_SITE_KEY');
  assert.ok(siteKey && !siteKey.startsWith('1x'), 'в wrangler.jsonc боевой ключ');
  assert.deepEqual(await page.evaluate(() => window.__sitekeys), [siteKey], 'на боевом адресе — боевой ключ, не тестовый');
  assert.deepEqual(responses.map((r) => r?.error), ['captcha_unavailable'], 'тестовый секрет на боевом адресе не принимается');
  assert.equal(await status.textContent(), await status.getAttribute('data-msg-send'));
  assert.equal(leadsOf('finmodel').length, before);
  await b.close();
});

test('без JS: вместо кнопки — телефон и мессенджеры', async () => {
  const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(`${worker.base}/uk/`);
  for (const id of ['finmodel', 'final']) {
    const form = page.locator(`form[data-lead-form="${id}"]`);
    assert.equal(await form.locator('button[type=submit]').isVisible(), false, `${id}: кнопка скрыта`);
    const phone = form.locator('.form__nojs a[href^="tel:"]');
    assert.equal(await phone.isVisible(), true, `${id}: телефон виден`);
  }
  await ctx.close();
});
