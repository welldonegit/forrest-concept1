/** «Жовтень 2026» / «October 2026»: месяц в именительном падеже (standalone) и год, по правилам языка (Intl). */
export function monthOf(date: string, lang: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  const month = new Intl.DateTimeFormat(lang, { month: 'long', timeZone: 'UTC' }).format(d);
  const year = new Intl.DateTimeFormat(lang, { year: 'numeric', timeZone: 'UTC' }).formatToParts(d).find((p) => p.type === 'year')?.value;
  return `${month} ${year}`;
}
