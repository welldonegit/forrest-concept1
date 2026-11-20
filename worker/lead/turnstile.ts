/**
 * Проверка токена Turnstile на сервере (siteverify).
 * Ключей по умолчанию в коде нет. Тестовые ключи Cloudflare принимаются только
 * локально и на превью (*.workers.dev): на боевом домене тестовая пара = «не настроено».
 */
import type { Env } from '../env';

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TIMEOUT_MS = 5000;
/** Тестовые секреты Cloudflare: 1x… — всегда успех, 2x… — отказ, 3x… — «токен уже использован». */
const TEST_SECRET = /^[123]x0{31}AA$/;

export type CaptchaResult = 'ok' | 'failed' | 'unavailable';

export function isPreviewHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.workers.dev');
}

/** Секрет, которым можно проверять на этом адресе, или null («капча не настроена»). */
export function captchaSecret(env: Env, hostname: string): string | null {
  const secret = env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return null;
  if (TEST_SECRET.test(secret) && !isPreviewHost(hostname)) return null;
  return secret;
}

export async function verifyTurnstile(secret: string, token: string, ip: string | null, hostname: string): Promise<CaptchaResult> {
  if (!token) return 'failed';
  const body = new FormData();
  body.set('secret', secret);
  body.set('response', token);
  if (ip) body.set('remoteip', ip);
  // Один ключ на обе попытки: повтор после сетевого сбоя не считается повторным использованием токена.
  body.set('idempotency_key', crypto.randomUUID());

  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response;
    try {
      res = await fetch(SITEVERIFY, { method: 'POST', body, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      continue;
    }
    if (res.status >= 500) continue;
    const data = (await res.json().catch(() => null)) as { success?: boolean; hostname?: string } | null;
    if (!data?.success) return 'failed';
    // Боевой ключ: токен должен быть выдан на этом же адресе. У тестовых ключей hostname условный.
    if (!TEST_SECRET.test(secret) && data.hostname && data.hostname !== hostname) return 'failed';
    return 'ok';
  }
  return 'unavailable';
}
