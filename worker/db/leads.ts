/**
 * Запись заявки и статусов доставки в D1.
 */
import type { LeadFields, LeadInput, QuizData } from '../lead/validate';
import type { Attribution } from '../lead/attribution';
import { CHANNELS, nextAttemptAt, type ChannelId, type DeliveryStatus, type SendResult } from '../channels';
import type { Env } from '../env';

export interface StoredLead {
  id: number;
  number: string;
  createdAt: string;
  form: LeadInput['form'];
  lang: string;
  page: string;
  fields: LeadFields;
  quiz?: QuizData;
  attribution: Attribution;
}

/** Номер заявки для людей (Telegram, note в CRM, поиск дублей): FR-000042. */
export const leadNumber = (id: number) => `FR-${String(id).padStart(6, '0')}`;

/** Заявка + статусы каналов + привязка ключа повтора — одной транзакцией. */
export async function insertLead(env: Env, input: LeadInput, attribution: Attribution, createdAt: string): Promise<StoredLead> {
  const db = env.DB;
  const data = JSON.stringify({ fields: input.fields, ...(input.quiz && { quiz: input.quiz }) });
  const firstRetry = nextAttemptAt(createdAt, 1);
  const statements = [
    db.prepare(
      'INSERT INTO leads (request_key, created_at, form, lang, page, data, attribution) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id',
    ).bind(input.key, createdAt, input.form, input.lang, input.page, data, JSON.stringify(attribution)),
    ...CHANNELS.map((ch) => {
      const status: DeliveryStatus = ch.isConfigured(env) ? 'pending' : 'not_configured';
      return db.prepare(
        'INSERT INTO lead_deliveries (lead_id, channel, status, next_attempt_at) SELECT id, ?, ?, ? FROM leads WHERE request_key = ?',
      ).bind(ch.id, status, status === 'pending' ? firstRetry : null, input.key);
    }),
    db.prepare('UPDATE lead_requests SET lead_id = (SELECT id FROM leads WHERE request_key = ?1) WHERE key = ?1').bind(input.key),
  ];
  const [inserted] = await db.batch<{ id: number }>(statements);
  const id = inserted.results[0].id;
  return {
    id, number: leadNumber(id), createdAt, form: input.form, lang: input.lang, page: input.page,
    fields: input.fields, quiz: input.quiz, attribution,
  };
}

/** Заявка из базы — для повторной отправки по расписанию. */
export async function loadLead(db: D1Database, id: number): Promise<StoredLead | null> {
  const row = await db.prepare('SELECT id, created_at, form, lang, page, data, attribution FROM leads WHERE id = ?')
    .bind(id).first<{ id: number; created_at: string; form: StoredLead['form']; lang: string; page: string; data: string; attribution: string }>();
  if (!row) return null;
  const data = JSON.parse(row.data) as { fields: LeadFields; quiz?: QuizData };
  return {
    id: row.id, number: leadNumber(row.id), createdAt: row.created_at, form: row.form, lang: row.lang, page: row.page,
    fields: data.fields, quiz: data.quiz, attribution: JSON.parse(row.attribution) as Attribution,
  };
}

/** Результат попытки доставки: sent; неудача — следующая попытка или failed. Возвращает новый статус. */
export async function recordAttempt(env: Env, lead: StoredLead, channel: ChannelId, result: SendResult): Promise<DeliveryStatus> {
  const now = new Date().toISOString();
  if (result.ok) {
    await env.DB.prepare(
      `UPDATE lead_deliveries SET status = 'sent', attempts = attempts + 1, sent_at = ?, next_attempt_at = NULL, last_error = NULL, external_id = ?
       WHERE lead_id = ? AND channel = ?`,
    ).bind(now, result.externalId ?? null, lead.id, channel).run();
    return 'sent';
  }
  const row = await env.DB.prepare('SELECT attempts FROM lead_deliveries WHERE lead_id = ? AND channel = ?')
    .bind(lead.id, channel).first<{ attempts: number }>();
  const attempts = (row?.attempts ?? 0) + 1;
  const next = nextAttemptAt(lead.createdAt, attempts);
  const status: DeliveryStatus = next ? 'pending' : 'failed';
  // В last_error — только код/статус ошибки, без данных заявки.
  await env.DB.prepare(
    `UPDATE lead_deliveries SET status = ?, attempts = ?, next_attempt_at = ?, last_error = ? WHERE lead_id = ? AND channel = ?`,
  ).bind(status, attempts, next, result.error.slice(0, 200), lead.id, channel).run();
  return status;
}
