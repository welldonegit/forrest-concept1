/**
 * G-PLUS CRM (Public API v1, docs/crm/api_schema.yaml; правила — docs/LEADS.md).
 *
 * buildCrmLead — тело лида из заявки (чистая функция; её же использует scripts/crm/check.mjs).
 * Транспорт — Public API v1: POST /api/v1/leads (успех 201), поиск дубля по номеру заявки.
 * Второй способ отправки (старый Forms API) добавляется ещё одним транспортом с тем же
 * интерфейсом CrmTransport.
 *
 * - Пустые поля не передаём; длинные значения обрезаем по ограничениям схемы.
 * - Нет ответа (таймаут, обрыв, 502/504) — перед повтором ищем лид по номеру заявки
 *   в note за минуту вокруг added_at; нашёлся — отправлено, второго лида нет.
 * - Ошибка от CRM записывается кодом и путями полей, без текстов: в них бывают значения.
 */
import type { Env } from '../env';
import type { StoredLead } from '../db/leads';
import type { SendResult, SendOptions } from './index';
// .ts — чтобы модуль импортировался и в Node (scripts/crm/check.mjs, тесты)
import { kyivTime } from './telegram.ts';

const API_BASE = 'https://crm.g-plus.app';

/** contact.language: языки CRM (LanguageEnum); uk → ua. Нет в списке — язык пишем в note. */
const CRM_LANGUAGES = new Set(['ru', 'ka', 'en', 'de', 'es', 'tr', 'he', 'pl', 'ua', 'ar', 'zh-cn']);
export const crmLanguage = (lang: string) => {
  const code = lang === 'uk' ? 'ua' : lang.toLowerCase();
  return CRM_LANGUAGES.has(code) ? code : undefined;
};

/** NoteBudgetCurrencyEnum. */
const CURRENCIES = new Set(['usd', 'eur', 'uah', 'gel', 'kzt', 'pln', 'bgn', 'ils', 'gbp', 'idr', 'azn']);

const SOURCES: Record<StoredLead['form'], string> = {
  finmodel: 'форма «Фінмодель»',
  final: 'фінальна форма',
  quiz: 'квіз «Розрахунок доходу»',
  apartment: 'попап апартаменту',
};
const CALC: Record<string, string> = { price: 'Вартість', first: 'Перший внесок', month: 'Платіж на місяць', income: 'Дохід на рік' };
const UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;
const NOTE_EXTRA = ['gclid', 'fbclid', 'referrer', 'landing'] as const;

const cut = (v: string | undefined, max: number) => {
  const t = v?.trim();
  return t ? t.slice(0, max) : undefined;
};
/** note_square_*: строка-число ^\d{0,6}(\.\d{0,2})?$ */
export function square(v: string | undefined): string | undefined {
  const n = Number(v?.replace(',', '.'));
  if (!v || !Number.isFinite(n) || n <= 0 || n >= 1e6) return undefined;
  return String(Math.round(n * 100) / 100);
}
function currency(f: StoredLead['fields']): string | undefined {
  const c = f.budgetCurrency?.trim().toLowerCase();
  if (c && CURRENCIES.has(c)) return c;
  if (!f.budget) return undefined;
  if (f.budget.includes('$')) return 'usd';
  if (f.budget.includes('€')) return 'eur';
  if (/₴|грн/i.test(f.budget)) return 'uah';
  return undefined;
}

/** Номер в note — по нему ищется дубль. */
export const noteNumberLine = (number: string) => `Номер: ${number}`;

export interface CrmSettings {
  source?: string;
  stageId?: string;
  buildingId?: string;
  /** Запасной вариант для UTM: { utm_source: '<uuid поля>', ... } → data.custom_field_values. */
  utmFields?: Record<string, string>;
}

