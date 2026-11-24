/**
 * Соцмережі (решение человека 2026-11-24) → «Налаштування сайту»: Контакти → Соцмережі (ряд иконок в меню,
 * sameAs в JSON-LD) и колонка «Контакти» футера (текстовые ссылки).
 *   --stage stubs — только заглушки: Instagram в «Соцмережах» (https://instagram.com/), Telegram и Instagram
 *                   в футере («#») → настоящие адреса. Вид сайта не меняется.
 *   --stage new   — добавить канал Telegram, Facebook, YouTube, TikTok в «Соцмережі» (иконки — SVG
 *                   из import/icons/, то же поле «Іконка») и Facebook, YouTube, TikTok в футер перед «Телефон».
 * Мессенджеры («написати менеджеру») не трогает. Ссылку меняет, только если там всё ещё заглушка;
 * уже добавленную сеть не дублирует. Одна транзакция.
 *
 *   npm --prefix studio run -s sanity -- exec import/socials.mjs --with-user-token -- --stage stubs|new [--dry]
 */
import { readFileSync } from 'node:fs';
import { getCliClient } from 'sanity/cli';

const args = process.argv.slice(2);
const stage = args[args.indexOf('--stage') + 1];
const dry = args.includes('--dry');
if (!['stubs', 'new'].includes(stage)) throw new Error('Вкажіть --stage stubs або --stage new');

const URLS = {
  telegram: 'https://t.me/Forrestresort_com',
  instagram: 'https://www.instagram.com/forrest.resort/',
  facebook: 'https://www.facebook.com/forrestresort.ua/',
  youtube: 'https://www.youtube.com/@ForrestResortBukovel',
  tiktok: 'https://www.tiktok.com/@forrest.resort',
};
const NAMES = { telegram: 'Telegram', instagram: 'Instagram', facebook: 'Facebook', youtube: 'YouTube', tiktok: 'TikTok' };
const STUBS = new Set(['#', '', 'https://t.me/', 'https://instagram.com/', 'https://www.instagram.com/']);
/** Порядок в ряду «Соцмережі»: Instagram уже есть (из выгрузки), новые — за ним. */
const NEW_SOCIALS = ['telegram', 'facebook', 'youtube', 'tiktok'];
const NEW_FOOTER = ['facebook', 'youtube', 'tiktok'];

const client = getCliClient({ apiVersion: '2025-02-19' }).withConfig({ perspective: 'raw' });
const docs = (await client.fetch('*[_id in ["siteSettings", "drafts.siteSettings"]]')).filter(Boolean);
const label = (name) => ['uk', 'en'].map((language) => ({ _key: language, _type: 'internationalizedArrayStringValue', language, value: name }));
const footerGroup = (doc) => doc.footer?.groups?.find((g) => g.links?.some((l) => l.href?.startsWith('tel:')));
const footerLink = (g, name) => g.links.find((l) => l.label?.some((x) => x.value?.trim().toLowerCase() === name.toLowerCase()));

const icons = {};
async function icon(network) {
  if (dry) return { _type: 'svgIcon', asset: { _type: 'reference', _ref: `(файл social-${network}.svg)` } };
  icons[network] ??= await client.assets.upload('file', readFileSync(new URL(`./icons/social-${network}.svg`, import.meta.url)), { filename: `social-${network}.svg`, contentType: 'image/svg+xml' });
  return { _type: 'svgIcon', asset: { _type: 'reference', _ref: icons[network]._id } };
}

const tx = client.transaction();
const log = [];
for (const doc of docs) {
  const set = {};
  const patch = client.patch(doc._id).ifRevisionId(doc._rev);
  let changed = false;
  const socials = doc.contacts?.socials ?? [];
  const group = footerGroup(doc);
  if (!group) throw new Error(`${doc._id}: у футері немає колонки з телефоном («Контакти»)`);

  if (stage === 'stubs') {
    for (const s of socials) {
      if (URLS[s.network] && STUBS.has(s.url?.trim() ?? '')) { set[`contacts.socials[_key=="${s._key}"].url`] = URLS[s.network]; log.push(`${doc._id} Соцмережі · ${s.label}: «${s.url}» → ${URLS[s.network]}`); }
    }
    for (const name of ['telegram', 'instagram']) {
      const link = footerLink(group, NAMES[name]);
      if (link && STUBS.has(link.href?.trim() ?? '')) { set[`footer.groups[_key=="${group._key}"].links[_key=="${link._key}"].href`] = URLS[name]; log.push(`${doc._id} Футер · ${NAMES[name]}: «${link.href}» → ${URLS[name]}`); }
    }
  } else {
    const add = [];
    for (const network of NEW_SOCIALS) {
      if (socials.some((s) => s.network === network)) continue;
      add.push({ _key: `so-${network}`, _type: 'socialLink', network, label: NAMES[network], url: URLS[network], icon: await icon(network) });
      log.push(`${doc._id} Соцмережі + ${NAMES[network]} ${URLS[network]}`);
    }
    if (add.length) { patch.setIfMissing({ 'contacts.socials': [] }).insert('after', 'contacts.socials[-1]', add); changed = true; }
    const phone = group.links.find((l) => l.href?.startsWith('tel:'));
    const links = NEW_FOOTER.filter((n) => !footerLink(group, NAMES[n])).map((n) => ({ _key: `l-${n}`, _type: 'navLink', href: URLS[n], label: label(NAMES[n]) }));
    if (links.length) {
      patch.insert('before', `footer.groups[_key=="${group._key}"].links[_key=="${phone._key}"]`, links); changed = true;
      log.push(`${doc._id} Футер + ${links.map((l) => l.label[0].value).join(', ')} (перед «Телефон»)`);
    }
  }
  if (Object.keys(set).length) { patch.set(set); changed = true; }
  if (changed) tx.patch(patch);
}
log.forEach((s) => console.log(`${dry ? '[перевірка] ' : ''}${s}`));
if (!log.length) { console.log('Змін немає.'); process.exit(0); }
if (dry) process.exit(0);
const res = await tx.commit({ visibility: 'sync' });
console.log(`Готово: транзакція ${res.transactionId}.`);
