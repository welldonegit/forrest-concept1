/**
 * Контент из Sanity при сборке (этап 3, CLAUDE.md «Скорость»).
 *
 * До старта Vite (astro:config:setup) один раз скачивает опубликованные документы и оригиналы
 * файлов, на которые они ссылаются, в src/content-sanity/ (папка не в git):
 *   content.json — документы и сведения о файлах (один снимок на сборку: тексты и фото согласованы);
 *   assets/      — оригиналы фото, SVG и PDF без пережатия, имена — исходные имена файлов.
 * Дальше фото обрабатывает astro:assets так же, как раньше из выгрузки (src/lib/content.ts).
 *
 * Набор данных публичный: ключей нет ни в сборке, ни на сайте; черновики не видны (только опубликованное).
 * Фото: адрес CDN без параметров отдаёт пережатую копию (JPEG ~75%), исходный файл — только с ключом.
 * Поэтому фото берутся без потерь — ?fm=png: те же пиксели, что в загруженном оригинале
 * (проверено 2026-11-19 на 48 из 49 фото попиксельно), дальше astro:assets делает AVIF как раньше.
 * Файлы (SVG-иконки, PDF) отдаются байт в байт; SVG-логотипы в поле фото — без обёртки метаданных c2pa, рисунок тот же. Размер фото сверяется с данными Sanity; не совпал — сборка падает.
 * Источник переключается переменной CONTENT_SOURCE: sanity (по умолчанию) | fixtures.
 */
import { mkdir, writeFile, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import type { AstroIntegration } from 'astro';

export const SANITY = { projectId: 'rxw30lco', dataset: 'production', apiVersion: '2025-02-19' } as const;

const TYPES = ['landing', 'siteSettings', 'apartmentFormat', 'constructionReport', 'pricing', 'legalDocument'];

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

interface AssetDoc { _id: string; url: string; originalFilename?: string; extension: string; sha1hash: string; size: number; w?: number; h?: number }

/** Растровое фото: качаем без потерь в PNG. SVG-«фото» (логотипы) и файлы — как есть. */
const isRaster = (a: AssetDoc) => a._id.startsWith('image-') && a.extension !== 'svg';

/** Все ссылки на файлы в документах: image-… и file-…. */
function collectAssetRefs(v: unknown, out: Set<string>) {
  if (Array.isArray(v)) v.forEach((x) => collectAssetRefs(x, out));
  else if (v && typeof v === 'object') {
    const ref = (v as { _ref?: unknown })._ref;
    if (typeof ref === 'string' && /^(image|file)-/.test(ref)) out.add(ref);
    Object.values(v).forEach((x) => collectAssetRefs(x, out));
  }
}

/** Имя файла: исходное имя (у фото — с .png); при совпадении имён у разных файлов — с началом контрольной суммы. */
function fileNames(assets: AssetDoc[]): Map<string, string> {
  const base = (a: AssetDoc) => {
    const n = (a.originalFilename ?? `${a.sha1hash}.${a.extension}`).replace(/[^\w.-]+/g, '-');
    return isRaster(a) ? n.replace(/\.[^.]+$/, '') + '.png' : n;
  };
  const count = new Map<string, number>();
  for (const a of assets) count.set(base(a), (count.get(base(a)) ?? 0) + 1);
  return new Map(assets.map((a) => [a._id, count.get(base(a))! > 1 ? `${a.sha1hash.slice(0, 8)}-${base(a)}` : base(a)]));
}

/** Ширина и высота PNG из заголовка IHDR. */
const pngSize = (b: Buffer) => ({ w: b.readUInt32BE(16), h: b.readUInt32BE(20) });

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
        const assets = await query<AssetDoc[]>(`*[_id in ${JSON.stringify([...refs])}]{_id, url, originalFilename, extension, sha1hash, size, "w": metadata.dimensions.width, "h": metadata.dimensions.height}`);
        const missing = [...refs].filter((r) => !assets.some((a) => a._id === r));
        if (missing.length) throw new Error(`В Sanity нет файлов: ${missing.join(', ')}`);

        const names = fileNames(assets);
        // Прошлый снимок: файл с тем же именем и тем же _id уже скачан — не качаем снова.
        const prevUrl = new URL('content.json', dir);
        const prev = existsSync(prevUrl) ? (JSON.parse(await readFile(prevUrl, 'utf8')).files ?? {}) as Record<string, { file: string }> : {};
        let downloaded = 0;
        await Promise.all(assets.map(async (a) => {
          const file = new URL(names.get(a._id)!, assetsDir);
          if (prev[a._id]?.file === names.get(a._id) && existsSync(file)) return;
          const res = await fetch(isRaster(a) ? `${a.url}?fm=png` : a.url);
          if (!res.ok) throw new Error(`Не скачался файл ${a.originalFilename}: HTTP ${res.status}`);
          const bytes = Buffer.from(await res.arrayBuffer());
          if (isRaster(a)) {
            const { w, h } = pngSize(bytes);
            if (w !== a.w || h !== a.h) throw new Error(`Фото ${a.originalFilename}: пришло ${w}×${h}, в Sanity ${a.w}×${a.h}`);
          } else if (a._id.startsWith('file-') && bytes.length !== a.size) throw new Error(`Файл ${a.originalFilename} пришёл изменённым (${bytes.length} байт вместо ${a.size})`);
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
