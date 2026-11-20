/**
 * Расписание (Cron Trigger раз в 10 минут, wrangler.jsonc → triggers.crons):
 * 1. Очистка: заявки старше 90 дней удаляются вместе со статусами и ключами повтора;
 *    брошенные ключи повтора (без заявки) — через сутки.
 * 2. Повторы: берёт доставки со статусом pending, у которых подошло время, и отправляет.
 *    Нет таких — внешних запросов нет, только чтение базы.
 * Доставки забираются с «арендой» (next_attempt_at сдвигается на 15 минут), чтобы два
 * запуска не отправили одно и то же; результат попытки перезаписывает аренду.
 */
import type { Env } from './env';
import { ensureSchema } from './db/schema';
import { loadLead } from './db/leads';
import { activeChannels, deliver } from './channels/dispatch';
import { NO_RESPONSE } from './channels';

const DAY = 24 * 60 * 60_000;
export const RETENTION_DAYS = 90;
const LEASE_MS = 15 * 60_000;
/** Заявок за один запуск: укладываемся в лимит подзапросов бесплатного тарифа (50). */
const BATCH = 10;

export async function cleanup(db: D1Database, now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * DAY).toISOString();
  const staleClaim = new Date(now.getTime() - DAY).toISOString();
  const old = 'SELECT id FROM leads WHERE created_at < ?1';
  const [, , , leads] = await db.batch([
    db.prepare(`DELETE FROM lead_deliveries WHERE lead_id IN (${old})`).bind(cutoff),
    db.prepare(`DELETE FROM lead_requests WHERE lead_id IN (${old})`).bind(cutoff),
    db.prepare('DELETE FROM lead_requests WHERE lead_id IS NULL AND claimed_at < ?1').bind(staleClaim),
    db.prepare('DELETE FROM leads WHERE created_at < ?1').bind(cutoff),
  ]);
  return leads.meta.changes ?? 0;
}

export async function runSchedule(env: Env, now = new Date()): Promise<void> {
  await ensureSchema(env.DB);
  const removed = await cleanup(env.DB, now);
  if (removed) console.log('leads_removed', { count: removed });

  const channels = activeChannels(env);
  if (!channels.length) return;
  const nowIso = now.toISOString();
  const placeholders = channels.map((_, i) => `?${i + 3}`).join(', ');
  const { results: due } = await env.DB.prepare(
    `UPDATE lead_deliveries SET next_attempt_at = ?1
     WHERE rowid IN (
       SELECT rowid FROM lead_deliveries
       WHERE status = 'pending' AND next_attempt_at <= ?2 AND channel IN (${placeholders})
       ORDER BY next_attempt_at LIMIT ${BATCH}
     )
     RETURNING lead_id, channel, last_error`,
  ).bind(new Date(now.getTime() + LEASE_MS).toISOString(), nowIso, ...channels.map((c) => c.id))
    .all<{ lead_id: number; channel: string; last_error: string | null }>();
  if (!due.length) return;

  console.log('retry_due', { count: due.length });
  await Promise.allSettled(due.map(async ({ lead_id, channel, last_error }) => {
    const lead = await loadLead(env.DB, lead_id);
    const ch = channels.find((c) => c.id === channel);
    if (!lead || !ch) return;
    await deliver(env, lead, ch, { afterNoResponse: last_error?.startsWith(NO_RESPONSE) ?? false }).catch(() => console.error('retry_failed', { lead: lead_id, channel }));
  }));
}
