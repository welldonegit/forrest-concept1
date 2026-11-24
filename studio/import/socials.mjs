/**
 * Соцмережі й контакти (решения человека 2026-11-24, схема футера — вторая редакция) → «Налаштування сайту»:
 *   - Контакти → Соцмережі: Instagram, Facebook, YouTube, TikTok, Telegram-канал — в этом порядке,
 *     иконки — SVG из import/icons/ в поле «Іконка». На сайте: первая колонка футера (без Telegram —
 *     он среди мессенджеров) и sameAs в JSON-LD (все пять);
 *   - Контакти → Месенджери → Telegram («написати менеджеру»): https://t.me/Forrestresort_com;
 *   - Футер → колонка «Контакти»: флаг «Колонка контактів» включён — колонка показывает телефон и мессенджеры
 *     из «Контактів»; прежние текстовые ссылки колонки (Telegram, Instagram, Телефон) убираются;
 *   - Меню: подпись «Соцмережі» убрана (ряда соцсетей в меню нет).
 * Адрес, который уже заполнен не заглушкой и отличается от нужного, не меняется — скрипт показывает его.
 * Одна транзакция; повторный запуск ничего не меняет.
 *
 * Запись в Sanity сразу пересобирает боевой сайт (main), поэтому два этапа:
 *   --stage safe  — до слияния кода (записан 2026-11-24): Telegram менеджера и флаг «Колонка контактів»
 *                   (старый код флаг не знает — сайт выглядит как раньше);
 *   --stage final — только после слияния и выкладки нового футера: список соцсетей (старый код вывел бы
 *                   их рядом иконок в меню), уборка прежних ссылок колонки и подписи «Соцмережі».
 *                   Перед записью скрипт открывает боевой сайт и проверяет, что футер уже новый
 *                   (в первой колонке нет телефона); старый — останавливается. --site <адрес> — другой сайт,
 *                   --skip-site-check — без проверки (только если уверены).
 *
 *   npm --prefix studio run -s sanity -- exec import/socials.mjs --with-user-token -- --stage safe|final [--dry]
 */
import { readFileSync } from 'node:fs';
import { getCliClient } from 'sanity/cli';

const dry = process.argv.includes('--dry');
const stage = process.argv[process.argv.indexOf('--stage') + 1];
if (!['safe', 'final'].includes(stage)) throw new Error('Вкажіть --stage safe або --stage final');
const final = stage === 'final';
const SOCIALS = [
  ['instagram', 'Instagram', 'https://www.instagram.com/forrest.resort/'],
  ['facebook', 'Facebook', 'https://www.facebook.com/forrestresort.ua/'],
  ['youtube', 'YouTube', 'https://www.youtube.com/@ForrestResortBukovel'],
  ['tiktok', 'TikTok', 'https://www.tiktok.com/@forrest.resort'],
  ['telegram', 'Telegram', 'https://t.me/Forrestresort_com'],
];
const MANAGER_TELEGRAM = 'https://t.me/Forrestresort_com';
const arg = (name) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined);

