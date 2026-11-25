/**
 * Тесты шага 5.4: CRM G-PLUS — против локального Worker и поддельных API CRM и Telegram
 * (CRM_API_BASE и TELEGRAM_API_BASE только в тестовом окружении).
 * Тело лида проверяется по docs/crm/api_schema.yaml (scripts/lib/crm-schema.mjs).
 *
 * Запуск: npm run build → npm run test:crm
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { startWorker, fetchLocal } from './lib/local-worker.mjs';
import { validateLeadBody } from './lib/crm-schema.mjs';

const PORT = 8797;
const FAKE_PORT = 8798;
const CRM_TOKEN = 'test-crm-token';
const TG_TOKEN = '123456:TEST-token';

// --- поддельные CRM и Telegram --------------------------------------------------------
/** crm: ok | error400 | error500 | slow (лид создаётся, ответ позже таймаута) | lost (504, лид не создан) */
let crmMode = 'ok';
let crmCalls = [];
let crmLeads = [];
let tgCalls = [];
let nextId = 5000;
// Connection: close — каждый запрос Worker идёт по новому соединению. С keep-alive Node закрывает простаивающее
// соединение через 5 с (keepAliveTimeout), и запрос Worker, отправленный в тот же момент, обрывался
// (no_response) — то же, что в schedule-test.mjs.
const fake = http.createServer((req, res) => {
  let raw = '';
  req.on('data', (d) => (raw += d));
  req.on('end', () => {
    const url = new URL(req.url, 'http://x');
    const send = (status, payload) => { res.writeHead(status, { 'content-type': 'application/json', connection: 'close' }); res.end(payload === undefined ? '' : JSON.stringify(payload)); };
    if (url.pathname === `/bot${TG_TOKEN}/sendMessage`) {
      tgCalls.push(JSON.parse(raw));
      return send(200, { ok: true, result: { message_id: 1 } });
    }
    if (!url.pathname.startsWith('/api/v1/leads')) return send(404, { detail: 'Not found' });
    crmCalls.push({ method: req.method, url, auth: req.headers.authorization, type: req.headers['content-type'], body: raw ? JSON.parse(raw) : null });
    if (req.headers.authorization !== `Token ${CRM_TOKEN}`) return send(401, { detail: 'Invalid token.' });
    if (req.method === 'GET') {
      const from = Date.parse(url.searchParams.get('added_at_gte'));
      const to = Date.parse(url.searchParams.get('added_at_lte'));
      const results = crmLeads.filter((l) => Date.parse(l.added_at) >= from && Date.parse(l.added_at) <= to).map(({ id, note }) => ({ id, note }));
      return send(200, { next: null, previous: null, results });
    }
    const body = JSON.parse(raw);
    if (crmMode === 'error400') return send(400, { contact: { email: ['Enter a valid email address: secret@example'] } });
    if (crmMode === 'error500') return send(500, { detail: 'Server Error' });
    if (crmMode === 'lost') return send(504);
    const lead = { id: nextId++, note: body.note, added_at: body.added_at };
    crmLeads.push(lead);
    if (crmMode === 'slow') return setTimeout(() => send(201, { id: lead.id }), 15_000);
    send(201, { id: lead.id });
  });
});

let worker;
before(async () => {
  await new Promise((r) => fake.listen(FAKE_PORT, '127.0.0.1', r));
  const base = `http://127.0.0.1:${FAKE_PORT}`;
  worker = await startWorker(PORT, {
    CRM_TOKEN, CRM_API_BASE: base, CRM_SOURCE: 'website', CRM_STAGE_ID: 'stage-new', CRM_BUILDING_ID: '42',
    TELEGRAM_BOT_TOKEN: TG_TOKEN, TELEGRAM_CHAT_ID: '-1001', TELEGRAM_API_BASE: base,
    CRM_FIELD_CONTACT_METHOD: 'f-method', CRM_FIELD_LAYOUT: 'f-layout', CRM_FIELD_GCLID: 'f-gclid', CRM_FIELD_FBCLID: 'f-fbclid',
  });
});
after(() => { if (process.env.DEBUG_WORKER) console.error(worker?.log()); worker?.stop(); fake.close(); fake.closeAllConnections?.(); });
beforeEach(() => { crmMode = 'ok'; crmCalls = []; tgCalls = []; });

