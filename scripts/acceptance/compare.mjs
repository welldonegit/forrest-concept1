#!/usr/bin/env node
/**
 * Приёмка блока по скриншотам: вёрстка против design-export/index.html.
 *
 *   npm run acceptance -- --block header
 *   npm run acceptance -- --block header --widths 1440,390 --smoke none --states menu --lang en
 *
 * Параметры:
 *   --block   имя конфига из scripts/acceptance/blocks/<имя>.mjs (обязательно)
 *   --widths  ширины попиксельной сверки через запятую; по умолчанию 1920,1440,390
 *   --smoke   ширины «ничего не сломалось»: только скриншот вёрстки, без диффа;
 *             по умолчанию 1280,1024,360; none — пропустить (LAYOUT_RULES, «Приёмка блоков»)
 *   --states  состояния из конфига через запятую; по умолчанию все
 *   --lang    язык вёрстки: uk (по умолчанию), en, …
 *   --url     адрес вёрстки (например, http://localhost:4321 при запущенном dev-сервере);
 *             по умолчанию скрипт сам раздаёт dist/client — сначала npm run build
 *   --out     папка результатов; по умолчанию .acceptance/<блок>/ (в .gitignore)
 *
 * Результат: <ширина>-<состояние>-{exp,ours,diff}.png, <ширина>-<состояние>-smoke.png и report.json;
 * в консоль — процент несовпавших пикселей и только элементы, у которых позиция или размер
 * разошлись больше 2px или изменилось число строк; на проверочных ширинах — элементы,
 * вылезающие за окно по горизонтали.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** Высоты окна для ширин приёмки. */
const VIEWPORTS = { 1920: 1080, 1680: 1050, 1600: 900, 1440: 900, 1280: 800, 1024: 768, 390: 844, 360: 780 };
const DEFAULT_WIDTHS = '1920,1440,390';
const DEFAULT_SMOKE = '1280,1024,360';
const TOLERANCE = 2;

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const [k, v] = a.includes('=') ? a.slice(2).split('=') : [a.slice(2), argv[++i]];
    out[k] = v;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (!args.block) {
  const list = fs.readdirSync(path.join(ROOT, 'scripts/acceptance/blocks')).map((f) => f.replace(/\.mjs$/, ''));
  console.error(`Укажи --block. Доступно: ${list.join(', ')}`);
  process.exit(1);
}
const config = (await import(pathToFileURL(path.join(ROOT, 'scripts/acceptance/blocks', `${args.block}.mjs`)).href)).default;
const toViewports = (list) => (list === 'none' ? [] : list.split(',').map(Number).map((w) => [w, VIEWPORTS[w] ?? 900]));
const widths = toViewports(args.widths ?? DEFAULT_WIDTHS);
const smokeWidths = toViewports(args.smoke ?? DEFAULT_SMOKE);
const stateNames = args.states ? args.states.split(',') : Object.keys(config.states);
for (const s of stateNames) if (!config.states[s]) throw new Error(`Нет состояния «${s}» в конфиге ${args.block}`);
const lang = args.lang ?? 'uk';
const outDir = path.resolve(ROOT, args.out ?? `.acceptance/${args.block}${lang === 'uk' ? '' : `-${lang}`}`);
fs.mkdirSync(outDir, { recursive: true });

/* ---------- Раздача: /design-export/ — выгрузка, остальное — dist/client ---------- */
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
  '.avif': 'image/avif', '.webp': 'image/webp', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.png': 'image/png', '.json': 'application/json' };
const dist = path.join(ROOT, 'dist/client');
const exportDir = path.join(ROOT, 'design-export');
if (!args.url && !fs.existsSync(dist)) { console.error('Нет dist/client: сначала npm run build или передай --url'); process.exit(1); }
const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const fromExport = pathname.startsWith('/design-export/');
    const rootDir = fromExport ? exportDir : dist;
    let f = path.join(rootDir, fromExport ? pathname.slice('/design-export'.length) : pathname);
    if (!f.startsWith(rootDir)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if (!fs.existsSync(f)) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(f)] ?? 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const local = `http://127.0.0.1:${server.address().port}`;
const base = args.url?.replace(/\/$/, '') ?? local;
const EXPORT_URL = `${local}/design-export/index.html`;
const oursUrl = `${base}/${lang}/${config.hash ?? ''}`;

