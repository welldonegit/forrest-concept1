/**
 * Сравнение «надіслано → в CRM» для npm run crm:check.
 * - Объекты — без учёта порядка ключей (CRM возвращает data.utm в своём порядке).
 * - Телефоны — только цифры: CRM хранит номер в своём виде (пробелы, скобки, без «+»)
 *   и может вернуть его строкой или объектом; цифры собираются из любого вида.
 */
const canon = (v) => {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])]));
  return v ?? null;
};
export const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

/** Все строки-телефоны из ответа CRM (строки, числа, объекты любых ключей) → только цифры. */
export function phoneDigits(value) {
  if (value == null) return [];
  if (typeof value === 'string' || typeof value === 'number') {
    const d = String(value).replace(/\D/g, '');
    return d ? [d] : [];
  }
  if (Array.isArray(value)) return value.flatMap(phoneDigits);
  if (typeof value === 'object') return Object.values(value).flatMap(phoneDigits);
  return [];
}
export const hasPhone = (back, phone) => phoneDigits(back).includes(String(phone).replace(/\D/g, ''));
