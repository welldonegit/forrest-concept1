/**
 * Каналы доставки заявки. Статус по каждому: sent | pending | failed («не доставлена») | not_configured.
 * Канал без ключей — not_configured; такие заявки после добавления ключей не досылаются.
 * Отправители: Telegram — шаг 5.3, CRM — шаг 5.4 (поле send). Пока его нет, канал
 * с ключами остаётся в pending.
 */
import type { Env } from '../env';
import type { StoredLead } from '../db/leads';

export type ChannelId = 'telegram' | 'crm';
export type DeliveryStatus = 'sent' | 'pending' | 'failed' | 'not_configured';

/** Результат попытки. noResponse — таймаут или обрыв: CRM перед повтором ищет лид по номеру. */
export type SendResult = { ok: true; externalId?: string } | { ok: false; error: string; noResponse?: boolean };

export interface Channel {
  id: ChannelId;
  isConfigured(env: Env): boolean;
  send?(env: Env, lead: StoredLead, signal: AbortSignal): Promise<SendResult>;
}

const filled = (v: string | undefined) => Boolean(v && v.trim());

export const CHANNELS: Channel[] = [
  { id: 'telegram', isConfigured: (env) => filled(env.TELEGRAM_BOT_TOKEN) && filled(env.TELEGRAM_CHAT_ID) },
  { id: 'crm', isConfigured: (env) => filled(env.CRM_TOKEN) },
];

/** Таймаут одного запроса к каналу: укладываемся в 30 с фоновой работы после ответа. */
export const SEND_TIMEOUT_MS = 10_000;

/**
 * Попытки: сразу после записи, через 10 минут, через час (от времени заявки).
 * Возвращает время следующей попытки после attempts неудачных или null — попыток больше нет.
 */
const RETRY_OFFSETS_MS = [10 * 60_000, 60 * 60_000];
export function nextAttemptAt(createdAt: string, attempts: number): string | null {
  const offset = RETRY_OFFSETS_MS[attempts - 1];
  return offset === undefined ? null : new Date(Date.parse(createdAt) + offset).toISOString();
}
