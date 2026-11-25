/**
 * Источники заявки для события generate_lead (docs/LEADS.md, «Аналитика»): form в запросе /api/lead →
 * form_id и form_name события. Читают lead-api.js (перед переходом на «Дякуємо») и Base.astro
 * (запасной путь без sessionStorage: в адресе только form_id, form_name — отсюда).
 */
export const LEAD_FORMS = {
  finmodel: { id: 'finmodel', name: 'Форма «Фінмодель»' },
  final: { id: 'final_form', name: 'Фінальна форма' },
  quiz: { id: 'quiz', name: 'Квіз «Розрахунок доходу»' },
  apartment: { id: 'apartment_popup', name: 'Попап апартаменту' },
  world: { id: 'world_popup', name: 'Попап світу' },
} as const;

/** form_id → form_name. */
export const LEAD_FORM_NAMES: Record<string, string> = Object.fromEntries(Object.values(LEAD_FORMS).map((f) => [f.id, f.name]));
