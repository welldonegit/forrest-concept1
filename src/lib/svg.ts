/**
 * Иконки контента из Sanity (решение 2026-11-19): загруженный SVG встраивается в страницу
 * при сборке и красится цветом текста, как иконки из кода.
 *
 * Очистка — по белому списку: остаются только фигуры (path, circle, rect, line, polyline,
 * polygon, ellipse, g) и их геометрия/обводка. Удаляются скрипты, стили, ссылки (href),
 * обработчики событий, вложенные картинки и всё прочее. Любой цвет, кроме none, → currentColor.
 */

const ELEMENTS = new Set(['svg', 'g', 'path', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'rect']);
const GEOMETRY = new Set(['d', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height', 'points', 'transform', 'pathLength']);
/** Оформление: порядок — как у иконок в разметке сайта (viewBox, fill, stroke, …). */
export const PRESENTATION = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'fill-rule', 'clip-rule', 'opacity', 'fill-opacity', 'stroke-opacity'] as const;
const COLOR = new Set(['fill', 'stroke']);

export interface InlineIcon {
  viewBox: string;
  /** Оформление корня svg в порядке PRESENTATION. */
  attrs: [string, string][];
  /** Содержимое svg — очищенные фигуры. */
  inner: string;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function parseAttrs(src: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of src.matchAll(/([^\s=/]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) out.set(m[1], m[2] ?? m[3] ?? '');
  return out;
}

function cleanValue(name: string, value: string): string | null {
  const v = value.trim();
  if (/url\s*\(|javascript:|expression\s*\(/i.test(v)) return null;
  if (COLOR.has(name)) return v === 'none' ? 'none' : 'currentColor';
  return v;
}

function keepAttrs(attrs: Map<string, string>, allowGeometry: boolean): [string, string][] {
  const out: [string, string][] = [];
  for (const [name, value] of attrs) {
    if (!(allowGeometry && GEOMETRY.has(name)) && !(PRESENTATION as readonly string[]).includes(name)) continue;
    const v = cleanValue(name, value);
    if (v !== null) out.push([name, v]);
  }
  return out;
}

/** Разбирает и очищает SVG. Ошибка — если файл не похож на иконку (нет svg или viewBox). */
export function sanitizeSvg(source: string, label: string): InlineIcon {
  const text = source
    .replace(/<\?xml[\s\S]*?\?>/g, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '');
  const tags = [...text.matchAll(/<(\/?)([a-zA-Z][\w:-]*)([^>]*?)(\/?)>/g)];
  const rootTag = tags.find((t) => !t[1] && t[2] === 'svg');
  if (!rootTag) throw new Error(`Іконка ${label}: це не SVG`);
  const rootAttrs = parseAttrs(rootTag[3]);
  const viewBox = rootAttrs.get('viewBox') ?? (rootAttrs.has('width') && rootAttrs.has('height') ? `0 0 ${parseFloat(rootAttrs.get('width')!)} ${parseFloat(rootAttrs.get('height')!)}` : null);
  if (!viewBox || !/^[\d.\s,-]+$/.test(viewBox)) throw new Error(`Іконка ${label}: немає viewBox`);
  const attrs = PRESENTATION.flatMap((name) => {
    const v = rootAttrs.get(name);
    const c = v === undefined ? null : cleanValue(name, v);
    return c === null ? [] : [[name, c] as [string, string]];
  });

  // Содержимое: только разрешённые элементы; внутри запрещённого (script, style, defs, image, use…) — всё выбрасывается.
  let inner = '';
  let skipDepth = 0;
  let depth = 0;
  for (const [, close, rawName, attrSrc, selfClose] of tags) {
    const name = rawName.toLowerCase();
    if (name === 'svg' && depth === 0 && !close) { depth = 1; continue; }
    if (depth === 0) continue;
    if (close) {
      if (name === 'svg' && skipDepth === 0) { depth = 0; continue; }
      if (skipDepth > 0) { skipDepth--; continue; }
      if (ELEMENTS.has(name)) inner += `</${name}>`;
      continue;
    }
    const self = selfClose === '/' || /\/\s*$/.test(attrSrc);
    if (skipDepth > 0 || !ELEMENTS.has(name) || name === 'svg') {
      if (!self) skipDepth++;
      continue;
    }
    const a = keepAttrs(parseAttrs(attrSrc.replace(/\/\s*$/, '')), true);
    inner += `<${name}${a.map(([n, v]) => ` ${n}="${esc(v)}"`).join('')}${self ? '/>' : '>'}`;
  }
  if (!inner) throw new Error(`Іконка ${label}: у файлі немає фігур`);
  return { viewBox, attrs, inner };
}
