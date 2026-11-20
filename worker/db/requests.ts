/**
 * Ключ повтора (двойное нажатие). Проверяется ДО проверки токена Turnstile:
 * повтор получает результат первой отправки, а не ошибку «токен уже использован».
 *
 * lead_requests: key → lead_id. lead_id пуст, пока первая отправка в работе.
 * Ошибка первой отправки (капча) снимает ключ — посетитель может отправить ещё раз.
 */
import { leadNumber } from './leads';

/** Захват ключа, брошенный упавшим запросом, считается свободным через это время. */
const STALE_MS = 30_000;
/** Сколько повтор ждёт завершения первой отправки. */
const WAIT_MS = 8_000;
const POLL_MS = 250;

export type Claim = { state: 'claimed' } | { state: 'done'; number: string } | { state: 'busy' };

export async function claimKey(db: D1Database, key: string): Promise<Claim> {
  const deadline = Date.now() + WAIT_MS;
  for (;;) {
    const now = new Date();
    const inserted = await db
      .prepare('INSERT INTO lead_requests (key, claimed_at) VALUES (?, ?) ON CONFLICT (key) DO NOTHING')
      .bind(key, now.toISOString())
      .run();
    if (inserted.meta.changes === 1) return { state: 'claimed' };

    const row = await db.prepare('SELECT lead_id, claimed_at FROM lead_requests WHERE key = ?').bind(key).first<{ lead_id: number | null; claimed_at: string }>();
    if (row?.lead_id != null) return { state: 'done', number: leadNumber(row.lead_id) };
    if (row && Date.parse(row.claimed_at) < now.getTime() - STALE_MS) {
      const taken = await db
        .prepare('UPDATE lead_requests SET claimed_at = ? WHERE key = ? AND lead_id IS NULL AND claimed_at = ?')
        .bind(now.toISOString(), key, row.claimed_at)
        .run();
      if (taken.meta.changes === 1) return { state: 'claimed' };
    }
    if (!row) continue; // ключ сняли между запросами — пробуем занять снова
    if (Date.now() >= deadline) return { state: 'busy' };
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

/** Снять ключ после неудачной первой отправки (заявка не записана). */
export async function releaseKey(db: D1Database, key: string): Promise<void> {
  await db.prepare('DELETE FROM lead_requests WHERE key = ? AND lead_id IS NULL').bind(key).run();
}
