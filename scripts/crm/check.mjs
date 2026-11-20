/**
 * Проверочная отправка в G-PLUS CRM: создаёт ОДИН лид «ТЕСТ сайт Forrest — не обробляти»
 * тем же кодом, что Worker (worker/channels/crm.ts), читает его обратно и показывает этап,
 * менеджера, сохранились ли data.utm, поля note_* и кастомные поля (способ связи, тип планування,
 * gclid, fbclid). До создания — сверяет ID кастомных полей и значения соответствия со списком CRM.
 * Затем проверяет поиск дубля по номеру.
 *
 *   CRM_TOKEN=… CRM_TEST_PHONE=+380… npm run crm:check
 *
 * Удалить лид после проверки: npm run crm:delete -- <id>
 */
import { validateLeadBody } from '../lib/crm-schema.mjs';
import { buildCrmLead, crmSettings, publicApiV1, CRM_FIELD_OPTIONS } from '../../worker/channels/crm.ts';
import { api, must, settings, maskPhone, TEST_NAME, BASE, token } from './lib.mjs';

const phone = process.env.CRM_TEST_PHONE?.replace(/[^\d+]/g, '');
if (!phone || phone.replace(/\D/g, '').length < 7) {
  console.error('Немає CRM_TEST_PHONE (ваш номер для тестового ліда): CRM_TOKEN=… CRM_TEST_PHONE=+380… npm run crm:check');
  process.exit(2);
}
const env = { ...settings(), CRM_TOKEN: token(), CRM_API_BASE: BASE };
const createdAt = new Date().toISOString();
const number = `FR-TEST-${createdAt.slice(0, 19).replace(/\D/g, '')}`;
const lead = {
  id: 0, number, createdAt, form: 'quiz', lang: 'uk', page: 'https://forrest-trinity-resort.forrestresort-com.workers.dev/uk/',
  fields: {
    name: TEST_NAME, phone, contactMethod: 'Telegram', purpose: 'Пасивний дохід', format: 'Superior',
    areaFrom: '29.5', areaTo: '34.5', budget: 'До $130 000', budgetCurrency: 'usd', consent: true,
  },
  quiz: { answers: [{ question: 'Тестове питання', answer: 'Тестова відповідь' }], calc: { price: 132750 } },
  attribution: { utm_source: 'site-check', utm_medium: 'test', utm_campaign: 'crm-check', utm_content: 'c', utm_term: 't', gclid: 'test-gclid', fbclid: 'test-fbclid' },
};

// Кастомные поля: ID из wrangler.jsonc есть в CRM, тип верный, каждое значение соответствия — вариант CRM.
const cfg = crmSettings(env);
const KINDS = [
  ['contactMethod', 'CRM_FIELD_CONTACT_METHOD', 'multiselect', CRM_FIELD_OPTIONS.contactMethod],
  ['layout', 'CRM_FIELD_LAYOUT', 'multiselect', CRM_FIELD_OPTIONS.layout],
  ['gclid', 'CRM_FIELD_GCLID', 'string'],
  ['fbclid', 'CRM_FIELD_FBCLID', 'string'],
];
const crmFields = must(await api('/api/v1/custom_fields?object=lead'), 'custom_fields').lead_custom_fields ?? [];
let fieldErrors = 0;
console.log('Кастомні поля ліда (wrangler.jsonc → CRM_FIELD_*):');
for (const [key, name, type, values] of KINDS) {
  const id = cfg.fields?.[key];
  if (!id) { console.log(`  –  ${name} порожньо — поле не передається`); continue; }
  const f = crmFields.find((x) => x.id === id);
  if (!f) { console.log(`  ✗  ${name} = ${id}: такого поля в CRM немає`); fieldErrors++; continue; }
  const problems = [];
  if (f.type !== type) problems.push(`тип ${f.type}, очікується ${type}`);
  for (const v of values ?? []) if (!(f.options ?? []).includes(v)) problems.push(`немає варіанта «${v}»`);
  fieldErrors += problems.length;
  console.log(`  ${problems.length ? '✗' : '✓'}  ${name} → «${f.name}»${problems.length ? ': ' + problems.join('; ') : ''}`);
}
if (fieldErrors) {
  console.error('\nВиправте CRM_FIELD_* у wrangler.jsonc або відповідність у worker/channels/crm.ts; лід не створено.');
  process.exit(1);
}
console.log('');

const body = buildCrmLead(lead, cfg);
const errors = validateLeadBody(body);
if (errors.length) {
  console.error('Тіло ліда не відповідає docs/crm/api_schema.yaml:\n  ' + errors.join('\n  '));
  process.exit(1);
}

