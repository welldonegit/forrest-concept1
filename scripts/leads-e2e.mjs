/**
 * Сквозная проверка заявок в браузере (шаг 5.2, событие generate_lead — 2026-11-25): четыре источника —
 * «Фінмодель», финальная форма, квиз, попап апартамента — на uk и en.
 * - Заход по ссылке с UTM, переход на другую страницу и язык, отправка: в D1 заявка с метками из cookie gp_utm.
 * - После заявки — «Дякуємо» и ровно одно generate_lead (lead_id, form_id, form_name, form_location, user_data);
 *   GTM на «Дякуємо» грузится сразу; обновление и прямой заход события не дают.
 * - Ошибка проверки полей и ошибка отправки: ни события, ни перехода, введённое остаётся.
 * - Двойное нажатие: одна заявка, одно событие.
 * GTM подменён заглушкой (боевой контейнер с localhost не грузится): она запоминает очередь dataLayer на момент загрузки.
 *
 * Запуск: npm run build:test (фикстуры + тестовый ключ Turnstile для localhost)
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
const PHONE = '671234567';
const E164 = '+380671234567';
const EMAIL = 'e2e@example.com';

const chunks = readdirSync('dist/client/_astro').filter((f) => f.endsWith('.js'));
if (!chunks.some((f) => readFileSync(`dist/client/_astro/${f}`, 'utf8').includes(TEST_SITE_KEY))) {
  console.error('В сборке нет тестового ключа Turnstile для localhost: npm run build:test');
  process.exit(1);
}

const GTM_STUB = `window.__gtm = window.__gtm || []; window.__gtm.push((window.dataLayer || []).map((e) => e && e.event));`;

let worker, browser, context;
before(async () => {
  worker = await startWorker(PORT);
  browser = await chromium.launch();
  context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.route('https://www.googletagmanager.com/**', (r) => r.fulfill({ contentType: 'application/javascript', body: GTM_STUB }));
  // Заход по рекламной ссылке со старым адресом /uk/ (301 на «/» с теми же метками), затем переход на английскую:
  // cookie gp_utm (Path=/) общая для «/» и «/en/».
  const page = await context.newPage();
  await page.goto(`${worker.base}/uk/?${new URLSearchParams(UTM)}`);
  assert.equal(page.url(), `${worker.base}/?${new URLSearchParams(UTM)}`, '301 с /uk/ сохраняет метки');
  await page.goto(`${worker.base}/en/`);
  await page.close();
});
after(async () => {
  await browser?.close();
  worker?.stop();
});

const home = (lang) => (lang === 'uk' ? '/' : `/${lang}/`);
const thanks = (lang) => `${worker.base}${home(lang)}thanks/`;
/** Заявок в D1. Таблицу Worker создаёт при первой заявке — до неё 0. */
function leadCount() {
  if (!worker.sql("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'leads'").length) return 0;
  return worker.sql('SELECT count(*) AS c FROM leads')[0].c;
}

/** Новая вкладка со своим «IP»: лимит — 5 заявок в минуту с адреса, тестов больше. */
let ipSeq = 10;
async function newPage() {
  const page = await context.newPage();
  const ip = `198.51.100.${ipSeq++}`;
  await page.route('**/api/lead', (r) => r.continue({ headers: { ...r.request().headers(), 'cf-connecting-ip': ip } }));
  return page;
}

/**
 * Источники: open — дойти до полей; fill — заполнить верно; bad — неверный телефон (проверка полей);
 * values — введённое (должно остаться после ошибки); user — ожидаемый user_data; data — проверка заявки в D1.
 */