/* ---------- Замеры ---------- */
// Элемент конфига: [название, селектор в выгрузке, селектор в вёрстке, 'text'?]
// 'text' — меряем рамку самого текста (без паддингов) и число строк.
async function measure(page, list, idx) {
  return page.evaluate(({ list, idx }) => list.map((row) => {
    const el = document.querySelector(row[idx]);
    if (!el) return null;
    let r;
    if (row[3] === 'text') {
      const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => (n.textContent.trim() && !n.parentElement.closest('svg') ? 1 : 3),
      });
      const rects = [];
      for (let n; (n = tw.nextNode());) {
        const rg = document.createRange();
        rg.selectNodeContents(n);
        rects.push(...[...rg.getClientRects()].filter((x) => x.width > 0));
      }
      if (!rects.length) return null;
      const x = Math.min(...rects.map((a) => a.left)), y = Math.min(...rects.map((a) => a.top));
      r = { x, y, width: Math.max(...rects.map((a) => a.right)) - x, height: Math.max(...rects.map((a) => a.bottom)) - y,
        lines: new Set(rects.map((a) => Math.round(a.top))).size };
    } else r = el.getBoundingClientRect();
    const fx = (v) => +v.toFixed(1);
    return { x: fx(r.x), y: fx(r.y), w: fx(r.width), h: fx(r.height), lines: r.lines, fs: getComputedStyle(el).fontSize };
  }), { list, idx });
}

/* ---------- Пиксельный дифф (в браузере, без лишних зависимостей) ---------- */
async function pixelDiff(page, expFile, oursFile, diffFile) {
  const a = fs.readFileSync(expFile).toString('base64');
  const o = fs.readFileSync(oursFile).toString('base64');
  const res = await page.evaluate(async ({ a, o }) => {
    const load = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = `data:image/png;base64,${s}`; });
    const [A, O] = [await load(a), await load(o)];
    const W = Math.max(A.width, O.width), H = Math.max(A.height, O.height);
    const ctx = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c.getContext('2d'); };
    const xa = ctx(), xo = ctx(), xd = ctx();
    xa.drawImage(A, 0, 0); xo.drawImage(O, 0, 0);
    const da = xa.getImageData(0, 0, W, H).data, dO = xo.getImageData(0, 0, W, H).data;
    const out = xd.createImageData(W, H);
    let n = 0;
    for (let i = 0; i < da.length; i += 4) {
      const d = Math.abs(da[i] - dO[i]) + Math.abs(da[i + 1] - dO[i + 1]) + Math.abs(da[i + 2] - dO[i + 2]);
      if (d > 60) { n++; out.data.set([230, 30, 60, 255], i); }
      else { const g = (dO[i] * 0.3 + dO[i + 1] * 0.59 + dO[i + 2] * 0.11) * 0.35 + 165; out.data.set([g, g, g, 255], i); }
    }
    xd.putImageData(out, 0, 0);
    return { pct: +((n / (W * H)) * 100).toFixed(2), png: xd.canvas.toDataURL('image/png').split(',')[1] };
  }, { a, o });
  fs.writeFileSync(diffFile, Buffer.from(res.png, 'base64'));
  return res.pct;
}

/* ---------- Прогон ---------- */
const browser = await chromium.launch();
const report = { block: args.block, lang, ours: oursUrl, export: EXPORT_URL, widths: {}, smoke: {} };

