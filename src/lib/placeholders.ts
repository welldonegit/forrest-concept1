/**
 * Заглушки в контенте (этап 6, условие снятия запрета индексации): ссылка «#», ссылка соцсети или мессенджера
 * без профиля (https://t.me/), [ФАКТ: N] из выгрузки, TODO в текстах. Видимое посетителю: скрытые блоки
 * главной (поле «Сховати блок») и служебные поля «_…» не проверяются. Черновиков в снимке нет.
 * Используется сборкой с SITE_INDEXING=allow (src/integrations/indexing.ts) и `npm run content:placeholders`.
 */
export interface Placeholder { doc: string; path: string; kind: string; value: string }

/** Хосты, у которых адрес без пути — заглушка (нет имени профиля или номера). */
const PROFILE_HOSTS = /(^|\.)(t\.me|telegram\.me|instagram\.com|facebook\.com|youtube\.com|tiktok\.com|wa\.me|linkedin\.com|x\.com|twitter\.com)$/i;

function kindOf(key: string, value: string): string | undefined {
  if ((key === 'href' || key === 'url') && value.trim() === '#') return 'посилання «#»';
  if (/^https?:\/\//i.test(value)) {
    try {
      const u = new URL(value);
      if (PROFILE_HOSTS.test(u.hostname) && u.pathname.replace(/\/+$/, '') === '' && !u.search) return 'посилання без профілю';
    } catch { return 'неправильне посилання'; }
  }
  if (/^viber:\/\/chat\?number=$/i.test(value.trim())) return 'Viber без номера';
  if (/\[(ФАКТ|FACT)\b[^\]]*\]/i.test(value)) return '[ФАКТ: …]';
  if (/\bTODO\b/.test(value)) return 'TODO';
  return undefined;
}

/** Все заглушки в документах (снимок Sanity или фикстуры): документ, путь поля, вид, значение. */
export function findPlaceholders(documents: Array<Record<string, unknown>>): Placeholder[] {
  const out: Placeholder[] = [];
  for (const doc of documents) {
    const id = String(doc._id ?? doc._type ?? '?');
    const walk = (v: unknown, path: string, key: string) => {
      if (typeof v === 'string') {
        const kind = kindOf(key, v);
        if (kind) out.push({ doc: id, path, kind, value: v.length > 80 ? `${v.slice(0, 77)}…` : v });
      } else if (Array.isArray(v)) {
        v.forEach((x, i) => {
          if (x && typeof x === 'object' && (x as { hidden?: boolean }).hidden === true) return; // скрытый блок
          const label = (x as { language?: string })?.language ?? (x as { _key?: string })?._key ?? i;
          walk(x, `${path}[${label}]`, key);
        });
      } else if (v && typeof v === 'object') {
        for (const [k, x] of Object.entries(v)) if (!k.startsWith('_')) walk(x, path ? `${path}.${k}` : k, k);
      }
    };
    walk(doc, '', '');
  }
  return out;
}

export const formatPlaceholders = (list: Placeholder[]) =>
  list.map((p) => `  ${p.doc} · ${p.path} — ${p.kind}: ${JSON.stringify(p.value)}`).join('\n');