const SOURCES = {
  finmodel: {
    form: 'finmodel', form_id: 'finmodel', form_name: 'Форма «Фінмодель»',
    async open(page) {
      const form = page.locator('form[data-lead-form="finmodel"]');
      await form.scrollIntoViewIfNeeded();
      return { scope: form, submit: form.locator('button[type=submit]'), status: form.locator('[data-form-status]') };
    },
    async fill({ scope }, phone = PHONE) {
      await scope.locator('input[name=name]').fill('E2E Finmodel');
      await scope.locator('input[name=phone]').pressSequentially(phone);
      await scope.locator('label.form__chip').last().click();
    },
    values: ({ scope }) => Promise.all(['name', 'phone'].map((n) => scope.locator(`input[name=${n}]`).inputValue())),
    user: { phone_number: E164 },
    data(d) {
      assert.equal(d.fields.name, 'E2E Finmodel');
      // выбранные значения — по-украински и на английской странице
      assert.equal(d.fields.format, 'Ще не визначився, потрібна консультація');
      assert.equal(d.fields.contactMethod, 'Дзвінок');
    },
  },
  final: {
    form: 'final', form_id: 'final_form', form_name: 'Фінальна форма',
    async open(page) {
      const form = page.locator('form[data-lead-form="final"]');
      await form.scrollIntoViewIfNeeded();
      return { scope: form, submit: form.locator('button[type=submit]'), status: form.locator('[data-form-status]') };
    },
    async fill({ scope }, phone = PHONE) {
      await scope.locator('input[name=name]').fill('E2E Final');
      await scope.locator('input[name=phone]').pressSequentially(phone);
      await scope.locator('select[name=goal]').selectOption({ index: 1 });
    },
    values: ({ scope }) => Promise.all(['name', 'phone'].map((n) => scope.locator(`input[name=${n}]`).inputValue())),
    user: { phone_number: E164 },
    data(d) {
      // вопрос «Який формат інвестиції…» — цель покупки
      assert.equal(d.fields.purpose, 'Зростання вартості активу');
      assert.equal(d.fields.format, undefined);
    },
  },
  quiz: {
    form: 'quiz', form_id: 'quiz', form_name: 'Квіз «Розрахунок доходу»',
    async open(page) {
      await page.locator('[data-popup="quiz"]').first().click();
      const dlg = page.locator('dialog[open]');
      await dlg.locator('[data-quiz-format]').first().click();
      await dlg.locator('[data-quiz-step="1"]:not([hidden])').waitFor();
      await dlg.locator('label.quiz__opt--row').first().click();
      await dlg.locator('[data-quiz-next]').click();
      await dlg.locator('[data-quiz-step="2"]:not([hidden])').waitFor();
      return { scope: dlg.locator('form[data-quiz-form]'), submit: dlg.locator('[data-quiz-submit]'), status: dlg.locator('[data-form-status]') };
    },
    async fill({ scope }, phone = PHONE) {
      await scope.locator('input[name=phone]').pressSequentially(phone);
      await scope.locator('input[name=email]').fill(EMAIL);
    },
    values: ({ scope }) => Promise.all(['phone', 'email'].map((n) => scope.locator(`input[name=${n}]`).inputValue())),
    user: { email: EMAIL, phone_number: E164 },
    data(d) {
      assert.equal(d.fields.email, EMAIL);
      assert.equal(d.quiz.answers.length, 2);
      assert.ok(d.quiz.answers.every((a) => a.question && a.answer));
      assert.ok(Object.keys(d.quiz.calc).length > 0, 'расчёт в заявке');
    },
  },
  apartment: {
    form: 'apartment', form_id: 'apartment_popup', form_name: 'Попап апартаменту',
    async open(page) {
      await page.locator('[data-popup="apartments"]').first().scrollIntoViewIfNeeded();
      await page.locator('button[data-popup="apartments"]').first().click();
      const form = page.locator('dialog[open] [data-apop-panel]:not([hidden]) form[data-apop-form]');
      await form.waitFor();
      const id = await form.getAttribute('id');
      return { scope: form, submit: form.locator('button[type=submit]'), status: page.locator(`[data-form-status="${id}"]`) };
    },
    async fill({ scope }, phone = PHONE) {
      await scope.locator('input[name=phone]').pressSequentially(phone);
    },
    values: ({ scope }) => Promise.all([scope.locator('input[name=phone]').inputValue()]),
    user: { phone_number: E164 },
    data(d) {
      assert.ok(d.fields.apartment);
      assert.equal(d.fields.name, undefined);
    },
  },
};

