/**
 * Telegram: сообщение о заявке и служебные сообщения (Bot API, sendMessage, parse_mode HTML).
 * - Текст до 4096 символов; всё, что приходит от посетителя, экранируется (< > & ").
 * - Пустые поля не выводятся; источник визита (UTM) — отдельным блоком.
 * - Ответ Telegram: { ok, result } или { ok: false, error_code, description, parameters }.
 *   Группа стала супергруппой (parameters.migrate_to_chat_id) — отправляем на новый ID
 *   в той же попытке; ID чата в wrangler.jsonc стоит заменить (подсказка в журнале).
 * Подписи — для команды отдела продаж, не для посетителя, поэтому живут в коде, а не в Sanity.
 * Значения, выбранные в форме, сайт присылает по-украински при любом языке страницы;
 * язык посетителя — отдельной пометкой «мова».
 * Токен бота — только в адресе запроса; адрес и ответы с данными в журнал не пишутся.
 */
import type { Env } from '../env';
import type { StoredLead } from '../db/leads';
import type { SendResult } from './index';

const API_BASE = 'https://api.telegram.org';
export const MAX_TEXT = 4096;

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const SOURCES: Record<StoredLead['form'], string> = {
  finmodel: 'Форма «Фінмодель»',
  final: 'Фінальна форма',
  quiz: 'Квіз «Розрахунок доходу»',
  apartment: 'Попап апартаменту',
  world: 'Попап світу',
  contact: 'Попап «Звʼязатися» (шапка)',
};

/** Способ связи приходит украинской подписью из Sanity; коды — запасной вариант. */
const CONTACT: Record<string, string> = { telegram: 'Telegram', viber: 'Viber', whatsapp: 'WhatsApp', call: 'Дзвінок' };

const FIELDS: [keyof StoredLead['fields'], string][] = [
  ['name', 'Імʼя'],
  ['phone', 'Телефон'],
  ['email', 'E-mail'],
  ['contactMethod', 'Звʼязок'],
  ['world', 'Секція'],
  ['apartment', 'Апартамент'],
  ['format', 'Формат'],
  // финальная форма: «Категорія інвестиції» (с 2026-11-26 вместо вопроса о цели)
  ['category', 'Категорія'],
  // старые заявки финальной формы: цель покупки
  ['purpose', 'Мета'],
  ['budget', 'Бюджет'],
  ['budgetCurrency', 'Валюта'],
  // country (код страны телефона) не выводим: он уже в начале номера; нужен для CRM.
];

/** Расчёт квиза: числа калькулятора Numbers, в долларах. */
const CALC: Record<string, string> = {
  price: 'Вартість',
  first: 'Перший внесок',
  month: 'Платіж на місяць',
  income: 'Дохід на рік',
};

// Блок «Джерело»: метки визита. Страница, referrer и landing в Telegram не выводятся (решение 2026-11-26) — они в D1 и CRM.
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid'] as const;