const sql = (q) => worker.sql(q);
let ip = 0;
async function postLead(body = {}, cookie) {
  const lead = {
    key: crypto.randomUUID(), form: 'finmodel', lang: 'uk', page: `${worker.base}/`,
    turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX', website: '',
    fields: { name: 'Тест', phone: '+380671234567' },
    ...body,
  };
  const init = {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: worker.base, 'cf-connecting-ip': `192.0.2.${++ip}`, ...(cookie && { cookie }) },
    body: JSON.stringify(lead),
  };
  const r = await fetchLocal(`${worker.base}/api/lead`, init);
  const res = await r.json();
  assert.equal(r.status, 200, JSON.stringify(res));
  return { id: Number(res.number.slice(3)), number: res.number };
}
async function delivery(id, channel = 'crm', attempts = 1) {
  for (let i = 0; i < 40; i++) {
    const [row] = sql(`SELECT status, attempts, next_attempt_at, last_error, external_id FROM lead_deliveries WHERE lead_id = ${id} AND channel = '${channel}'`);
    if (row && row.attempts >= attempts) return row;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`доставка ${id}/${channel}: нет ${attempts}-й попытки`);
}
const makeDue = (id) => sql(`UPDATE lead_deliveries SET next_attempt_at = '2000-01-01T00:00:00.000Z' WHERE lead_id = ${id} AND channel = 'crm'`);
const posts = () => crmCalls.filter((c) => c.method === 'POST');
const bodyOf = (number) => posts().map((c) => c.body).find((b) => b.note.includes(`Номер: ${number}\n`));

