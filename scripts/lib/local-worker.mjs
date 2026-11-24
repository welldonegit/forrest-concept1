/**
 * Локальный Worker для тестов: `wrangler dev` по wrangler.jsonc, своя временная D1,
 * тестовая пара ключей Turnstile (всегда успех), каналы не настроены (или extraEnv).
 * .dev.vars разработчика не участвует. Расписание запускается запросом runCron().
 */
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

export const TEST_SITE_KEY = '1x00000000000000000000AA';
export const TEST_SECRET = '1x0000000000000000000000000000000AA';

export async function startWorker(port, extraEnv = {}) {
  const state = mkdtempSync(path.join(tmpdir(), 'forrest-worker-'));
  const envFile = path.join(state, 'test.env');
  const vars = { TURNSTILE_SITE_KEY: TEST_SITE_KEY, TURNSTILE_SECRET_KEY: TEST_SECRET, ...extraEnv };
  writeFileSync(envFile, Object.entries(vars).map(([k, v]) => `${k}=${v}\n`).join(''));
  const persist = path.join(state, 'wrangler');
  const base = `http://127.0.0.1:${port}`;
  const dev = spawn(
    'npx',
    ['wrangler', 'dev', '--config', 'wrangler.jsonc', '--ip', '127.0.0.1', '--port', String(port),
      '--persist-to', persist, '--env-file', envFile, '--show-interactive-dev-session=false',
      // с routes (боевой домен) wrangler иначе подставляет его в request.url вместо настоящего адреса
      '--infer-origin-from-routes=false', '--log-level', 'warn', '--test-scheduled'],
    { stdio: ['ignore', 'pipe', 'pipe'], detached: true },
  );
  let log = '';
  dev.stdout.on('data', (d) => (log += d));
  dev.stderr.on('data', (d) => (log += d));
  const deadline = Date.now() + 60_000;
  for (;;) {
    try {
      if ((await fetch(`${base}/`)).ok) break;
    } catch {}
    if (Date.now() > deadline) throw new Error(`wrangler dev не поднялся:\n${log}`);
    await new Promise((r) => setTimeout(r, 500));
  }
  return {
    base,
    /** Запрос к локальной D1 этого Worker. */
    sql(query) {
      const out = execFileSync('npx', ['wrangler', 'd1', 'execute', 'DB', '--local', '--config', 'wrangler.jsonc',
        '--persist-to', persist, '--json', '--command', query], { encoding: 'utf8' });
      return JSON.parse(out)[0].results;
    },
    /** Один запуск Cron Trigger (wrangler dev --test-scheduled). */
    async runCron() {
      const r = await fetchLocal(`${base}/cdn-cgi/handler/scheduled?cron=${encodeURIComponent('*/10 * * * *')}`);
      if (!r.ok) throw new Error(`scheduled: ${r.status}`);
    },
    log: () => log,
    /** Папка локальной D1 (для wrangler d1 … --persist-to). */
    persist,
    stop() {
      try { process.kill(-dev.pid, 'SIGTERM'); } catch {}
      rmSync(state, { recursive: true, force: true });
    },
  };
}

/** Коды обрыва соединения: запрос не дошёл до Worker. */
const SOCKET_CLOSED = new Set(['UND_ERR_SOCKET', 'UND_ERR_CLOSED', 'ECONNRESET', 'EPIPE']);

/**
 * fetch к локальному Worker с двумя повторами при обрыве соединения: wrangler dev закрывает простаивающие
 * keep-alive соединения, и запрос, отправленный по такому соединению в момент закрытия, падает, не дойдя
 * до Worker; в пуле может быть не одно такое соединение. Повтор безопасен: у заявок есть ключ повтора,
 * а лишний запуск расписания ничего не делает (сроки попыток ещё не наступили).
 * Другая ошибка — сразу, с кодом причины в тексте.
 */
export async function fetchLocal(url, init) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetch(url, init);
    } catch (err) {
      const code = err?.cause?.code;
      if (!SOCKET_CLOSED.has(code) || attempt >= 2) throw new Error(`${url}: ${err.message} (${code ?? err?.cause?.message ?? 'без коду'})`, { cause: err });
    }
  }
}
