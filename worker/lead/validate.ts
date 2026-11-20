/**
 * Проверка тела POST /api/lead. Формат запроса — docs/LEADS.md, «Формат запроса».
 * Неизвестные ключи отбрасываются, длинные значения отклоняются (лимиты ниже).
 */
import { languageIds } from '../../src/lib/languages.ts';

export const FORMS = ['finmodel', 'final', 'quiz', 'apartment'] as const;
export type FormId = (typeof FORMS)[number];

/** Формы, где имя обязательно (в попапе апартамента и квизе — по желанию). */
const NAME_REQUIRED: ReadonlySet<FormId> = new Set(['finmodel', 'final']);

const TEXT_FIELDS = ['contactMethod', 'format', 'purpose', 'areaFrom', 'areaTo', 'budget', 'budgetCurrency', 'apartment', 'country'] as const;

export interface LeadFields {
  name?: string;
  phone: string;
  email?: string;
  consent?: boolean;
  contactMethod?: string;
  format?: string;
  purpose?: string;
  areaFrom?: string;
  areaTo?: string;
  budget?: string;
  budgetCurrency?: string;
  apartment?: string;
  country?: string;
}

export interface QuizData {
  answers: { question: string; answer: string }[];
  calc: Record<string, string | number>;
}

export interface LeadInput {
  key: string;
  form: FormId;
  lang: string;
  page: string;
  turnstileToken: string;
  honeypot: boolean;
  fields: LeadFields;
  quiz?: QuizData;
}

export type Validation = { ok: true; value: LeadInput } | { ok: false; fields: string[] };

const LIMIT = { name: 140, email: 140, text: 300, page: 2000, token: 4096, quizItems: 30, calcItems: 20, calcValue: 100 };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v.trim() : undefined);

/** Телефон: цифры, пробелы, скобки, дефисы, точки, ведущий «+»; 7–15 цифр (E.164). */
export function normalizePhone(raw: string): string | null {
  const s = raw.trim();
  if (!/^\+?[\d\s().-]+$/.test(s)) return null;
  const digits = s.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return null;
  return (s.startsWith('+') ? '+' : '') + digits;
}

export function validateLead(body: unknown): Validation {
  if (!isObject(body)) return { ok: false, fields: ['body'] };
  const bad: string[] = [];

  const key = str(body.key) ?? '';
  if (!UUID.test(key)) bad.push('key');

  const form = str(body.form) as FormId;
  if (!FORMS.includes(form)) bad.push('form');

  const lang = str(body.lang) ?? '';
  if (!languageIds.includes(lang)) bad.push('lang');

  const page = str(body.page) ?? '';
  if (!isHttpUrl(page) || page.length > LIMIT.page) bad.push('page');

  const turnstileToken = str(body.turnstileToken) ?? '';
  if (turnstileToken.length > LIMIT.token) bad.push('turnstileToken');

  // Поле-ловушка: человек его не видит и не заполняет.
  const honeypot = typeof body.website === 'string' && body.website.trim() !== '';

  const f = isObject(body.fields) ? body.fields : {};
  const fields: LeadFields = { phone: '' };

  const phone = normalizePhone(str(f.phone) ?? '');
  if (!phone) bad.push('phone');
  else fields.phone = phone;

  const name = str(f.name);
  if (name) {
    if (name.length > LIMIT.name) bad.push('name');
    else fields.name = name;
  } else if (NAME_REQUIRED.has(form)) bad.push('name');

  const email = str(f.email);
  if (email) {
    if (email.length > LIMIT.email || !EMAIL.test(email)) bad.push('email');
    else fields.email = email;
  }

  if (typeof f.consent === 'boolean') fields.consent = f.consent;

  for (const k of TEXT_FIELDS) {
    const v = str(f[k]);
    if (!v) continue;
    if (v.length > LIMIT.text) bad.push(k);
    else fields[k] = v;
  }

  let quiz: QuizData | undefined;
  if (body.quiz !== undefined) {
    quiz = parseQuiz(body.quiz);
    if (!quiz) bad.push('quiz');
  }

  if (bad.length) return { ok: false, fields: bad };
  return { ok: true, value: { key: key.toLowerCase(), form, lang, page, turnstileToken, honeypot, fields, quiz } };
}

function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

function parseQuiz(v: unknown): QuizData | undefined {
  if (!isObject(v)) return undefined;
  const answersRaw = v.answers ?? [];
  const calcRaw = v.calc ?? {};
  if (!Array.isArray(answersRaw) || answersRaw.length > LIMIT.quizItems || !isObject(calcRaw)) return undefined;

  const answers: QuizData['answers'] = [];
  for (const a of answersRaw) {
    if (!isObject(a)) return undefined;
    const question = str(a.question) ?? '';
    const answer = str(a.answer) ?? '';
    if (!question || question.length > LIMIT.text || answer.length > LIMIT.text) return undefined;
    answers.push({ question, answer });
  }

  const entries = Object.entries(calcRaw);
  if (entries.length > LIMIT.calcItems) return undefined;
  const calc: QuizData['calc'] = {};
  for (const [k, val] of entries) {
    if (k.length > LIMIT.calcValue) return undefined;
    if (typeof val === 'number' && Number.isFinite(val)) calc[k] = val;
    else if (typeof val === 'string' && val.length <= LIMIT.calcValue) calc[k] = val.trim();
    else return undefined;
  }
  return { answers, calc };
}