export function crmSettings(env: Env): CrmSettings {
  let utmFields: Record<string, string> | undefined;
  try {
    const raw = env.CRM_UTM_FIELDS?.trim();
    if (raw) utmFields = JSON.parse(raw) as Record<string, string>;
  } catch {
    console.error('crm_utm_fields_invalid');
  }
  return {
    source: env.CRM_SOURCE?.trim() || undefined,
    stageId: env.CRM_STAGE_ID?.trim() || undefined,
    buildingId: env.CRM_BUILDING_ID?.trim() || undefined,
    utmFields,
  };
}

/** Тело POST /api/v1/leads. */
export function buildCrmLead(lead: StoredLead, cfg: CrmSettings): Record<string, unknown> {
  const f = lead.fields;
  const language = crmLanguage(lead.lang);

  const contact: Record<string, unknown> = {
    // contact.name обязателен в CRM; в квизе и попапе апартамента имя необязательно
    name: cut(f.name, 140) ?? `Заявка з сайту ${lead.number}`,
    phone_numbers: [f.phone],
  };
  const email = cut(f.email, 140);
  if (email && email.length === f.email?.trim().length) contact.email = email; // обрезанный адрес не передаём
  const method = cut(f.contactMethod, 128);
  if (method) contact.preferred_contact_method = method;
  if (language) contact.language = language;

  const note: string[] = [
    'Заявка з лендінгу Forrest',
    noteNumberLine(lead.number),
    `Джерело: ${SOURCES[lead.form] ?? lead.form}`,
    `Сторінка: ${lead.page}`,
    `Час: ${kyivTime(lead.createdAt)} (Київ)`,
  ];
  if (!language) note.push(`Мова: ${lead.lang}`);
  if (f.name && f.name.trim().length > 140) note.push(`Імʼя повністю: ${f.name.trim()}`);
  if (f.email && !contact.email) note.push(`E-mail: ${f.email.trim()}`);
  if (f.consent) note.push('Згода на обробку даних: так');

  const body: Record<string, unknown> = { contact, added_at: lead.createdAt };
  if (cfg.source) body.source = cfg.source;
  if (cfg.stageId) body.stage_id = cfg.stageId;
  const building = Number(cfg.buildingId);
  if (cfg.buildingId && Number.isInteger(building) && building > 0) body.objects = [{ id: building }];

  const purpose = cut(f.purpose, 150);
  if (purpose) body.note_purpose = purpose;
  // Формат апартамента: «Фінмодель» (format), квиз (format), попап апартамента (apartment).
  const section = cut(f.format ?? f.apartment, 150);
  if (section) body.note_section = section;
  if (f.apartment && f.format && f.apartment !== f.format) note.push(`Апартамент: ${f.apartment}`);
  const from = square(f.areaFrom);
  const to = square(f.areaTo);
  if (from) body.note_square_from = from;
  if (to) body.note_square_to = to;
  const budget = cut(f.budget, 100);
  if (budget) {
    body.note_budget = budget;
    const cur = currency(f);
    if (cur) body.note_budget_currency = cur;
  }
  for (const [label, v, max] of [['Мета', f.purpose, 150], ['Формат', f.format ?? f.apartment, 150], ['Бюджет', f.budget, 100]] as const) {
    if (v && v.trim().length > max) note.push(`${label} повністю: ${v.trim()}`);
  }

  const answers = (lead.quiz?.answers ?? []).filter((a) => a.answer?.trim());
  if (answers.length) {
    note.push('', 'Відповіді квізу:');
    for (const a of answers) note.push(`${a.question} — ${a.answer}`);
  }
  const calc = Object.entries(lead.quiz?.calc ?? {});
  if (calc.length) {
    note.push('', 'Розрахунок (USD):');
    for (const [k, v] of calc) note.push(`${CALC[k] ?? k}: ${v}`);
  }

  const utm: Record<string, string> = {};
  for (const k of UTM) if (lead.attribution[k]) utm[k] = lead.attribution[k]!;
  const data: Record<string, unknown> = {};
  if (Object.keys(utm).length) data.utm = utm;
  if (cfg.utmFields) {
    const custom: Record<string, string> = {};
    for (const [k, id] of Object.entries(cfg.utmFields)) {
      const v = lead.attribution[k as keyof typeof lead.attribution];
      if (v && id) custom[id] = v;
    }
    if (Object.keys(custom).length) data.custom_field_values = custom;
  }
  if (Object.keys(data).length) body.data = data;
  const extra = NOTE_EXTRA.filter((k) => lead.attribution[k]);
  if (extra.length || Object.keys(utm).length) {
    note.push('', 'Джерело візиту:');
    for (const k of UTM) if (utm[k]) note.push(`${k}: ${utm[k]}`);
    for (const k of extra) note.push(`${k}: ${lead.attribution[k]}`);
  }

  body.note = note.join('\n');
  return body;
}

