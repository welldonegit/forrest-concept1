/** Заголовок на каждом ответе Worker: по нему тесты отличают ответы API от статики. */
export const API_HEADER = 'x-forrest-api';

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      [API_HEADER]: '1',
      ...headers,
    },
  });
}

/**
 * Коды ошибок API. Текст для посетителя фронт берёт из Sanity по коду.
 * Личные данные в ответах и журналах не выводятся.
 */
export type ErrorCode =
  | 'not_found'
  | 'method_not_allowed'
  | 'forbidden'
  | 'unsupported_media_type'
  | 'payload_too_large'
  | 'invalid_json'
  | 'validation'
  | 'rate_limited'
  | 'captcha'
  | 'captcha_unavailable'
  | 'in_progress'
  | 'server_error';

export function error(code: ErrorCode, status: number, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}): Response {
  return json({ ok: false, error: code, ...extra }, status, headers);
}
