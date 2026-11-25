/**
 * Выгрузка заявок из D1 в CSV (Excel: UTF-8, разделитель «;»). В файле личные данные —
 * хранить у себя, в Git не класть (leads-*.csv в .gitignore), удалить после использования.
 *
 *   npx wrangler login               — один раз, вход в Cloudflare
 *   npm run leads:export             — боевая база, последние 30 дней → leads-ГГГГ-ММ-ДД.csv
 *   npm run leads:export -- --days 90 --out заявки.csv
 *   npm run leads:export -- --local  — локальная база (npm run dev:api)
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
const days = Number(opt('days', '30'));
if (!Number.isFinite(days) || days <= 0) { console.error('--days: число дней'); process.exit(2); }
const out = opt('out', `leads-${new Date().toISOString().slice(0, 10)}.csv`);
const where = args.includes('--local') ? ['--local', ...(opt('persist-to') ? ['--persist-to', opt('persist-to')] : [])] : ['--remote'];

const since = new Date(Date.now() - days * 864e5).toISOString();
const query = `SELECT l.id, l.created_at, l.form, l.lang, l.page, l.data, l.attribution,
  (SELECT status FROM lead_deliveries WHERE lead_id = l.id AND channel = 'telegram') AS telegram,
  (SELECT status FROM lead_deliveries WHERE lead_id = l.id AND channel = 'crm') AS crm,
  (SELECT external_id FROM lead_deliveries WHERE lead_id = l.id AND channel = 'crm') AS crm_id,
  (SELECT last_error FROM lead_deliveries WHERE lead_id = l.id AND channel = 'crm') AS crm_error
  FROM leads l WHERE l.created_at >= '${since}' ORDER BY l.id`;

let rows;
try {
  const json = execFileSync('npx', ['wrangler', 'd1', 'execute', 'DB', ...where, '--config', 'wrangler.jsonc', '--json', '--command', query],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
  rows = JSON.parse(json)[0].results;
} catch (err) {
  const msg = String(err.stderr || err.message);
  console.error(/login|authenticat/i.test(msg) ? 'Немає входу в Cloudflare: npx wrangler login' : msg.split('\n').slice(0, 5).join('\n'));
  process.exit(1);
}

const SOURCES = { finmodel: 'Фінмодель', final: 'Фінальна форма', quiz: 'Квіз', apartment: 'Попап апартаменту', world: 'Попап світу', contact: 'Попап «Звʼязатися»' };
const STATUS = { sent: 'надіслано', pending: 'очікує', failed: 'не доставлена', not_configured: 'не налаштований' };
const kyiv = (iso) => new Intl.DateTimeFormat('uk-UA', { timeZone: 'Europe/Kyiv', dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
const cols = [
  ['Номер', (r) => `FR-${String(r.id).padStart(6, '0')}`],
  ['Час (Київ)', (r) => kyiv(r.created_at)],
  ['Джерело', (r) => SOURCES[r.form] ?? r.form],
  ['Мова', (r) => r.lang],
  ['Імʼя', (r) => r.d.fields.name],
  ['Телефон', (r) => r.d.fields.phone],
  ['E-mail', (r) => r.d.fields.email],
  ['Звʼязок', (r) => r.d.fields.contactMethod],
  ['Мета', (r) => r.d.fields.purpose],
  ['Формат', (r) => r.d.fields.format ?? r.d.fields.apartment],
  ['Площа від', (r) => r.d.fields.areaFrom],
  ['Площа до', (r) => r.d.fields.areaTo],
  ['Бюджет', (r) => r.d.fields.budget],
  ['Відповіді квізу', (r) => (r.d.quiz?.answers ?? []).map((a) => `${a.question} — ${a.answer}`).join(' | ')],
  ['Розрахунок', (r) => Object.entries(r.d.quiz?.calc ?? {}).map(([k, v]) => `${k}: ${v}`).join(' | ')],
  ['Сторінка', (r) => r.page],
  ...['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid', 'referrer', 'landing'].map((k) => [k, (r) => r.a[k]]),
  ['Telegram', (r) => STATUS[r.telegram] ?? r.telegram],
  ['CRM', (r) => STATUS[r.crm] ?? r.crm],
  ['ID у CRM', (r) => r.crm_id],
  ['Помилка CRM', (r) => r.crm_error],
];
const cell = (v) => { const s = v == null ? '' : String(v); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const lines = [cols.map(([h]) => cell(h)).join(';')];
for (const r of rows) {
  r.d = JSON.parse(r.data); r.a = JSON.parse(r.attribution);
  lines.push(cols.map(([, f]) => cell(f(r))).join(';'));
}
writeFileSync(out, `﻿${lines.join('\r\n')}\r\n`);
console.log(`${rows.length} заявок за ${days} дн. → ${out}. У файлі особисті дані: не пересилайте відкрито й видаліть після використання.`);
