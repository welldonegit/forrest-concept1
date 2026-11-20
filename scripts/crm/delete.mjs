/**
 * Удаляет тестовый лид, созданный npm run crm:check. Удаляет ТОЛЬКО лид с именем
 * «ТЕСТ сайт Forrest — не обробляти» и note «Заявка з лендінгу Forrest» — живые лиды не тронет.
 *
 *   CRM_TOKEN=… npm run crm:delete -- <id>
 */
import { api, must, TEST_NAME } from './lib.mjs';

const id = Number(process.argv[2]);
if (!Number.isInteger(id) || id <= 0) {
  console.error('Вкажіть ID ліда: CRM_TOKEN=… npm run crm:delete -- <id>');
  process.exit(2);
}
const lead = must(await api(`/api/v1/leads/${id}?fields=id,contact.name,note`), `лід ${id}`);
if (lead.contact?.name !== TEST_NAME || !lead.note?.startsWith('Заявка з лендінгу Forrest')) {
  console.error(`Лід ${id} — не тестовий (імʼя «${lead.contact?.name ?? '—'}»). Не видаляю.`);
  process.exit(1);
}
const r = await api(`/api/v1/leads/${id}`, { method: 'DELETE' });
if (r.status !== 204) {
  console.error(`Видалення: HTTP ${r.status}${r.status === 403 ? ' — у токена немає права видаляти ліди; видаліть вручну в CRM' : ''}`);
  process.exit(1);
}
console.log(`Тестовий лід ${id} видалено.`);
