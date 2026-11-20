/**
 * Схема D1 для заявок. Worker сам приводит базу к последней версии при первом
 * обращении в каждом экземпляре: ручных миграций в панели и прав D1 у токена
 * Workers Builds не нужно.
 *
 * Новая версия = новый элемент в конце MIGRATIONS (старые не менять).
 * Каждая миграция идёт одной транзакцией (batch) вместе с записью в schema_migrations;
 * два экземпляра одновременно — второй получит конфликт ключа и просто перечитает версию.
 */

const MIGRATIONS: string[][] = [
  // 1 — заявки, доставка по каналам, ключи повтора.
  [
    `CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_key TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      form TEXT NOT NULL,
      lang TEXT NOT NULL,
      page TEXT NOT NULL,
      data TEXT NOT NULL,
      attribution TEXT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS leads_created_at ON leads (created_at)`,
    // Статус по каждому каналу: sent | pending | failed («не доставлена») | not_configured.
    `CREATE TABLE IF NOT EXISTS lead_deliveries (
      lead_id INTEGER NOT NULL REFERENCES leads (id) ON DELETE CASCADE,
      channel TEXT NOT NULL,
      status TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt_at TEXT,
      last_error TEXT,
      sent_at TEXT,
      external_id TEXT,
      PRIMARY KEY (lead_id, channel)
    )`,
    `CREATE INDEX IF NOT EXISTS lead_deliveries_due ON lead_deliveries (status, next_attempt_at)`,
    // Ключ повтора (двойное нажатие): lead_id пуст, пока первая отправка в работе.
    `CREATE TABLE IF NOT EXISTS lead_requests (
      key TEXT PRIMARY KEY,
      lead_id INTEGER REFERENCES leads (id) ON DELETE CASCADE,
      claimed_at TEXT NOT NULL
    )`,
  ],
  // 2 — серия сбоев канала: одно служебное сообщение о сбое и одно о восстановлении.
  [
    `CREATE TABLE IF NOT EXISTS channel_alerts (
      channel TEXT PRIMARY KEY,
      opened_at TEXT NOT NULL,
      first_lead_id INTEGER NOT NULL,
      failed_count INTEGER NOT NULL,
      last_error TEXT
    )`,
  ],
];

export const SCHEMA_VERSION = MIGRATIONS.length;

let ready: Promise<void> | null = null;

/** Один раз на экземпляр Worker; при ошибке следующий запрос попробует снова. */
export function ensureSchema(db: D1Database): Promise<void> {
  ready ??= migrate(db).catch((err) => {
    ready = null;
    throw err;
  });
  return ready;
}

async function migrate(db: D1Database): Promise<void> {
  await db.prepare('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)').run();
  const row = await db.prepare('SELECT MAX(version) AS v FROM schema_migrations').first<{ v: number | null }>();
  let current = row?.v ?? 0;
  while (current < MIGRATIONS.length) {
    const version = current + 1;
    const statements = MIGRATIONS[current].map((sql) => db.prepare(sql));
    statements.push(db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').bind(version, new Date().toISOString()));
    try {
      await db.batch(statements);
    } catch (err) {
      // Миграцию мог применить соседний экземпляр — проверяем версию, иначе ошибка настоящая.
      const again = await db.prepare('SELECT MAX(version) AS v FROM schema_migrations').first<{ v: number | null }>();
      if ((again?.v ?? 0) < version) throw err;
    }
    current = version;
  }
}