const created = await api('/api/v1/leads?fields=id', { method: 'POST', body });
if (created.status !== 201) {
  console.error(`Створення: HTTP ${created.status} (очікується 201)`);
  if (created.status === 400) console.error('Поля з помилкою:', JSON.stringify(created.json));
  process.exit(1);
}
const id = created.json.id;
console.log(`Створено лід ${id} (${number}), телефон ${maskPhone(phone)}\n`);

const fields = [
  'id', 'added_at', 'source', 'pipeline_id', 'stages', 'manager.id', 'manager.name', 'note', 'note_purpose', 'note_section',
  'note_square_from', 'note_square_to', 'note_budget', 'note_budget_currency', 'data', 'objects',
  'contact.name', 'contact.language', 'contact.preferred_contact_method', 'contact.phone_numbers',
].join(',');
const got = must(await api(`/api/v1/leads/${id}?fields=${fields}`), 'читання ліда');

const pipelines = (await api('/api/v1/pipelines')).json ?? [];
const stageTitle = (sid) => pipelines.flatMap((p) => p.stages.map((s) => ({ ...s, pipeline: p.title }))).find((s) => s.id === sid);
const stages = (got.stages ?? []).map((s) => s.stage_id ?? s.id ?? JSON.stringify(s));
console.log(`Етап:      ${stages.map((s) => { const t = stageTitle(s); return t ? `${t.title} (${t.pipeline}, ${s})` : s; }).join(', ') || '—'}${env.CRM_STAGE_ID ? `  — задано ${env.CRM_STAGE_ID}` : ''}`);
console.log(`Менеджер:  ${got.manager?.name ? `${got.manager.name} (id ${got.manager.id})` : 'не призначено'}`);
console.log(`Джерело:   ${got.source ?? '—'}${env.CRM_SOURCE ? `  — задано ${env.CRM_SOURCE}` : ''}`);
console.log(`Обʼєкти:   ${JSON.stringify(got.objects ?? [])}\n`);

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const rows = [
  ['contact.name', body.contact.name, got.contact?.name],
  ['contact.language', body.contact.language, got.contact?.language],
  ['contact.preferred_contact_method', body.contact.preferred_contact_method, got.contact?.preferred_contact_method],
  ['note_purpose', body.note_purpose, got.note_purpose],
  ['note_section', body.note_section, got.note_section],
  ['note_square_from', body.note_square_from, got.note_square_from && String(Number(got.note_square_from))],
  ['note_square_to', body.note_square_to, got.note_square_to && String(Number(got.note_square_to))],
  ['note_budget', body.note_budget, got.note_budget],
  ['note_budget_currency', body.note_budget_currency, got.note_budget_currency],
  ['data.utm', body.data?.utm, got.data?.utm],
  ['note (початок)', body.note.split('\n')[0], got.note?.split('\n')[0]],
];
for (const [id, sent] of Object.entries(body.data?.custom_field_values ?? {})) {
  const f = crmFields.find((x) => x.id === id);
  const back = got.data?.custom_field_values?.[id];
  // multiselect CRM может вернуть строкой — сравниваем как множество
  const norm = (v) => (Array.isArray(v) ? [...v].sort() : v == null ? v : f?.type === 'multiselect' ? [v] : v);
  rows.push([`поле «${f?.name ?? id}»`.slice(0, 33), norm(sent), norm(back)]);
}
console.log('Поле                              збережено  надіслано → в CRM');
for (const [name, sent, back] of rows) {
  console.log(`${name.padEnd(34)}${same(sent, back) ? '   ✓     ' : '   ✗     '} ${JSON.stringify(sent)} → ${JSON.stringify(back)}`);
}
const phoneBack = (got.contact?.phone_numbers ?? []).map((p) => (typeof p === 'string' ? p : p?.phone ?? '')).map((p) => p.replace(/\D/g, ''));
console.log(`${'contact.phone_numbers'.padEnd(34)}${phoneBack.includes(phone.replace(/\D/g, '')) ? '   ✓     ' : '   ✗     '} ${maskPhone(phone)}`);
if (!same(body.data?.utm, got.data?.utm)) console.log('\n! data.utm не збережено як надіслано: запасний варіант — CRM_UTM_FIELDS (ID кастомних полів, див. npm run crm:explore).');

const found = await publicApiV1(env).findByNumber(lead, AbortSignal.timeout(10_000)).catch((e) => `помилка: ${e.message}`);
console.log(`\nПошук дубля за номером ${number}: ${found === String(id) ? '✓ знайдено' : `✗ ${found ?? 'не знайдено'}`}`);
console.log(`\nВидалити тестовий лід: npm run crm:delete -- ${id}`);
