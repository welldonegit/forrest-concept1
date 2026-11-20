/**
 * Тесты шага 5.3: Telegram и расписание — против локального Worker и поддельного Bot API
 * (TELEGRAM_API_BASE в тестовом окружении; настоящий Telegram не вызывается).
 * Проверяются: формат сообщения, сбой Telegram (ошибка, таймаут, 429), повторы через 10 минут
 * и через час, «не доставлена» и одно служебное сообщение на серию, восстановление,
 * смена ID чата (группа → супергруппа), очистка старше 90 дней, расписание без внешних запросов.
 * «Время» сдвигается правкой next_attempt_at / created_at в локальной базе.
 *
 * Запуск: npm run build (нужна dist/client) → npm run test:schedule
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { startWorker } from './lib/local-worker.mjs';

const PORT = 8795;
const TG_PORT = 8796;
const TOKEN = '123456:TEST-token';
const CHAT = '-1001234567890';
const NEW_CHAT = -1009876543210;
const MIN = 60_000;

// --- поддельный Bot API ---------------------------------------------------------------
/** mode: ok | error | slow (ответ позже таймаута Worker) | flood (429) | migrated */
let mode = 'ok';
let calls = [];
let nextMessageId = 100;
const tg = http.createServer((req, res) => {
  let body = '';
  req.on('data', (d) => (body += d));
  req.on('end', () => {
    const json = JSON.parse(body || '{}');
    calls.push({ path: req.url, ...json });
    const send = (status, payload) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(payload)); };
    if (req.url !== `/bot${TOKEN}/sendMessage`) return send(404, { ok: false, error_code: 404, description: 'Not Found' });
    if (mode === 'error') return send(500, { ok: false, error_code: 500, description: 'Internal Server Error' });
    if (mode === 'flood') return send(429, { ok: false, error_code: 429, description: 'Too Many Requests: retry after 30', parameters: { retry_after: 30 } });
    if (mode === 'slow') return setTimeout(() => send(200, { ok: true, result: { message_id: nextMessageId++ } }), 15_000);
    if (mode === 'migrated' && String(json.chat_id) === CHAT) {
      return send(400, { ok: false, error_code: 400, description: 'Bad Request: group chat was upgraded to a supergroup chat', parameters: { migrate_to_chat_id: NEW_CHAT } });
    }
    send(200, { ok: true, result: { message_id: nextMessageId++ } });
  });
});

let worker;
before(async () => {
  await new Promise((r) => tg.listen(TG_PORT, '127.0.0.1', r));
  worker = await startWorker(PORT, {
    TELEGRAM_BOT_TOKEN: TOKEN,
    TELEGRAM_CHAT_ID: CHAT,
    TELEGRAM_API_BASE: `http://127.0.0.1:${TG_PORT}`,
  });
});
after(() => { worker?.stop(); tg.close(); tg.closeAllConnections?.(); });
beforeEach(() => { mode = 'ok'; calls = []; });

const sql = (q) => worker.sql(q);
let ip = 0;
async function postLead(body = {}, cookie) {
  const lead = {
    key: crypto.randomUUID(), form: 'finmodel', lang: 'uk', page: `${worker.base}/uk/`,
    turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX', website: '',
    fields: { name: 'Тест', phone: '+380 (67) 123-45-67', contactMethod: 'telegram', format: 'Апартамент' },
    ...body,
  };
  const r = await fetch(`${worker.base}/api/lead`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: worker.base, 'cf-connecting-ip': `203.0.113.${++ip}`, ...(cookie && { cookie }) },
    body: JSON.stringify(lead),
  });
  const res = await r.json();
  assert.equal(r.status, 200, JSON.stringify(res));
  return Number(res.number.slice(3));
}
/** Фоновая отправка идёт после ответа — ждём, пока статус перестанет быть «ещё не пробовали». */
async function delivery(id, { attempts = 1 } = {}) {
  for (let i = 0; i < 40; i++) {
    const [row] = sql(`SELECT d.status, d.attempts, d.next_attempt_at, d.last_error, d.external_id, l.created_at
      FROM lead_deliveries d JOIN leads l ON l.id = d.lead_id WHERE d.lead_id = ${id} AND d.channel = 'telegram'`);
    if (row && row.attempts >= attempts) return row;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`доставка ${id}: нет ${attempts}-й попытки`);
}
/** «Прошло время»: срок следующей попытки — уже наступил. */
const makeDue = (id) => sql(`UPDATE lead_deliveries SET next_attempt_at = '2000-01-01T00:00:00.000Z' WHERE lead_id = ${id} AND channel = 'telegram'`);
const offsetMin = (row) => Math.round((Date.parse(row.next_attempt_at) - Date.parse(row.created_at)) / MIN);
const leadMessages = () => calls.filter((c) => c.text?.startsWith('<b>Заявка з лендінгу Forrest</b>'));
const serviceMessages = () => calls.filter((c) => c.text && !c.text.startsWith('<b>Заявка з лендінгу Forrest</b>'));