/** Открыть страницу и довести до состояния. */
async function openState(side, state, w, h) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(side === 'exp' ? EXPORT_URL : oursUrl, { waitUntil: 'networkidle' });
  // панель dev-сервера Astro (при --url на astro dev) перекрывает низ окна
  const css = (config.neutralize?.[side] ?? '') + (side === 'ours' ? 'astro-dev-toolbar{display:none!important}' : '');
  if (css) await page.addStyleTag({ content: css });
  await page.waitForTimeout(config.settle ?? 2600);
  await state.prepare?.(page, side, { w, h });
  return page;
}
const applies = (state, w) => !(state.minWidth && w < state.minWidth) && !(state.maxWidth && w > state.maxWidth);
try {
  for (const [w, h] of widths) {
    report.widths[w] = {};
    for (const name of stateNames) {
      const state = config.states[name];
      if (!applies(state, w)) continue;
      const shots = {}, meas = {};
      for (const side of ['exp', 'ours']) {
        const page = await openState(side, state, w, h);
        const file = path.join(outDir, `${w}-${name}-${side}.png`);
        await page.screenshot({ path: file, clip: state.clip?.({ w, h }) });
        shots[side] = file;
        meas[side] = await measure(page, state.elements, side === 'exp' ? 1 : 2);
        await page.close();
      }
      const rows = state.elements.map((row, i) => {
        const a = meas.exp[i], o = meas.ours[i];
        if (!a || !o) return { name: row[0], missing: !a ? 'exp' : 'ours' };
        const d = { dx: +(o.x - a.x).toFixed(1), dy: +(o.y - a.y).toFixed(1), dw: +(o.w - a.w).toFixed(1), dh: +(o.h - a.h).toFixed(1) };
        const bad = Math.max(...Object.values(d).map(Math.abs)) > TOLERANCE || (a.lines && o.lines && a.lines !== o.lines);
        return { name: row[0], exp: a, ours: o, ...d, bad: Boolean(bad) };
      });
      report.widths[w][name] = { rows, shots };
    }
  }

  // Проверочные ширины: только вёрстка, без выгрузки и диффа.
  for (const [w, h] of smokeWidths) {
    report.smoke[w] = {};
    for (const name of stateNames) {
      const state = config.states[name];
      if (!applies(state, w)) continue;
      const page = await openState('ours', state, w, h);
      const file = path.join(outDir, `${w}-${name}-smoke.png`);
      await page.screenshot({ path: file, clip: state.clip?.({ w, h }), fullPage: !state.clip && Boolean(state.fullPage) });
      const sel = config.root ?? 'body';
      const overflow = await page.evaluate(({ sel, w }) => {
        const root = document.querySelector(sel);
        if (!root) return [`нет ${sel}`];
        const out = [];
        for (const el of root.querySelectorAll('*')) {
          const r = el.getBoundingClientRect();
          if (!r.width || getComputedStyle(el).visibility === 'hidden') continue;
          if (el.closest('[aria-hidden="true"], [hidden]')) continue;
          // элементы горизонтальных лент (overflow-x: auto) законно уходят за окно
          let p = el.parentElement, inScroller = false;
          for (; p && p !== root.parentElement; p = p.parentElement) {
            if (/(auto|scroll)/.test(getComputedStyle(p).overflowX)) { inScroller = true; break; }
          }
          if (inScroller) continue;
          if (r.right > w + 1 || r.left < -1) out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} [${Math.round(r.left)}…${Math.round(r.right)}]`);
        }
        return [...new Set(out)].slice(0, 12);
      }, { sel, w });
      report.smoke[w][name] = { file, overflow };
      await page.close();
    }
  }

  const page = await browser.newPage();
  for (const w of Object.keys(report.widths)) {
    for (const [name, r] of Object.entries(report.widths[w])) {
      r.shots.diff = r.shots.exp.replace(/-exp\.png$/, '-diff.png');
      r.pct = await pixelDiff(page, r.shots.exp, r.shots.ours, r.shots.diff);
      const bad = r.rows.filter((x) => x.bad || x.missing);
      const txt = bad.map((x) => x.missing ? `${x.name} (нет в ${x.missing})`
        : `${x.name} [dx ${x.dx}, dy ${x.dy}, dw ${x.dw}, dh ${x.dh}${x.exp.lines !== x.ours.lines ? `, строк ${x.exp.lines}→${x.ours.lines}` : ''}]`);
      console.log(`${w} ${name}: дифф ${r.pct}% · >${TOLERANCE}px: ${txt.length ? txt.join('; ') : '—'}`);
    }
  }
  for (const [w, states] of Object.entries(report.smoke)) {
    for (const [name, r] of Object.entries(states)) {
      console.log(`${w} ${name} (скриншот): ${r.overflow.length ? `за окном: ${r.overflow.join('; ')}` : 'ничего не вылезает'}`);
    }
  }
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 1));
  console.log(`\nРезультаты: ${path.relative(ROOT, outDir)}/`);
} finally {
  await browser.close();
  server.close();
}
