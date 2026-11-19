/**
 * Контент из Sanity при сборке (этап 3, CLAUDE.md «Скорость»).
 *
 * До старта Vite (astro:config:setup) один раз скачивает опубликованные документы и оригиналы
 * файлов, на которые они ссылаются, в src/content-sanity/ (папка не в git):
 *   content.json — документы и сведения о файлах (один снимок на сборку: тексты и фото согласованы);
 *   assets/      — оригиналы фото, SVG и PDF без пережатия, имена — исходные имена файлов.
 * Дальше фото обрабатывает astro:assets так же, как раньше из выгрузки (src/lib/content.ts).
 *
 * Документы: набор данных публичный, ключ не нужен, черновики не видны (только опубликованное).
 * Фото: обычный адрес CDN отдаёт пережатую копию (проверено 2026-11-19: пиксели и вес другие),
 * оригинал — только с ?dlRaw=true и ключом чтения. Ключ — переменная сборки SANITY_READ_TOKEN
 * (роль Viewer; в Cloudflare — секрет сборки, не в репозитории и не на сайте).
 * Каждый скачанный файл сверяется с контрольной суммой оригинала (sha1); не совпало — сборка падает.
 * Источник переключается переменной CONTENT_SOURCE: sanity (по умолчанию) | fixtures.
 */
import { mkdir, writeFile, readdir, stat, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import type { AstroIntegration } from 'astro';

export const SANITY = { projectId: 'rxw30lco', dataset: 'production', apiVersion: '2025-02-19' } as const;

const TYPES = ['landing', 'siteSettings', 'apartmentFormat', 'constructionReport', 'pricing'];

async function query<T>(groq: string): Promise<T> {
  const url = `https://${SANITY.projectId}.api.sanity.io/v${SANITY.apiVersion}/data/query/${SANITY.dataset}?query=${encodeURIComponent(groq)}&perspective=published`;
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return ((await res.json()) as { result: T }).result;
    } catch (e) {
      if (attempt >= 3) throw new Error(`Sanity недоступен (${url.slice(0, 80)}…): ${(e as Error).message}`);
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

interface AssetDoc { _id: string; url: string; originalFilename?: string; extension: string; sha1hash: string; size: number }

/** Все ссылки на файлы в документах: image-… и file-…. */
function collectAssetRefs(v: unknown, out: Set<string>) {
  if (Array.isArray(v)) v.forEach((x) => collectAssetRefs(x, out));
  else if (v && typeof v === 'object') {
    const ref = (v as { _ref?: unknown })._ref;
    if (typeof ref === 'string' && /^(image|file)-/.test(ref)) out.add(ref);
    Object.values(v).forEach((x) => collectAssetRefs(x, out));
  }
}

/** Имя файла: исходное имя; при совпадении имён у разных файлов — с началом контрольной суммы. */
function fileNames(assets: AssetDoc[]): Map<string, string> {
  const safe = (s: string) => s.replace(/[^\w.-]+/g, '-');
  const count = new Map<string, number>();
  for (const a of assets) {
    const n = safe(a.originalFilename ?? `${a.sha1hash}.${a.extension}`);
    count.set(n, (count.get(n) ?? 0) + 1);
  }
  return new Map(assets.map((a) => {
    const n = safe(a.originalFilename ?? `${a.sha1hash}.${a.extension}`);
    return [a._id, count.get(n)! > 1 ? `${a.sha1hash.slice(0, 8)}-${n}` : n];
  }));
}

/** Строки KEY=value из .env (без подстановок); файла нет — пусто. */
async function envFile(url: URL): Promise<Record<string, string>> {
  if (!existsSync(url)) return {};
  const out: Record<string, string> = {};
  for (const line of (await readFile(url, 'utf8')).split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

export default function sanityContent(): AstroIntegration {
  return {
    name: 'forrest-sanity',
    hooks: {
      'astro:config:setup': async ({ config, logger }) => {
        if ((process.env.CONTENT_SOURCE ?? 'sanity') !== 'sanity') {
          logger.info('контент — временные фикстуры (CONTENT_SOURCE=fixtures)');
          return;
        }
        const dir = new URL('src/content-sanity/', config.root);
        const assetsDir = new URL('assets/', dir);
        await mkdir(assetsDir, { recursive: true });

        const documents = await query<Record<string, unknown>[]>(`*[_type in $types]`.replace('$types', JSON.stringify(TYPES)));
        const refs = new Set<string>();
        collectAssetRefs(documents, refs);
        const assets = await query<AssetDoc[]>(`*[_id in ${JSON.stringify([...refs])}]{_id, url, originalFilename, extension, sha1hash, size}`);
        const missing = [...refs].filter((r) => !assets.some((a) => a._id === r));
        if (missing.length) throw new Error(`В Sanity нет файлов: ${missing.join(', ')}`);

        // Cloudflare: переменная сборки; локально — файл .env в корне (в git не попадает).
        const token = (process.env.SANITY_READ_TOKEN ?? (await envFile(new URL('.env', config.root))).SANITY_READ_TOKEN)?.trim();
        if (!token && assets.some((a) => a._id.startsWith('image-')))
          throw new Error('Нет SANITY_READ_TOKEN: без ключа чтения Sanity отдаёт только пережатые копии фото (docs/ADMIN.md, «Сборка»)');
        const sha1 = (b: Buffer) => createHash('sha1').update(b).digest('hex');
        const names = fileNames(assets);
        let downloaded = 0;
        await Promise.all(assets.map(async (a) => {
          const file = new URL(names.get(a._id)!, assetsDir);
          // Оригинал уже скачан (контрольная сумма совпала) — не качаем снова.
          if (existsSync(file) && (await stat(file)).size === a.size && sha1(await readFile(file)) === a.sha1hash) return;
          const isImage = a._id.startsWith('image-');
          const res = await fetch(isImage ? `${a.url}?dlRaw=true` : a.url, isImage ? { headers: { Authorization: `Bearer ${token}` } } : {});
          if (!res.ok) throw new Error(`Не скачался файл ${a.originalFilename}: HTTP ${res.status}${res.status === 401 ? ' (ключ SANITY_READ_TOKEN не подходит)' : ''}`);
          const bytes = Buffer.from(await res.arrayBuffer());
          if (sha1(bytes) !== a.sha1hash) throw new Error(`Файл ${a.originalFilename} пришёл не оригиналом (контрольная сумма не совпала)`);
          await writeFile(file, bytes);
          downloaded++;
        }));

        // Файлы прошлых сборок, на которые больше нет ссылок (фото заменили), удаляются из кэша:
        // всё, что лежит в assets/, попадает в import.meta.glob и иначе ушло бы в сборку.
        const keep = new Set(names.values());
        const stale = (await readdir(assetsDir)).filter((f) => !keep.has(f));
        await Promise.all(stale.map((f) => rm(new URL(f, assetsDir))));
        if (stale.length) logger.info(`из кэша удалено неиспользуемых файлов: ${stale.length}`);

        const files = Object.fromEntries(assets.map((a) => [a._id, { file: names.get(a._id), url: a.url, originalFilename: a.originalFilename, extension: a.extension }]));
        await writeFile(new URL('content.json', dir), JSON.stringify({ fetchedAt: new Date().toISOString(), documents, files }, null, 1));
        logger.info(`Sanity: документов ${documents.length}, файлов ${assets.length} (скачано ${downloaded})`);
      },
    },
  };
}