// final — только когда на боевом сайте новый футер: в первой колонке (до колонок ссылок) нет телефона
if (final && !process.argv.includes('--skip-site-check')) {
  const site = arg('--site') ?? 'https://forrestresort.com.ua/';
  const res = await fetch(site, { headers: { 'cache-control': 'no-cache' } });
  if (!res.ok) throw new Error(`${site}: відповідь ${res.status} — спробуйте ще раз за хвилину`);
  const html = await res.text();
  const footer = html.slice(html.indexOf('<footer'));
  const first = footer.slice(0, footer.indexOf('site-footer__group'));
  if (html.indexOf('<footer') < 0 || footer.indexOf('site-footer__group') < 0) throw new Error(`${site}: футер не знайдено — перевірте адресу (--site)`);
  if (/href="tel:/.test(first)) throw new Error(`${site}: на сайті ще старий футер (телефон у першій колонці). Спочатку злийте код і дочекайтеся збірки, потім запустіть --stage final.`);
  console.log(`${site}: новий футер на місці — продовжую.`);
}
const isStub = (url) => !url?.trim() || url.trim() === '#' || /^https?:\/\/(www\.)?[^/]+\/?$/i.test(url.trim());

const client = getCliClient({ apiVersion: '2025-02-19' }).withConfig({ perspective: 'raw' });
const docs = await client.fetch('*[_id in ["siteSettings", "drafts.siteSettings"]]');
const uploaded = {};
async function icon(network) {
  if (dry) return { _type: 'svgIcon', asset: { _type: 'reference', _ref: `(social-${network}.svg)` } };
  uploaded[network] ??= await client.assets.upload('file', readFileSync(new URL(`./icons/social-${network}.svg`, import.meta.url)), { filename: `social-${network}.svg`, contentType: 'image/svg+xml' });
  return { _type: 'svgIcon', asset: { _type: 'reference', _ref: uploaded[network]._id } };
}

const tx = client.transaction();
const log = [];
const kept = [];
for (const doc of docs) {
  const id = doc._id;
  const patch = client.patch(id).ifRevisionId(doc._rev);
  let changed = false;

  // Соцмережі: нужный порядок; существующий элемент сохраняется (его иконка и подпись), заглушка-адрес заменяется
  const current = doc.contacts?.socials ?? [];
  const next = [];
  for (const [network, label, url] of SOCIALS) {
    const have = current.find((s) => s.network === network);
    const item = have ? { ...have } : { _key: `so-${network}`, _type: 'socialLink', network, label, url };
    if (have && have.url !== url) {
      if (isStub(have.url)) item.url = url;
      else kept.push(`${id} Соцмережі · ${label}: «${have.url}» — заповнено в Studio, не змінено`);
    }
    if (!item.icon?.asset) item.icon = await icon(network);
    next.push(item);
  }
  const extra = current.filter((s) => !SOCIALS.some(([n]) => n === s.network));
  const all = [...next, ...extra];
  if (final && JSON.stringify(all.map((s) => [s.network, s.url, s.icon?.asset?._ref])) !== JSON.stringify(current.map((s) => [s.network, s.url, s.icon?.asset?._ref]))) {
    patch.set({ 'contacts.socials': all }); changed = true;
    log.push(`${id} Соцмережі: ${all.map((s) => s.label).join(', ')}`);
  }

  // Telegram менеджера
  const tg = doc.contacts?.messengers?.find((m) => m.network === 'telegram');
  if (tg && tg.url !== MANAGER_TELEGRAM) {
    if (isStub(tg.url)) { patch.set({ [`contacts.messengers[_key=="${tg._key}"].url`]: MANAGER_TELEGRAM }); changed = true; log.push(`${id} Месенджери · Telegram: «${tg.url}» → ${MANAGER_TELEGRAM}`); }
    else kept.push(`${id} Месенджери · Telegram: «${tg.url}» — заповнено в Studio, не змінено`);
  }

  // Футер: колонка с телефоном → колонка контактов
  const group = doc.footer?.groups?.find((g) => g.contacts || g.links?.some((l) => l.href?.startsWith('tel:')));
  if (!group) throw new Error(`${id}: у футері немає колонки контактів`);
  const base = `footer.groups[_key=="${group._key}"]`;
  if (!group.contacts) { patch.set({ [`${base}.contacts`]: true }); changed = true; log.push(`${id} Футер · колонка «${group.title?.[0]?.value}»: увімкнено «Колонка контактів»`); }
  if (final && group.links?.length) {
    patch.unset([`${base}.links`]); changed = true;
    log.push(`${id} Футер · колонка «${group.title?.[0]?.value}»: прибрано посилання ${group.links.map((l) => `«${l.label?.[0]?.value}» (${l.href})`).join(', ')}`);
  }

  // Меню: подпись «Соцмережі» больше не нужна
  const labels = (doc.menu?.texts ?? []).filter((t) => t.value?.socialsLabel !== undefined);
  if (final && labels.length) {
    patch.unset(labels.map((t) => `menu.texts[_key=="${t._key}"].value.socialsLabel`)); changed = true;
    log.push(`${id} Меню: прибрано підпис «Соцмережі» (${labels.map((t) => t.language).join(', ')})`);
  }
  if (changed) tx.patch(patch);
}
log.forEach((s) => console.log(`${dry ? '[перевірка] ' : ''}${s}`));
if (kept.length) { console.log('\nНе змінено:'); kept.forEach((s) => console.log(`  ! ${s}`)); }
if (!log.length) { console.log('Змін немає.'); process.exit(0); }
if (dry) process.exit(0);
const res = await tx.commit({ visibility: 'sync' });
console.log(`Готово: транзакція ${res.transactionId}.`);