test('6 источников: лид в CRM, тело по схеме, поля по таблице, пустых ключей нет', async () => {
  const cookie = `gp_utm=${encodeURIComponent(JSON.stringify({ utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'spring', gclid: 'g-1', referrer: 'https://www.google.com/' }))}`;
  const fin = await postLead({ lang: 'en', fields: { name: 'Олена', phone: '+380671234567', format: 'Superior', areaFrom: '29.5', areaTo: '34.5', contactMethod: 'Дзвінок' } }, cookie);
  const fin2 = await postLead({ fields: { name: 'Без формату', phone: '+380671234567', format: 'Ще не визначився, потрібна консультація' } });
  const final = await postLead({ form: 'final', fields: { name: 'Іван', phone: '+380501112233', purpose: 'Пасивний дохід', contactMethod: 'Telegram' } });
  const quiz = await postLead({
    form: 'quiz',
    fields: { phone: '+48501112233', email: 'a@example.com', consent: true, format: 'Deluxe', areaFrom: '43', areaTo: '50.9', budget: 'До $130 000', budgetCurrency: 'usd', country: '+48' },
    quiz: { answers: [{ question: 'Який формат апартаментів розглядаєте?', answer: 'Deluxe' }, { question: 'На який бюджет?', answer: 'До $130 000' }], calc: { price: 132750, income: 15930 } },
  });
  const apt = await postLead({ form: 'apartment', lang: 'en', fields: { phone: '+380931234567', apartment: 'Family Suite' } });
  const world = await postLead({ form: 'world', lang: 'en', fields: { name: 'Марта', phone: '+380631112233', contactMethod: 'Viber', world: 'ROCK' } });
  // попап «Звʼязатися»: без имени (по желанию) — CRM получает имя-заглушку с номером заявки
  const contact = await postLead({ form: 'contact', fields: { phone: '+380671112233' } });
  const contactNamed = await postLead({ form: 'contact', lang: 'en', fields: { name: 'Анна', phone: '+380671112244' } });
  for (const l of [fin, fin2, final, quiz, apt, world, contact, contactNamed]) {
    const row = await delivery(l.id);
    assert.equal(row.status, 'sent', `${l.number}: ${row.last_error}`);
    assert.match(row.external_id, /^\d+$/);
  }
  for (const c of posts()) {
    assert.equal(c.url.searchParams.get('fields'), 'id');
    assert.equal(c.auth, `Token ${CRM_TOKEN}`);
    assert.match(c.type, /^application\/json/);
    assert.deepEqual(validateLeadBody(c.body), [], JSON.stringify(c.body));
  }
  const b1 = bodyOf(fin.number);
  assert.equal(b1.contact.name, 'Олена');
  assert.deepEqual(b1.contact.phone_numbers, ['+380671234567']);
  assert.equal(b1.contact.preferred_contact_method, 'Дзвінок');
  assert.equal(b1.contact.language, 'en');
  assert.equal('email' in b1.contact, false, 'нет email — нет ключа');
  assert.equal(b1.source, 'website');
  assert.equal(b1.stage_id, 'stage-new');
  assert.deepEqual(b1.objects, [{ id: 42 }]);
  assert.equal(b1.note_section, 'Superior');
  assert.equal(b1.note_square_from, '29.5');
  assert.equal(b1.note_square_to, '34.5');
  assert.equal('note_purpose' in b1, false);
  assert.deepEqual(b1.data, {
    utm: { utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'spring' },
    custom_field_values: { 'f-method': ['Мобільний'], 'f-layout': ['Standart/Superior'], 'f-gclid': 'g-1' },
  });
  assert.ok(b1.note.startsWith(`Заявка з лендінгу Forrest\nНомер: ${fin.number}\nДжерело: форма «Фінмодель»\nСторінка: ${worker.base}/`));
  assert.match(b1.note, /\nreferrer: https:\/\/www\.google\.com\//);
  assert.doesNotMatch(b1.note, /gclid/, 'gclid — в своём поле, в note не дублируется');
  const [row1] = sql(`SELECT created_at FROM leads WHERE id = ${fin.id}`);
  assert.equal(b1.added_at, row1.created_at);

  const b2 = bodyOf(fin2.number);
  assert.equal(b2.note_section, 'Ще не визначився, потрібна консультація');
  assert.equal('note_square_from' in b2, false);
  assert.equal(b2.contact.language, 'ua', 'uk → ua');
  assert.equal('data' in b2, false, 'нет UTM — нет data');

  const b3 = bodyOf(final.number);
  assert.equal(b3.note_purpose, 'Пасивний дохід');
  assert.equal('note_section' in b3, false);
  assert.deepEqual(b3.data, { custom_field_values: { 'f-method': ['Telegram'] } });

  const b4 = bodyOf(quiz.number);
  assert.equal(b4.contact.name, `Заявка з сайту ${quiz.number}`, 'имя обязательно в CRM');
  assert.equal(b4.contact.email, 'a@example.com');
  assert.equal(b4.note_section, 'Deluxe');
  assert.deepEqual(b4.data, { custom_field_values: { 'f-layout': ['Deluxe/Premium apartments'] } });
  assert.equal(b4.note_square_from, '43');
  assert.equal(b4.note_budget, 'До $130 000');
  assert.equal(b4.note_budget_currency, 'usd');
  assert.match(b4.note, /Згода на обробку даних: так/);
  assert.match(b4.note, /Відповіді квізу:\nЯкий формат апартаментів розглядаєте\? — Deluxe/);
  assert.match(b4.note, /Вартість: 132750/);

  const b5 = bodyOf(apt.number);
  assert.equal(b5.note_section, 'Family Suite');
  assert.deepEqual(b5.data, { custom_field_values: { 'f-layout': ['Famili Suites/Apartments'] } });
  assert.equal(b5.contact.language, 'en');

  // попап мира: секция — только в note (отдельного поля и объекта нет), формата нет
  const b6 = bodyOf(world.number);
  assert.equal(b6.contact.name, 'Марта');
  assert.equal(b6.contact.preferred_contact_method, 'Viber');
  assert.ok(b6.note.startsWith(`Заявка з лендінгу Forrest\nНомер: ${world.number}\nДжерело: попап світу\n`));
  assert.match(b6.note, /\nСекція: ROCK(\n|$)/);
  assert.equal('note_section' in b6, false);

  // попап «Звʼязатися»: имя и телефон, источник — в note
  const b7 = bodyOf(contact.number);
  assert.equal(b7.contact.name, `Заявка з сайту ${contact.number}`);
  assert.deepEqual(b7.contact.phone_numbers, ['+380671112233']);
  assert.equal('preferred_contact_method' in b7.contact, false);
  assert.equal(b7.contact.language, 'ua');
  assert.ok(b7.note.startsWith(`Заявка з лендінгу Forrest\nНомер: ${contact.number}\nДжерело: попап «Звʼязатися» (шапка)\n`));
  for (const k of ['note_section', 'note_purpose', 'note_budget']) assert.equal(k in b7, false, k);
  const b8 = bodyOf(contactNamed.number);
  assert.equal(b8.contact.name, 'Анна');
  assert.equal(b8.contact.language, 'en');
});

test('явная ошибка CRM (400): код и пути полей без значений, повтор — без поиска', async () => {
  crmMode = 'error400';
  const l = await postLead();
  const row = await delivery(l.id);
  assert.equal(row.status, 'pending');
  assert.equal(row.last_error, 'crm 400: contact.email');
  crmMode = 'ok'; crmCalls = [];
  makeDue(l.id);
  await worker.runCron();
  assert.equal((await delivery(l.id, 'crm', 2)).status, 'sent');
  assert.deepEqual(crmCalls.map((c) => c.method), ['POST'], 'при явной ошибке поиск не нужен');
});

test('нет ответа, лид создан: повтор находит его по номеру — дубля нет', async () => {
  crmMode = 'slow';
  const l = await postLead();
  const row = await delivery(l.id);
  assert.equal(row.status, 'pending');
  assert.match(row.last_error, /^no_response: /);
  const created = crmLeads.filter((x) => x.note.includes(`Номер: ${l.number}\n`));
  assert.equal(created.length, 1);
  crmMode = 'ok'; crmCalls = [];
  makeDue(l.id);
  await worker.runCron();
  const after = await delivery(l.id, 'crm', 2);
  assert.equal(after.status, 'sent');
  assert.equal(after.external_id, String(created[0].id));
  assert.deepEqual(crmCalls.map((c) => c.method), ['GET'], 'нашёлся — повторно не создаём');
  assert.equal(crmCalls[0].url.searchParams.get('source'), 'website');
  assert.equal(crmLeads.filter((x) => x.note.includes(`Номер: ${l.number}\n`)).length, 1);
});

test('нет ответа (504), лид не создан: повтор ищет, не находит и создаёт', async () => {
  crmMode = 'lost';
  const l = await postLead();
  assert.match((await delivery(l.id)).last_error, /^no_response: crm 504/);
  crmMode = 'ok'; crmCalls = [];
  makeDue(l.id);
  await worker.runCron();
  assert.equal((await delivery(l.id, 'crm', 2)).status, 'sent');
  assert.deepEqual(crmCalls.map((c) => c.method), ['GET', 'POST']);
});

test('сбой CRM: Telegram доставлен независимо; после 3 попыток — одно сообщение о сбое CRM, затем о восстановлении', async () => {
  crmMode = 'error500';
  const a = await postLead();
  assert.equal((await delivery(a.id, 'telegram')).status, 'sent', 'Telegram не ждёт CRM');
  await delivery(a.id);
  makeDue(a.id); await worker.runCron(); await delivery(a.id, 'crm', 2);
  makeDue(a.id); tgCalls = [];
  await worker.runCron();
  const row = await delivery(a.id, 'crm', 3);
  assert.equal(row.status, 'failed');
  assert.equal(row.last_error, 'crm 500');
  const alerts = tgCalls.filter((m) => m.text.includes('Збій доставки заявок'));
  assert.equal(alerts.length, 1);
  assert.match(alerts[0].text, /CRM G-PLUS/);
  assert.match(alerts[0].text, new RegExp(a.number));
  assert.doesNotMatch(alerts[0].text, /Тест|380/);

  // вторая недоставленная — без нового сообщения
  const b = await postLead();
  await delivery(b.id);
  makeDue(b.id); await worker.runCron(); await delivery(b.id, 'crm', 2);
  makeDue(b.id); tgCalls = [];
  await worker.runCron();
  assert.equal((await delivery(b.id, 'crm', 3)).status, 'failed');
  assert.equal(tgCalls.filter((m) => m.text.includes('Збій')).length, 0);

  // CRM ожила
  crmMode = 'ok'; tgCalls = [];
  const c = await postLead();
  assert.equal((await delivery(c.id)).status, 'sent');
  let rec;
  for (let i = 0; i < 20 && !rec; i++) { rec = tgCalls.find((m) => m.text.includes('Доставку відновлено')); if (!rec) await new Promise((r) => setTimeout(r, 300)); }
  assert.ok(rec, 'сообщение о восстановлении');
  assert.match(rec.text, /CRM G-PLUS/);
  assert.match(rec.text, new RegExp(`${a.number}, ${b.number}`));
});

test('сборка тела: язык не из списка CRM, обрезка по схеме, кастомные поля UTM', async () => {
  const { buildCrmLead } = await import('../worker/channels/crm.ts');
  const long = (n) => 'Я'.repeat(n);
  const lead = {
    id: 7, number: 'FR-000007', createdAt: '2026-11-20T10:00:00.000Z', form: 'quiz', lang: 'kk', page: 'https://example.test/kk/',
    fields: { name: long(200), phone: '+380671234567', email: `${'a'.repeat(140)}@example.com`, purpose: long(200), format: long(200), budget: long(150), budgetCurrency: 'XYZ', areaFrom: '1234567', contactMethod: long(200) },
    attribution: { utm_source: 'google', utm_campaign: 'c' },
  };
  const body = buildCrmLead(lead, { utmFields: { utm_source: 'uuid-src', utm_term: 'uuid-term' } });
  assert.deepEqual(validateLeadBody(body), []);
  assert.equal('language' in body.contact, false);
  assert.match(body.note, /\nМова: kk\n/);
  assert.equal(body.contact.name.length, 140);
  assert.match(body.note, /Імʼя повністю: Я{200}/);
  assert.equal('email' in body.contact, false, 'обрезанный адрес не передаём');
  assert.match(body.note, /E-mail: a{140}@example\.com/);
  assert.equal(body.note_purpose.length, 150);
  assert.equal(body.note_section.length, 150);
  assert.equal(body.note_budget.length, 100);
  assert.equal('note_budget_currency' in body, false, 'валюты нет в списке CRM');
  assert.equal('note_square_from' in body, false, 'больше 6 цифр');
  assert.equal(body.contact.preferred_contact_method.length, 128);
  assert.deepEqual(body.data, { utm: { utm_source: 'google', utm_campaign: 'c' }, custom_field_values: { 'uuid-src': 'google' } });
  assert.equal('source' in body || 'stage_id' in body || 'objects' in body, false, 'не задано — не передаём');
});

test('кастомные поля CRM: значения точно из списка CRM, нет соответствия — поля нет', async () => {
  const { buildCrmLead, contactMethodOption, layoutOption } = await import('../worker/channels/crm.ts');
  // подписи форм (uk, из Sanity) → варианты CRM
  const methods = { Telegram: 'Telegram', WhatsApp: 'WhatsApp', Viber: 'Viber', 'Дзвінок': 'Мобільний', 'Телефонний дзвінок': 'Мобільний', 'Телефон': 'Мобільний', 'E-mail': undefined, '': undefined };
  for (const [v, want] of Object.entries(methods)) assert.equal(contactMethodOption(v), want, v);
  const layouts = {
    Superior: 'Standart/Superior', Deluxe: 'Deluxe/Premium apartments', 'Family Suite': 'Famili Suites/Apartments',
    'Junior Suite': 'Junior/Executive suite', Presidential: 'Presidential/Premium room',
    'Ще не визначився, потрібна консультація': undefined, Penthouse: undefined,
  };
  for (const [v, want] of Object.entries(layouts)) assert.equal(layoutOption(v), want, v);

  const lead = {
    id: 8, number: 'FR-000008', createdAt: '2026-11-20T10:00:00.000Z', form: 'apartment', lang: 'uk', page: 'https://example.test/',
    fields: { phone: '+380671234567', apartment: 'Junior Suite', contactMethod: 'Пошта' },
    attribution: { gclid: 'G', fbclid: 'F' },
  };
  const ids = { contactMethod: 'm', layout: 'l', gclid: 'g', fbclid: 'f' };
  const body = buildCrmLead(lead, { fields: ids });
  assert.deepEqual(validateLeadBody(body), []);
  assert.deepEqual(body.data, { custom_field_values: { l: ['Junior/Executive suite'], g: 'G', f: 'F' } }, 'способ связи без соответствия не передаётся');
  assert.doesNotMatch(body.note, /gclid|fbclid/);
  // ID не заданы — кастомных полей нет, gclid и fbclid — в note
  const plain = buildCrmLead(lead, {});
  assert.equal('data' in plain, false);
  assert.match(plain.note, /gclid: G\nfbclid: F/);
});

test('crm:check: сравнение без учёта порядка ключей, телефон — только цифры', async () => {
  const { same, hasPhone } = await import('./crm/compare.mjs');
  assert.ok(same({ utm_source: 's', utm_medium: 'm', utm_term: 't' }, { utm_term: 't', utm_medium: 'm', utm_source: 's' }));
  assert.ok(!same({ utm_source: 's' }, { utm_source: 'x' }));
  assert.ok(!same({ utm_source: 's' }, { utm_source: 's', utm_term: 't' }));
  assert.ok(same(undefined, null));
  assert.ok(same(['Telegram'], ['Telegram']));
  assert.ok(hasPhone(['+38 (067) 123-45-67'], '+380671234567'));
  assert.ok(hasPhone([[{ id: 1, phone_number: '380671234567' }], undefined], '+380671234567'));
  assert.ok(!hasPhone(['+380671234500'], '+380671234567'));
  assert.ok(!hasPhone([], '+380671234567'));
});
