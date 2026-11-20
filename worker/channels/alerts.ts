/**
 * Серия сбоев канала (docs/LEADS.md, «Повторы»): первая заявка, исчерпавшая попытки,
 * открывает серию — в Telegram уходит одно служебное сообщение. Следующие недоставленные
 * заявки только увеличивают счётчик. Первая успешная доставка в канал закрывает серию —
 * одно сообщение о восстановлении с номерами недоставленных заявок.
 * Служебные сообщения без личных данных; одна попытка, без повторов: если сам Telegram
 * лежит, сбой виден в сообщении о восстановлении.
 */
import type { Env } from '../env';
import type { ChannelId } from './index';
import { CHANNELS, SEND_TIMEOUT_MS } from './index';
import { leadNumber, type StoredLead } from '../db/leads';
import { formatFailureAlert, formatRecoveryAlert, sendTelegram } from './telegram';

const MAX_NUMBERS = 30;

async function notify(env: Env, text: string, kind: string, channel: ChannelId): Promise<void> {
  const tg = CHANNELS.find((c) => c.id === 'telegram')!;
  if (!tg.isConfigured(env)) return;
  const res = await sendTelegram(env, text, AbortSignal.timeout(SEND_TIMEOUT_MS)).catch((err: unknown) => ({
    ok: false as const, error: err instanceof Error ? err.name : 'error',
  }));
  if (!res.ok) console.error('alert_failed', { kind, channel, error: res.error.slice(0, 60) });
}

export async function onDeliveryFailed(env: Env, channel: ChannelId, lead: StoredLead, error: string, now: string): Promise<void> {
  // Атомарно: серию открывает ровно одна заявка, даже если сбои пришли одновременно.
  const row = await env.DB.prepare(
    `INSERT INTO channel_alerts (channel, opened_at, first_lead_id, failed_count, last_error) VALUES (?1, ?2, ?3, 1, ?4)
     ON CONFLICT (channel) DO UPDATE SET failed_count = failed_count + 1, last_error = excluded.last_error
     RETURNING failed_count`,
  ).bind(channel, now, lead.id, error.slice(0, 200)).first<{ failed_count: number }>();
  if (row?.failed_count === 1) await notify(env, formatFailureAlert(channel, lead.number, error, now), 'failure', channel);
}

export async function onDeliverySent(env: Env, channel: ChannelId): Promise<void> {
  const series = await env.DB.prepare('DELETE FROM channel_alerts WHERE channel = ? RETURNING opened_at, first_lead_id, failed_count')
    .bind(channel).first<{ opened_at: string; first_lead_id: number; failed_count: number }>();
  if (!series) return;
  const { results } = await env.DB.prepare(
    `SELECT lead_id FROM lead_deliveries WHERE channel = ? AND status = 'failed' AND lead_id >= ? ORDER BY lead_id LIMIT ${MAX_NUMBERS}`,
  ).bind(channel, series.first_lead_id).all<{ lead_id: number }>();
  const numbers = results.map((r) => leadNumber(r.lead_id));
  await notify(env, formatRecoveryAlert(channel, series.opened_at, numbers, Math.max(series.failed_count, numbers.length)), 'recovery', channel);
}
