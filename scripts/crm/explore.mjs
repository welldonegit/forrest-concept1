/**
 * Разведка G-PLUS CRM: кто владелец токена, воронки и этапы, источники, кастомные поля лида,
 * здания. Ничего не меняет. Показывает, есть ли в CRM значения из wrangler.jsonc.
 *
 *   CRM_TOKEN=… npm run crm:explore
 */
import { api, must, settings } from './lib.mjs';

const cfg = settings();
const mark = (ok) => (ok ? '✓' : '✗');

const me = await api('/api/v1/user');
if (me.status === 200) console.log(`Токен: ${me.json?.name ?? '—'} (id ${me.json?.id}) — має бути технічний користувач «Сайт», не менеджер\n`);
else console.log(`Токен: /api/v1/user → HTTP ${me.status}\n`);

console.log('== Воронки й етапи (CRM_STAGE_ID — id етапу) ==');
const pipelines = must(await api('/api/v1/pipelines'), 'pipelines');
let stageFound = false;
for (const p of pipelines) {
  console.log(`${p.is_default ? '★' : ' '} ${p.title}  [воронка ${p.id}]`);
  for (const s of p.stages) {
    const here = s.id === cfg.CRM_STAGE_ID;
    stageFound ||= here;
    console.log(`     ${here ? '→' : ' '} ${s.id}  ${s.title}${s.type ? `  (${s.type})` : ''}${s.is_hidden ? '  приховано' : ''}`);
  }
}

console.log('\n== Джерела (CRM_SOURCE — ключ) ==');
const sources = must(await api('/api/v1/lead_sources'), 'lead_sources');
let sourceFound = false;
for (const item of Array.isArray(sources) ? sources : []) {
  for (const [key, title] of Object.entries(item)) {
    sourceFound ||= key === cfg.CRM_SOURCE;
    console.log(`  ${key === cfg.CRM_SOURCE ? '→' : ' '} ${key}  ${title}`);
  }
}

console.log('\n== Кастомні поля ліда (запасний варіант для UTM — CRM_UTM_FIELDS) ==');
const custom = must(await api('/api/v1/custom_fields?object=lead'), 'custom_fields');
const fields = custom.lead_custom_fields ?? [];
if (!fields.length) console.log('  немає');
for (const f of fields) {
  console.log(`  ${f.id}  ${f.name}  (${f.type}${f.required ? ', ОБОВʼЯЗКОВЕ' : ''})${f.options?.length ? `  варіанти: ${f.options.join(' | ')}` : ''}`);
}
const required = fields.filter((f) => f.required);
if (required.length) console.log(`  ! Обовʼязкові поля (${required.map((f) => f.name).join(', ')}): сайт їх не заповнює — створення ліда може не пройти. Перевірте npm run crm:check.`);

console.log('\n== Будинки (CRM_BUILDING_ID — id; потрібне право buildings.read) ==');
const b = await api('/api/v1/buildings?fields=id,title');
let buildingFound = false;
if (b.status === 200) {
  for (const x of b.json ?? []) {
    buildingFound ||= String(x.id) === cfg.CRM_BUILDING_ID;
    console.log(`  ${String(x.id) === cfg.CRM_BUILDING_ID ? '→' : ' '} ${x.id}  ${x.title}`);
  }
} else console.log(`  HTTP ${b.status}${b.status === 403 ? ' — у токена немає права buildings.read' : ''}`);

console.log('\n== Налаштування в wrangler.jsonc ==');
console.log(`  CRM_SOURCE      = ${cfg.CRM_SOURCE || '(порожньо — джерело не передається)'}  ${cfg.CRM_SOURCE ? mark(sourceFound) : ''}`);
console.log(`  CRM_STAGE_ID    = ${cfg.CRM_STAGE_ID || '(порожньо — етап за замовчуванням CRM)'}  ${cfg.CRM_STAGE_ID ? mark(stageFound) : ''}`);
console.log(`  CRM_BUILDING_ID = ${cfg.CRM_BUILDING_ID || '(порожньо — обʼєкт не передається)'}  ${cfg.CRM_BUILDING_ID ? mark(buildingFound) : ''}`);
console.log(`  CRM_UTM_FIELDS  = ${cfg.CRM_UTM_FIELDS || '(порожньо)'}`);