/** Время по Киеву: «20.11.2026, 14:05». */
export function kyivTime(iso: string): string {
  return new Intl.DateTimeFormat('uk-UA', {
    timeZone: 'Europe/Kyiv', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

/** Площадь «29,5–34,5 м²» из чисел заявки. */
function areaText(from?: string, to?: string): string {
  const uk = (n?: string) => n?.trim().replace('.', ',');
  const [a, b] = [uk(from), uk(to)];
  if (!a) return '';
  return b && b !== a ? `${a}–${b} м²` : `${a} м²`;
}

const money = (n: number) => `$${new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 }).format(n)}`;
const line = (label: string, value: string) => `${esc(label)}: ${esc(value)}`;

/**
 * Собирает сообщение из блоков; если не помещается в 4096 символов, последние строки
 * отбрасываются с пометкой (полная заявка остаётся в D1).
 */
function fit(head: string[], rest: string[]): string {
  const cut = '…\n<i>Скорочено — повністю в базі заявок.</i>';
  let lines = [...head, ...rest];
  let text = lines.join('\n');
  if (text.length <= MAX_TEXT) return text;
  lines = [...head];
  for (const l of rest) {
    if ([...lines, l].join('\n').length + cut.length + 1 > MAX_TEXT) break;
    lines.push(l);
  }
  text = `${lines.join('\n')}\n${cut}`;
  return text.length <= MAX_TEXT ? text : `${head.join('\n').slice(0, MAX_TEXT - cut.length - 1)}\n${cut}`;
}

export function formatLeadMessage(lead: StoredLead): string {
  const head = [
    '<b>Заявка з лендінгу Forrest</b>',
    `№ <b>${esc(lead.number)}</b> · ${esc(SOURCES[lead.form] ?? lead.form)}`,
    `${esc(kyivTime(lead.createdAt))} (Київ) · мова: ${esc(lead.lang)}`,
    '',
  ];
  const answers = (lead.quiz?.answers ?? []).filter((a) => a.answer?.trim());
  const answered = new Set(answers.map((a) => a.answer.trim()));
  const rest: string[] = [];
  for (const [key, label] of FIELDS) {
    const raw = lead.fields[key];
    if (typeof raw !== 'string' || !raw.trim()) continue;
    // в квизе формат, бюджет и месенджер — это ответы; выводим один раз, в блоке ответов
    if ((key === 'format' || key === 'budget' || key === 'contactMethod') && answered.has(raw.trim())) continue;
    if (key === 'format') {
      // «Фінмодель»: поле формы «Площа апартаментів» — формат и его площадь
      const area = areaText(lead.fields.areaFrom, lead.fields.areaTo);
      rest.push(line(lead.form === 'finmodel' ? 'Площа апартаментів' : label, area ? `${raw}, ${area}` : raw));
      continue;
    }
    rest.push(line(label, key === 'contactMethod' ? CONTACT[raw] ?? raw : raw));
  }

  if (answers.length) {
    rest.push('', '<b>Відповіді квізу</b>');
    for (const a of answers) rest.push(`${esc(a.question)} — ${esc(a.answer)}`);
  }
  const calc = Object.entries(lead.quiz?.calc ?? {}).filter(([, v]) => v !== '' && v !== null);
  if (calc.length) {
    rest.push('', '<b>Розрахунок</b>');
    for (const [k, v] of calc) rest.push(line(CALC[k] ?? k, typeof v === 'number' && k in CALC ? money(v) : String(v)));
  }

  const utm = UTM_KEYS.filter((k) => lead.attribution[k]);
  if (utm.length) {
    rest.push('', '<b>Джерело</b>');
    for (const k of utm) rest.push(line(k, lead.attribution[k]!));
  }
  return fit(head, rest);
}

const CHANNEL_NAMES: Record<string, string> = { telegram: 'Telegram', crm: 'CRM G-PLUS' };

/** Служебное: канал перестал доставлять (одно на серию). Без личных данных. */
export function formatFailureAlert(channel: string, firstNumber: string, error: string, at: string): string {
  return [
    `⚠️ <b>Збій доставки заявок: ${esc(CHANNEL_NAMES[channel] ?? channel)}</b>`,
    `Заявку ${esc(firstNumber)} не доставлено після 3 спроб (одразу, через 10 хв і через годину).`,
    `Помилка: <code>${esc(error)}</code>`,
    `Час: ${esc(kyivTime(at))} (Київ)`,
    '',
    'Заявки збережено в базі. Наступні збої цього каналу окремо не повідомляються — прийде одне повідомлення, коли канал запрацює.',
  ].join('\n');
}

/** Служебное: канал снова доставляет; номера недоставленных заявок за серию. */
export function formatRecoveryAlert(channel: string, since: string, numbers: string[], total: number): string {
  const more = total > numbers.length ? ` і ще ${total - numbers.length}` : '';
  return [
    `✅ <b>Доставку відновлено: ${esc(CHANNEL_NAMES[channel] ?? channel)}</b>`,
    `Збій з ${esc(kyivTime(since))} (Київ).`,
    `Не доставлено заявок: ${total}${numbers.length ? ` — ${esc(numbers.join(', '))}${more}` : ''}.`,
    'Їх немає в цьому каналі — дані в базі заявок.',
  ].join('\n');
}

interface TgResponse {
  ok: boolean;
  result?: { message_id?: number };
  error_code?: number;
  description?: string;
  parameters?: { retry_after?: number; migrate_to_chat_id?: number };
}

/** Одна отправка текста; ошибки — коротким кодом без данных заявки. */
export async function sendTelegram(env: Env, text: string, signal: AbortSignal): Promise<SendResult> {
  const base = (env.TELEGRAM_API_BASE || API_BASE).replace(/\/+$/, '');
  const url = `${base}/bot${env.TELEGRAM_BOT_TOKEN!.trim()}/sendMessage`;
  const post = async (chatId: string | number) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true } }),
      signal,
    });
    const body = (await res.json().catch(() => null)) as TgResponse | null;
    return { status: res.status, body };
  };

  let { status, body } = await post(env.TELEGRAM_CHAT_ID.trim());
  const migrated = body?.parameters?.migrate_to_chat_id;
  if (!body?.ok && migrated) {
    // ID чата не личные данные: подсказка администратору, какой ID вписать в wrangler.jsonc.
    console.warn('telegram_chat_migrated', { migrate_to_chat_id: migrated });
    ({ status, body } = await post(migrated));
  }
  if (body?.ok) return { ok: true, externalId: body.result?.message_id != null ? String(body.result.message_id) : undefined };
  const retry = body?.parameters?.retry_after ? `, retry_after ${body.parameters.retry_after}` : '';
  const desc = body?.description ? `: ${body.description.slice(0, 120)}` : '';
  return { ok: false, error: `telegram ${body?.error_code ?? status}${desc}${retry}` };
}
