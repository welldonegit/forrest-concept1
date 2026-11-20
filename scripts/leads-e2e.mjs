/**
 * Сквозная проверка заявок в браузере (шаг 5.2): четыре источника — «Фінмодель», финальная форма,
 * квиз, попап апартамента. Заход по ссылке с UTM, переход на другую страницу и язык, отправка;
 * в D1 — заявка из каждого источника с метками из cookie gp_utm. Плюс: событие dataLayer без
 * личных данных, ошибка отправки сохраняет введённое, без JS вместо кнопки — телефон.
 *
 * Запуск: CONTENT_SOURCE=fixtures TURNSTILE_SITE_KEY=1x00000000000000000000AA npm run build
 *         → npm run test:e2e   (нужен интернет: капча Cloudflare с тестовыми ключами)
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { startWorker, TEST_SITE_KEY } from './lib/local-worker.mjs';

const PORT = 8794;
const UTM = { utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'e2e-spring', gclid: 'test-gclid' };

const chunks = readdirSync('dist/client/_astro').filter((f) => f.endsWith('.js'));
if (!chunks.some((f) => readFileSync(`dist/client/_astro/${f}`, 'utf8').includes(TEST_SITE_KEY))) {
  console.error(`Сборка без тестового ключа Turnstile: CONTENT_SOURCE=fixtures TURNSTILE_SITE_KEY=${TEST_SITE_KEY} npm run build`);
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
  await form.locator('label.form__chip').first().click();
  await Promise.all([page.waitForURL('**/en/thanks/', { timeout: 30000 }), form.locator('button[type=submit]').click()]);
  const data = checkLead('finmodel', 'en');
  assert.equal(data.fields.phone, '+380671234567');
  assert.equal(data.fields.name, 'E2E Finmodel');
  assert.ok(data.fields.format);
  assert.ok(data.fields.contactMethod);
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
  await Promise.all([page.waitForURL('**/uk/thanks/', { timeout: 30000 }), form.locator('button[type=submit]').click()]);
  checkLead('final', 'uk');
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
  await status.waitFor({ state: 'attached' });
  await page.waitForFunction(() => !document.querySelector('form[data-lead-form="finmodel"] [data-form-status]').hidden);
  assert.equal(await status.textContent(), await status.getAttribute('data-msg-send'));
  assert.equal(await form.locator('input[name=name]').inputValue(), 'E2E Error');
  assert.equal(page.url(), `${worker.base}/uk/`);
  assert.equal(await form.locator('button[type=submit]').isDisabled(), false);
  await page.close();
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
