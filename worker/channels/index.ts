/**
 * Каналы доставки заявки. Статус по каждому: sent | pending | failed («не доставлена») | not_configured.
 * Канал без ключей — not_configured; такие заявки после добавления ключей не досылаются.
 * Отправители: Telegram (telegram.ts), CRM (crm.ts).
 */
import type { Env } from '../env';
import type { StoredLead } from '../db/leads';
import { formatLeadMessage, sendTelegram } from './telegram';
import { sendCrm } from './crm';

export type ChannelId = 'telegram' | 'crm';
export type DeliveryStatus = 'sent' | 'pending' | 'failed' | 'not_configured';

/** Результат попытки. noResponse — таймаут или обрыв: CRM перед повтором ищет лид по номеру. */
export type SendResult = { ok: true; externalId?: string } | { ok: false; error: string; noResponse?: boolean };

/** afterNoResponse — прошлая попытка осталась без ответа (CRM ищет дубль перед отправкой). */
export interface SendOptions { afterNoResponse?: boolean }

/** Префикс last_error у попытки без ответа — по нему следующая попытка ищет дубль. */
export const NO_RESPONSE = 'no_response';

export interface Channel {
  id: ChannelId;
  isConfigured(env: Env): boolean;
  send?(env: Env, lead: StoredLead, signal: AbortSignal, opts?: SendOptions): Promise<SendResult>;
}

const filled = (v: string | undefined) => Boolean(v && v.trim());

export const CHANNELS: Channel[] = [
  {
    id: 'telegram',
    isConfigured: (env) => filled(env.TELEGRAM_BOT_TOKEN) && filled(env.TELEGRAM_CHAT_ID),
    send: (env, lead, signal) => sendTelegram(env, formatLeadMessage(lead), signal),
  },
  { id: 'crm', isConfigured: (env) => filled(env.CRM_TOKEN), send: sendCrm },
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
