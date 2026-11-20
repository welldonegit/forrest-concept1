/**
 * Проверка тела POST /api/v1/leads по docs/crm/api_schema.yaml без YAML-библиотеки:
 * разбираются только схемы компонентов (components/schemas/<Name>) — свойства, readOnly,
 * maxLength, pattern, enum по $ref, type. Для тестов и scripts/crm/check.mjs.
 */
import { readFileSync } from 'node:fs';

const yaml = readFileSync(new URL('../../docs/crm/api_schema.yaml', import.meta.url), 'utf8').split('\n');

/** Строки блока схемы `    <name>:` до следующей схемы того же уровня. */
function block(name) {
  const start = yaml.findIndex((l) => l === `    ${name}:`);
  if (start < 0) throw new Error(`нет схемы ${name}`);
  const out = [];
  for (let i = start + 1; i < yaml.length && !/^    \S/.test(yaml[i]) && !/^  \S/.test(yaml[i]); i++) out.push(yaml[i]);
  return out;
}

export function schemaEnum(name) {
  return block(name).filter((l) => /^      - /.test(l)).map((l) => l.replace(/^      - /, '').replace(/^'(.*)'$/, '$1'));
}

/** { prop: { type, readOnly, maxLength, pattern, enums: [..] | null, ref } } */
export function schemaProps(name) {
  const lines = block(name);
  const props = {};
  let cur = null;
  let inProps = false;
  for (const l of lines) {
    if (l === '      properties:') { inProps = true; continue; }
    if (/^      \S/.test(l)) { inProps = false; cur = null; continue; }
    if (!inProps) continue;
    const m = l.match(/^        ([a-z_]+):$/);
    if (m) { cur = props[m[1]] = { enums: null }; continue; }
    if (!cur) continue;
    const t = l.trim();
    if (t.startsWith('type:') && /^          type:/.test(l)) cur.type = t.slice(5).trim();
    else if (t === 'readOnly: true') cur.readOnly = true;
    else if (t.startsWith('maxLength:')) cur.maxLength = Number(t.slice(10));
    else if (t.startsWith('pattern:')) cur.pattern = new RegExp(t.slice(8).trim());
    else if (t.startsWith('- $ref:') || t.startsWith('$ref:')) {
      const ref = t.match(/schemas\/(\w+)/)?.[1];
      if (ref && ref.endsWith('Enum')) cur.enums = [...(cur.enums ?? []), ...schemaEnum(ref)];
      else if (ref) cur.ref = ref;
    }
  }
  return props;
}

/** Ошибки тела лида относительно схемы ([] — соответствует). */
export function validateLeadBody(body) {
  const errors = [];
  const check = (obj, schema, path) => {
    const props = schemaProps(schema);
    for (const [k, v] of Object.entries(obj)) {
      const p = props[k];
      const at = `${path}${k}`;
      if (!p) { errors.push(`${at}: нет в схеме ${schema}`); continue; }
      if (p.readOnly) errors.push(`${at}: только чтение`);
      if (v === undefined || v === null || v === '') errors.push(`${at}: пустое значение (пустые поля не передаём)`);
      if (p.type === 'string' && typeof v !== 'string') errors.push(`${at}: не строка`);
      if (p.type === 'array' && !Array.isArray(v)) errors.push(`${at}: не массив`);
      if (p.type === 'object' && (typeof v !== 'object' || Array.isArray(v))) errors.push(`${at}: не объект`);
      if (p.type === 'integer' && !Number.isInteger(v)) errors.push(`${at}: не целое`);
      if (typeof v === 'string') {
        if (p.maxLength && v.length > p.maxLength) errors.push(`${at}: длиннее ${p.maxLength}`);
        if (p.pattern && !p.pattern.test(v)) errors.push(`${at}: не по шаблону ${p.pattern}`);
        if (p.enums && !p.enums.includes(v)) errors.push(`${at}: «${v}» нет в списке`);
      }
      if (k === 'contact' && v && typeof v === 'object') check(v, 'Contact', `${at}.`);
      if (k === 'objects' && Array.isArray(v)) v.forEach((o, i) => check(o, 'Object', `${at}[${i}].`));
      if (k === 'phone_numbers' && Array.isArray(v) && v.some((x) => typeof x !== 'string')) errors.push(`${at}: не строки`);
    }
  };
  check(body, 'Lead', '');
  if (!body.contact?.name) errors.push('contact.name: обязательно');
  if (!body.added_at || Number.isNaN(Date.parse(body.added_at))) errors.push('added_at: обязательно, ISO 8601');
  return errors;
}