test('успех: сообщение в Telegram — HTML с экранированием, пустых полей нет, UTM отдельным блоком', async () => {
  const cookie = `gp_utm=${encodeURIComponent(JSON.stringify({ utm_source: 'google', utm_campaign: 'spring<&>' }))}`;
  const id = await postLead({ fields: { name: 'Іван <b>&</b> "Тест"', phone: '+380671234567', contactMethod: 'viber' } }, cookie);
  const row = await delivery(id);
  assert.equal(row.status, 'sent');
  assert.equal(row.next_attempt_at, null);
  assert.ok(row.external_id, 'message_id сохранён');
  const [msg] = leadMessages();
  assert.equal(msg.chat_id, CHAT);
  assert.equal(msg.parse_mode, 'HTML');
  assert.deepEqual(msg.link_preview_options, { is_disabled: true });
  assert.match(msg.text, new RegExp(`№ <b>FR-${String(id).padStart(6, '0')}</b> · Форма «Фінмодель»`));
  assert.match(msg.text, /Імʼя: Іван &lt;b&gt;&amp;&lt;\/b&gt; &quot;Тест&quot;/);
  assert.match(msg.text, /Звʼязок: Viber/);
  assert.match(msg.text, /\(Київ\) · мова: uk/);
  assert.doesNotMatch(msg.text, /E-mail|Формат|Бюджет/, 'пустые поля не выводятся');
  assert.match(msg.text, /\n\n<b>Джерело<\/b>\nutm_source: google\nutm_campaign: spring&lt;&amp;&gt;$/);
  assert.ok(msg.text.length <= 4096);
});

test('сбой Telegram: повторы через 10 минут и через час, затем «не доставлена» и одно служебное сообщение на серию', async () => {
  mode = 'error';
  const a = await postLead();
  let row = await delivery(a);
  assert.equal(row.status, 'pending');
  assert.equal(offsetMin(row), 10, 'второй раз — через 10 минут после заявки');
  assert.match(row.last_error, /^telegram 500/);

  // время не пришло — расписание не делает внешних запросов
  calls = [];
  await worker.runCron();
  assert.equal(calls.length, 0);

  makeDue(a);
  await worker.runCron();
  row = await delivery(a, { attempts: 2 });
  assert.equal(row.status, 'pending');
  assert.equal(offsetMin(row), 60, 'третий раз — через час после заявки');

  makeDue(a);
  calls = [];
  await worker.runCron();
  row = await delivery(a, { attempts: 3 });
  assert.equal(row.status, 'failed');
  assert.equal(row.next_attempt_at, null);
  assert.equal(leadMessages().length, 1);
  const alerts = serviceMessages();
  assert.equal(alerts.length, 1, 'одно служебное сообщение о сбое');
  assert.match(alerts[0].text, /Збій доставки заявок: Telegram/);
  assert.doesNotMatch(alerts[0].text, /Тест|380/, 'в служебном сообщении нет личных данных');

  // попыток больше нет
  makeDue(a);
  sql(`UPDATE lead_deliveries SET status = 'failed' WHERE lead_id = ${a}`);
  calls = [];
  await worker.runCron();
  assert.equal(calls.length, 0);

  // вторая заявка в той же серии: попытки есть, служебного сообщения — нет
  const b = await postLead();
  await delivery(b);
  makeDue(b); await worker.runCron(); await delivery(b, { attempts: 2 });
  makeDue(b); calls = [];
  await worker.runCron();
  assert.equal((await delivery(b, { attempts: 3 })).status, 'failed');
  assert.equal(serviceMessages().length, 0, 'серия уже открыта');
  assert.equal(sql(`SELECT failed_count FROM channel_alerts WHERE channel = 'telegram'`)[0].failed_count, 2);

  // канал ожил: заявка доставлена, одно сообщение о восстановлении с номерами недоставленных
  mode = 'ok'; calls = [];
  const c = await postLead();
  assert.equal((await delivery(c)).status, 'sent');
  for (let i = 0; i < 20 && !serviceMessages().length; i++) await new Promise((r) => setTimeout(r, 300));
  const [rec] = serviceMessages();
  assert.ok(rec, 'сообщение о восстановлении');
  assert.match(rec.text, /Доставку відновлено: Telegram/);
  assert.match(rec.text, new RegExp(`FR-${String(a).padStart(6, '0')}, FR-${String(b).padStart(6, '0')}`));
  assert.equal(sql(`SELECT COUNT(*) AS n FROM channel_alerts`)[0].n, 0);

  // следующая успешная — без служебных сообщений
  calls = [];
  await delivery(await postLead());
  assert.equal(serviceMessages().length, 0);
});

