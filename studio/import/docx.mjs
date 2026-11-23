/**
 * Чтение .docx без зависимостей: zip (центральный каталог + inflate), абзацы, списки.
 * Общий для import/legal-documents.mjs (документы сайта) и import/construction-reports.mjs (хід будівництва).
 */
import { inflateRawSync } from 'node:zlib';

/** Файлы из zip (docx) — без зависимостей: центральный каталог + inflate. */
export function unzip(buf) {
  const files = new Map();
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error('не zip');
  let p = buf.readUInt32LE(eocd + 16);
  const count = buf.readUInt16LE(eocd + 10);
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(start, start + size);
    files.set(name, method === 0 ? data : method === 8 ? inflateRawSync(data) : null);
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

export const decodeXml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

/** Части XML: <w:p>, <w:tbl> верхнего уровня тела документа. Пустой самозакрытый <w:p …/> — тоже часть. */
export function topLevel(xml, tags) {
  const out = [];
  const re = new RegExp(`<w:(${tags.join('|')})(?:\\s[^>]*)?>`, 'g');
  let m;
  while ((m = re.exec(xml))) {
    const tag = m[1];
    let end;
    if (m[0].endsWith('/>')) end = re.lastIndex;
    else {
      let depth = 0;
      const open = new RegExp(`<w:${tag}(?:\\s[^>]*)?>|</w:${tag}>`, 'g');
      open.lastIndex = m.index;
      let t;
      while ((t = open.exec(xml))) {
        if (t[0].endsWith('/>')) continue;
        depth += t[0].startsWith('</') ? -1 : 1;
        if (depth === 0) { end = open.lastIndex; break; }
      }
      if (end === undefined) throw new Error(`docx: незакрытый <w:${tag}>`);
    }
    out.push({ tag, xml: xml.slice(m.index, end) });
    re.lastIndex = end;
  }
  return out;
}

/** Абзац docx → { style, list, text с **жирным** } . */
export function paragraph(xml, numFmt) {
  if (/<w:drawing|<w:pict/.test(xml)) throw new Error('в абзаце картинка — нужен текст (расшифровка в import/legal/)');
  const style = xml.match(/<w:pStyle w:val="([^"]+)"/)?.[1] ?? '';
  const numId = xml.match(/<w:numPr>[\s\S]*?<w:numId w:val="(\d+)"/)?.[1];
  let text = '';
  for (const r of xml.match(/<w:r[ >][\s\S]*?<\/w:r>/g) ?? []) {
    const bold = /<w:b(?: w:val="(?:1|true)")?\/>/.test(r);
    const t = (r.match(/<w:t(?: [^>]*)?>[\s\S]*?<\/w:t>|<w:tab\/>|<w:br\/>/g) ?? [])
      .map((x) => (x.startsWith('<w:t>') || x.startsWith('<w:t ') ? decodeXml(x.replace(/<[^>]+>/g, '')) : ' ')).join('');
    if (!t) continue;
    text += bold && t.trim() ? `**${t}**` : t;
  }
  text = text.replace(/\*\*\*\*/g, '').replace(/\s+/g, ' ').trim();
  const level = style.match(/^Heading([1-3])$/)?.[1];
  return {
    style: level ? (level === '3' ? 'h3' : 'h2') : 'normal',
    list: numId ? (numFmt.get(numId) === 'bullet' ? 'bullet' : 'number') : undefined,
    text,
  };
}

/** Тип списка: numId → abstractNumId → формат первого уровня (bullet, decimal…). */
export function numberingFormats(zip) {
  const numbering = zip.get('word/numbering.xml')?.toString('utf8') ?? '';
  const abstractFmt = new Map([...numbering.matchAll(/<w:abstractNum [^>]*w:abstractNumId="(\d+)"[\s\S]*?<w:numFmt w:val="([^"]+)"/g)].map((m) => [m[1], m[2]]));
  return new Map([...numbering.matchAll(/<w:num w:numId="(\d+)"[^>]*>[\s\S]*?<w:abstractNumId w:val="(\d+)"/g)].map((m) => [m[1], abstractFmt.get(m[2])]));
}