const leadEvents = (page) => page.evaluate(() => (window.dataLayer ?? []).filter((e) => e && e.event === 'generate_lead'));
const stored = (page) => page.evaluate(() => sessionStorage.getItem('lead_event'));
/** Подождать ms и вернуть, грузился ли GTM (заглушка). */
const gtmLoads = async (page, ms) => { await page.waitForTimeout(ms); return page.evaluate(() => window.__gtm ?? []); };

for (const [key, src] of Object.entries(SOURCES)) {
  for (const lang of ['uk', 'en']) {
    test(`${key} (${lang}): двойное нажатие → одна заявка, «Дякуємо», одно generate_lead; обновление и прямой заход — без события`, async () => {
      const page = await newPage();
      await page.goto(`${worker.base}${home(lang)}`);
      const f = await src.open(page);
      await src.fill(f);
      const before = leadCount();
      await Promise.all([page.waitForURL(thanks(lang), { timeout: 30000 }), f.submit.dblclick()]);

      // ровно одно событие со всеми параметрами
      const events = await leadEvents(page);
      assert.equal(events.length, 1, 'одно generate_lead');
      const [ev] = events;
      assert.match(ev.lead_id, /^FR-\d{6}$/);
      assert.deepEqual(ev, {
        event: 'generate_lead', lead_id: ev.lead_id, form_id: src.form_id, form_name: src.form_name,
        form_location: home(lang), user_data: src.user,
      });
      assert.equal(await stored(page), null, 'lead_event удалён сразу после чтения');

      // GTM — сразу, без действия посетителя (обычная задержка — 5 с после load); событие уже в очереди
      await page.waitForFunction(() => window.__gtm?.length, null, { timeout: 2000 });
      const [queue] = await page.evaluate(() => window.__gtm);
      assert.ok(queue.indexOf('gtm.js') < queue.indexOf('generate_lead'), 'generate_lead в очереди после gtm.js, до загрузки GTM');

      // одна заявка в D1 — та, чей номер в событии, с UTM из cookie
      assert.equal(leadCount(), before + 1, 'двойное нажатие — одна заявка');
      const [row] = worker.sql(`SELECT form, lang, data, attribution FROM leads WHERE id = ${Number(ev.lead_id.slice(3))}`);
      assert.equal(row.form, src.form);
      assert.equal(row.lang, lang);
      const attribution = JSON.parse(row.attribution);
      for (const [k, v] of Object.entries(UTM)) assert.equal(attribution[k], v, `UTM ${k}`);
      const data = JSON.parse(row.data);
      assert.equal(data.fields.phone, E164);
      src.data(data);

      // обновление «Дякуємо»: события нет, GTM — как обычно (не сразу)
      await page.reload();
      assert.equal((await leadEvents(page)).length, 0, 'после обновления события нет');
      assert.deepEqual(await gtmLoads(page, 1500), [], 'без lead_event GTM не грузится сразу');
      await page.close();

      // прямой заход
      const direct = await context.newPage();
      await direct.goto(thanks(lang));
      assert.equal((await leadEvents(direct)).length, 0, 'прямой заход — без события');
      await direct.close();
    });

    test(`${key} (${lang}): ошибка проверки полей — ни события, ни перехода, введённое остаётся`, async () => {
      const page = await newPage();
      const posts = [];
      page.on('request', (r) => { if (r.url().endsWith('/api/lead')) posts.push(r.url()); });
      const url = `${worker.base}${home(lang)}`;
      await page.goto(url);
      const f = await src.open(page);
      await src.fill(f, '67'); // неполный номер
      const entered = await src.values(f);
      await f.submit.click();
      await f.scope.locator('[aria-invalid=true]').first().waitFor();
      await page.waitForTimeout(500);
      assert.equal(page.url(), url);
      assert.deepEqual(posts, [], 'запроса нет');
      assert.equal((await leadEvents(page)).length, 0);
      assert.equal(await stored(page), null);
      assert.deepEqual(await src.values(f), entered);
      await page.close();
    });

    test(`${key} (${lang}): ошибка отправки — текст из Sanity, ни события, ни перехода, введённое остаётся`, async () => {
      const page = await context.newPage();
      await page.route('**/api/lead', (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{"ok":false,"error":"server_error"}' }));
      const url = `${worker.base}${home(lang)}`;
      await page.goto(url);
      const f = await src.open(page);
      await src.fill(f);
      const entered = await src.values(f);
      await f.submit.click();
      await f.status.waitFor({ state: 'visible', timeout: 30000 });
      assert.equal(await f.status.textContent(), await f.status.getAttribute('data-msg-send'));
      assert.equal(page.url(), url);
      assert.equal((await leadEvents(page)).length, 0);
      assert.equal(await stored(page), null);
      assert.deepEqual(await src.values(f), entered);
      assert.equal(await f.submit.isDisabled(), false, 'можно отправить ещё раз');
      await page.close();
    });
  }
}

test('lead_submit больше не отправляется', async () => {
  const page = await context.newPage();
  await page.goto(`${worker.base}/`);
  assert.equal(await page.evaluate(() => (window.dataLayer ?? []).some((e) => e?.event === 'lead_submit')), false);
  assert.ok(!chunks.some((f) => readFileSync(`dist/client/_astro/${f}`, 'utf8').includes('lead_submit')), 'в сборке нет lead_submit');
  await page.close();
});

test('клик раньше загрузки скрипта формы: заявка уходит через API, без перезагрузки', async () => {
  const page = await newPage();
  // скрипт формы приходит с задержкой 2 с — посетитель успевает заполнить и нажать
  await page.route(/\/_astro\/lead-form\.[^/]+\.js$/, async (r) => { await new Promise((ok) => setTimeout(ok, 2000)); await r.continue(); });
  const posts = [];
  page.on('request', (r) => { if (r.url().endsWith('/api/lead')) posts.push(r.headers()['content-type']); });
  await page.goto(`${worker.base}/en/`);
  const before = leadCount();
  const form = page.locator('form[data-lead-form="finmodel"]');
  await form.scrollIntoViewIfNeeded();
  await form.locator('input[name=name]').fill('E2E Early');
  await form.locator('input[name=phone]').fill(PHONE);
  assert.equal(await form.evaluate((f) => f.dataset.leadReady), undefined, 'модуль уже загружен — тест не проверяет ранний клик');
  await Promise.all([page.waitForURL('**/en/thanks/', { timeout: 30000 }), form.locator('button[type=submit]').click()]);
  assert.deepEqual(posts, ['application/json']);
  assert.equal(leadCount(), before + 1);
  assert.equal((await leadEvents(page)).length, 1);
  await page.close();
});

test('боевой адрес: виджет с боевым ключом, тестовый секрет сервер не принимает — заявки нет, видна ошибка', async () => {
  const b = await chromium.launch({ args: [`--host-resolver-rules=MAP forrest-prod.test 127.0.0.1`] });
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await page.route('https://www.googletagmanager.com/**', (r) => r.fulfill({ contentType: 'application/javascript', body: GTM_STUB }));
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
  await page.goto(`http://forrest-prod.test:${PORT}/`);
  const before = leadCount();
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
  assert.equal(leadCount(), before);
  assert.equal((await leadEvents(page)).length, 0);
  await b.close();
});

test('без JS: вместо кнопки — телефон и мессенджеры', async () => {
  const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(`${worker.base}/`);
  for (const id of ['finmodel', 'final']) {
    const form = page.locator(`form[data-lead-form="${id}"]`);
    assert.equal(await form.locator('button[type=submit]').isVisible(), false, `${id}: кнопка скрыта`);
    const phone = form.locator('.form__nojs a[href^="tel:"]');
    assert.equal(await phone.isVisible(), true, `${id}: телефон виден`);
  }
  await ctx.close();
});
