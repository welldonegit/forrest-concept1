/**
 * Доставка заявки по каналам: сразу после записи в D1 (ctx.waitUntil) и повторы
 * по расписанию (worker/scheduled.ts). Каналы независимы: сбой или таймаут одного
 * не мешает другому. Не успело за время фоновой работы — дошлёт расписание.
 */
import type { Env } from '../env';
import { CHANNELS, SEND_TIMEOUT_MS, type Channel } from './index';
import { recordAttempt, type StoredLead } from '../db/leads';
import { onDeliveryFailed, onDeliverySent } from './alerts';

/** Одна попытка по одному каналу + запись результата + серия сбоев. */
export async function deliver(env: Env, lead: StoredLead, ch: Channel): Promise<void> {
  const result = await ch.send!(env, lead, AbortSignal.timeout(SEND_TIMEOUT_MS)).catch((err: unknown) => ({
    ok: false as const,
    error: err instanceof Error ? err.name : 'error',
    noResponse: true,
  }));
  const status = await recordAttempt(env, lead, ch.id, result);
  if (status === 'sent') await onDeliverySent(env, ch.id);
  else if (status === 'failed' && !result.ok) await onDeliveryFailed(env, ch.id, lead, result.error, new Date().toISOString());
}

/** Каналы, которые сейчас можно отправлять: есть отправитель и ключи. */
export const activeChannels = (env: Env) => CHANNELS.filter((ch) => ch.send && ch.isConfigured(env));

export async function dispatch(env: Env, lead: StoredLead): Promise<void> {
  const active = activeChannels(env);
  const results = await Promise.allSettled(active.map((ch) => deliver(env, lead, ch)));
  results.forEach((r, i) => {
    if (r.status === 'rejected') console.error('delivery_record_failed', { lead: lead.id, channel: active[i].id });
  });
}
