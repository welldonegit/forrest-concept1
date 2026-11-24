/**
 * Соцмережі й контакти (решения человека 2026-11-24) → «Налаштування сайту»:
 *   - Контакти → Соцмережі: Facebook, Instagram, YouTube, TikTok, Telegram-канал — в этом порядке,
 *     иконки — SVG из import/icons/ в поле «Іконка» (иконки футера и sameAs в JSON-LD);
 *   - Контакти → Месенджери → Telegram («написати менеджеру»): https://t.me/Forrestresort_com;
 *   - Футер → колонка с телефоном («Контакти»): «Колонка контактів» включена, прежние текстовые ссылки
 *     (Telegram, Instagram, Телефон) убраны — колонка показывает иконки соцсетей и телефон из «Контактів»;
 *   - Меню: подпись «Соцмережі» убрана (ряда соцсетей в меню больше нет).
 * Адрес, который уже заполнен не заглушкой и отличается от нужного, не меняется — скрипт показывает его.
 * Одна транзакция; повторный запуск ничего не меняет.
 *
 * Запись в Sanity сразу пересобирает боевой сайт (main), поэтому два этапа:
 *   --stage safe  — до слияния кода: Telegram менеджера и флаг «Колонка контактів» (старый код его не знает:
 *                   ссылки колонки и подпись меню остаются, сайт выглядит как раньше);
 *   --stage final — после слияния и выкладки кода: список соцсетей (старый код вывел бы пять иконок в меню),
 *                   уборка прежних ссылок колонки и подписи «Соцмережі».
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
  ['facebook', 'Facebook', 'https://www.facebook.com/forrestresort.ua/'],
  ['instagram', 'Instagram', 'https://www.instagram.com/forrest.resort/'],
  ['youtube', 'YouTube', 'https://www.youtube.com/@ForrestResortBukovel'],
  ['tiktok', 'TikTok', 'https://www.tiktok.com/@forrest.resort'],
  ['telegram', 'Telegram', 'https://t.me/Forrestresort_com'],
];
const MANAGER_TELEGRAM = 'https://t.me/Forrestresort_com';
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
