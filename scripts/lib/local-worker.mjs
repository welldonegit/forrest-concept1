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
      if ((await fetch(`${base}/uk/`)).ok) break;
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

/**
 * fetch к локальному Worker с одним повтором при обрыве соединения (UND_ERR_SOCKET):
 * wrangler dev закрывает простаивающие keep-alive соединения, и следующий запрос по ним
 * падает, не дойдя до Worker. Повтор того же запроса безопасен — до сервера он не дошёл
 * (а у заявок есть ключ повтора).
 */
export async function fetchLocal(url, init) {
  try {
    return await fetch(url, init);
  } catch (err) {
    if (err?.cause?.code !== 'UND_ERR_SOCKET' && err?.cause?.code !== 'ECONNRESET') throw err;
    return fetch(url, init);
  }
}