test('нет ответа (таймаут 10 с) и 429: заявка ждёт повтора', async () => {
  mode = 'slow';
  const a = await postLead();
  const row = await delivery(a);
  assert.equal(row.status, 'pending');
  assert.match(row.last_error, /Timeout|Abort/);
  mode = 'flood';
  const b = await postLead();
  const rowB = await delivery(b);
  assert.equal(rowB.status, 'pending');
  assert.match(rowB.last_error, /^telegram 429.*retry_after 30/);
  // повтор по расписанию проходит
  mode = 'ok';
  makeDue(a); makeDue(b);
  await worker.runCron();
  assert.equal((await delivery(a, { attempts: 2 })).status, 'sent');
  assert.equal((await delivery(b, { attempts: 2 })).status, 'sent');
});

test('группа стала супергруппой: отправка на новый ID чата в той же попытке', async () => {
  mode = 'migrated';
  const id = await postLead();
  assert.equal((await delivery(id)).status, 'sent');
  assert.deepEqual(leadMessages().map((m) => String(m.chat_id)), [CHAT, String(NEW_CHAT)]);
});

test('сообщения всех четырёх источников; длинный квиз укорачивается до 4096', async () => {
  await delivery(await postLead({ form: 'final', fields: { name: 'Олена', phone: '+380501112233', purpose: 'Пасивний дохід' } }));
  await delivery(await postLead({ form: 'apartment', lang: 'en', fields: { phone: '+380501112233', apartment: 'Deluxe' } }));
  const long = 'Д'.repeat(280);
  await delivery(await postLead({
    form: 'quiz',
    fields: { phone: '+48 501112233', email: 'a@b.c', consent: true, format: 'Superior', budget: 'До $130 000', country: '+48' },
    quiz: { answers: Array.from({ length: 30 }, (_, i) => ({ question: `Питання ${i} ${long}`, answer: long })), calc: { price: 132750, income: 15930 } },
  }));
  const [final, apt, quiz] = leadMessages();
  assert.match(final.text, /Фінальна форма/);
  assert.match(final.text, /\nМета: Пасивний дохід\n/);
  assert.match(apt.text, /Попап апартаменту[\s\S]*мова: en[\s\S]*Апартамент: Deluxe/);
  assert.doesNotMatch(apt.text, /Імʼя/);
  assert.match(quiz.text, /Квіз «Розрахунок доходу»/);
  assert.ok(quiz.text.length <= 4096, `длина ${quiz.text.length}`);
  assert.match(quiz.text, /Скорочено — повністю в базі заявок/);
});

test('«Фінмодель»: поле «Площа апартаментів» — формат и площадь', async () => {
  await delivery(await postLead({ fields: { name: 'Тест', phone: '+380671234567', format: 'Superior', areaFrom: '29.5', areaTo: '34.5' } }));
  const [msg] = leadMessages();
  assert.match(msg.text, /\nПлоща апартаментів: Superior, 29,5–34,5 м²\n/);
  assert.doesNotMatch(msg.text, /Площа від|Формат:/);
});

test('очистка: заявки старше 90 дней удаляются вместе со статусами и ключами', async () => {
  const old = await postLead(); await delivery(old);
  const fresh = await postLead(); await delivery(fresh);
  const ago = (d) => new Date(Date.now() - d * 24 * 60 * MIN).toISOString();
  sql(`UPDATE leads SET created_at = '${ago(91)}' WHERE id = ${old}`);
  sql(`UPDATE leads SET created_at = '${ago(89)}' WHERE id = ${fresh}`);
  sql(`INSERT INTO lead_requests (key, lead_id, claimed_at) VALUES ('stale-claim', NULL, '${ago(2)}')`);
  calls = [];
  await worker.runCron();
  assert.equal(sql(`SELECT COUNT(*) AS n FROM leads WHERE id = ${old}`)[0].n, 0);
  assert.equal(sql(`SELECT COUNT(*) AS n FROM lead_deliveries WHERE lead_id = ${old}`)[0].n, 0);
  assert.equal(sql(`SELECT COUNT(*) AS n FROM lead_requests WHERE lead_id = ${old} OR key = 'stale-claim'`)[0].n, 0);
  assert.equal(sql(`SELECT COUNT(*) AS n FROM leads WHERE id = ${fresh}`)[0].n, 1);
  assert.equal(calls.length, 0, 'очистка — без внешних запросов');
});

test('канал без ключей: заявки «не настроен» после добавления ключей не досылаются', async () => {
  // заявка пришла, когда Telegram ещё не был настроен
  const id = await postLead();
  await delivery(id);
  sql(`UPDATE lead_deliveries SET status = 'not_configured', attempts = 0, next_attempt_at = NULL, sent_at = NULL WHERE lead_id = ${id} AND channel = 'telegram'`);
  calls = [];
  await worker.runCron();
  assert.equal(calls.length, 0);
  const [row] = sql(`SELECT status, attempts FROM lead_deliveries WHERE lead_id = ${id} AND channel = 'telegram'`);
  assert.deepEqual(row, { status: 'not_configured', attempts: 0 });
});
