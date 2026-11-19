/**
 * Калькулятор дохода (блок Numbers): формулы как в выгрузке (calcRenderOne).
 * Один модуль для сборки (начальные значения в HTML) и для браузера (src/scripts/ui/numbers.js).
 *
 *   цена = площадь × цена за м²
 *   первый взнос = цена × % взноса;  ежемесячно = (цена − взнос) / срок (срок 0 → нет платежа)
 *   доход в год = цена × доходность / 100;  окупаемость = цена / доход;  год окупаемости = ⌈окупаемость⌉
 *   столбик года k (1…N) — накопленный доход k × доход, в долях от N × доход: k / N.
 */
export interface CalcInput {
  area: number;
  yieldPercent: number;
  pricePerM2: number;
  firstPercent: number;
  months: number;
}

export interface CalcResult {
  price: number;
  first: number;
  /** 0 — без рассрочки. */
  month: number;
  income: number;
  payback: number;
  breakEvenYear: number;
}

export function calc({ area, yieldPercent, pricePerM2, firstPercent, months }: CalcInput): CalcResult {
  const price = area * pricePerM2;
  const first = (price * firstPercent) / 100;
  const month = months ? (price - first) / months : 0;
  const income = (price * yieldPercent) / 100;
  const payback = income ? price / income : 0;
  return { price, first, month, income, payback, breakEvenYear: Math.ceil(payback) };
}

/** Число по правилам языка страницы: «132 750», «29,5» (uk) / «132,750», «29.5» (en). */
export function formatNumber(n: number, lang: string, decimals = 0): string {
  return new Intl.NumberFormat(lang, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n);
}

/** Подставляет число в шаблон из Sanity: «≈ {n} р.». */
export const fill = (template: string, value: string) => template.replace('{n}', value);