// --- транспорт ---------------------------------------------------------------------------

export interface CrmTransport {
  create(body: Record<string, unknown>, signal: AbortSignal): Promise<SendResult>;
  /** Лид с этим номером уже есть? id — да, null — нет; ошибка поиска — исключение. */
  findByNumber(lead: StoredLead, signal: AbortSignal): Promise<string | null>;
}

/** Пути полей из ошибки DRF без значений: {"contact":{"email":["…"]}} → contact.email */
export function errorPaths(body: unknown, prefix = ''): string[] {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return prefix ? [prefix] : [];
  return Object.entries(body as Record<string, unknown>).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v) ? errorPaths(v, `${prefix}${k}.`) : [`${prefix}${k}`]);
}

const NO_RESPONSE_STATUS = new Set([502, 504]);

export function publicApiV1(env: Env): CrmTransport {
  const base = (env.CRM_API_BASE || API_BASE).replace(/\/+$/, '');
  const headers = { authorization: `Token ${env.CRM_TOKEN!.trim()}`, 'content-type': 'application/json', accept: 'application/json' };
  return {
    async create(body, signal) {
      const res = await fetch(`${base}/api/v1/leads?fields=id`, { method: 'POST', headers, body: JSON.stringify(body), signal });
      if (res.status === 201) {
        const created = (await res.json().catch(() => null)) as { id?: number } | null;
        return { ok: true, externalId: created?.id != null ? String(created.id) : undefined };
      }
      if (NO_RESPONSE_STATUS.has(res.status)) return { ok: false, error: `crm ${res.status}`, noResponse: true };
      const err = await res.json().catch(() => null);
      const paths = res.status === 400 ? errorPaths(err).slice(0, 8).join(', ') : '';
      return { ok: false, error: `crm ${res.status}${paths ? `: ${paths}` : ''}` };
    },
    async findByNumber(lead, signal) {
      const t = Date.parse(lead.createdAt);
      const q = new URLSearchParams({
        fields: 'id,note',
        added_at_gte: new Date(t - 60_000).toISOString(),
        added_at_lte: new Date(t + 60_000).toISOString(),
        page_size: '100',
      });
      const cfg = crmSettings(env);
      if (cfg.source) q.set('source', cfg.source);
      const res = await fetch(`${base}/api/v1/leads?${q}`, { headers, signal });
      if (!res.ok) throw new Error(`crm search ${res.status}`);
      const list = (await res.json()) as { results?: { id: number; note?: string }[] };
      const line = noteNumberLine(lead.number);
      const hit = list.results?.find((l) => l.note?.split('\n').some((s) => s.trim() === line));
      return hit ? String(hit.id) : null;
    },
  };
}

export async function sendCrm(env: Env, lead: StoredLead, signal: AbortSignal, opts: SendOptions = {}): Promise<SendResult> {
  const api = publicApiV1(env);
  if (opts.afterNoResponse) {
    // прошлая попытка осталась без ответа: лид мог создаться — ищем по номеру
    const found = await api.findByNumber(lead, signal);
    if (found) return { ok: true, externalId: found };
  }
  return api.create(buildCrmLead(lead, crmSettings(env)), signal);
}
