// Несекретные настройки Worker (wrangler.jsonc → vars) — единственный источник и для сборки сайта.
// Сейчас сборке нужен только публичный ключ Turnstile. Переменная окружения с тем же именем
// перекрывает значение из файла (локальная сборка с тестовым ключом, тесты).
import { readFileSync } from 'node:fs';

/** JSONC → JSON: убирает комментарии // и /* *\/ вне строк и висячие запятые. */
function stripJsonc(src: string): string {
  let out = '';
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '"') {
      const start = i;
      for (i++; i < src.length && src[i] !== '"'; i++) if (src[i] === '\\') i++;
      out += src.slice(start, i + 1);
    } else if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      out += '\n';
    } else if (c === '/' && src[i + 1] === '*') {
      i = src.indexOf('*/', i + 2) + 1;
    } else out += c;
  }
  return out.replace(/,(\s*[}\]])/g, '$1');
}

export function wranglerVar(name: string, file = 'wrangler.jsonc'): string {
  const env = process.env[name];
  if (env !== undefined) return env.trim();
  const config = JSON.parse(stripJsonc(readFileSync(file, 'utf8'))) as { vars?: Record<string, string> };
  return String(config.vars?.[name] ?? '').trim();
}
