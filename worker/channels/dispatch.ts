/**
 * Фоновая отправка сразу после записи в D1 (ctx.waitUntil): каналы независимы,
 * сбой или таймаут одного не мешает другому. Не успело — дошлёт расписание (5.3).
 */
import type { Env } from '../env';
import { CHANNELS, SEND_TIMEOUT_MS } from './index';
import { recordAttempt, type StoredLead } from '../db/leads';

export async function dispatch(env: Env, lead: StoredLead): Promise<void> {
  const active = CHANNELS.filter((ch) => ch.send && ch.isConfigured(env));
  const results = await Promise.allSettled(
    active.map(async (ch) => {
      const result = await ch.send!(env, lead, AbortSignal.timeout(SEND_TIMEOUT_MS)).catch((err: unknown) => ({
        ok: false as const,
        error: err instanceof Error ? err.name : 'error',
        noResponse: true,
      }));
      await recordAttempt(env, lead, ch.id, result);
    }),
  );
  results.forEach((r, i) => {
    if (r.status === 'rejected') console.error('delivery_record_failed', { lead: lead.id, channel: active[i].id });
  });
}
