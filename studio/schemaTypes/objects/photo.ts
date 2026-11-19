/**
 * Фото: точка фокуса (hotspot), переключатель «Декоративне фото» и переводимый опис (alt).
 * Декоративне — alt не потрібен і на сайті порожній; інакше — обовʼязковий українською (CLAUDE.md).
 * На сайт іде оригінал файлу без перетискання; обрізка (crop) на сайті не застосовується,
 * враховується тільки точка фокуса.
 */
import { defineField, defineType } from 'sanity';

type I18nItem = { _key: string; language?: string; value?: string };

export const photo = defineType({
  name: 'photo',
  title: 'Фото',
  type: 'image',
  options: { hotspot: true },
  description: 'Завантажуйте оригінал без стиснення. Сайт сам готує розміри. Точка фокуса — що лишається в кадрі при обрізанні на різних екранах.',
  fields: [
    defineField({
      name: 'decorative',
      title: 'Декоративне фото',
      type: 'boolean',
      description: 'Увімкніть, якщо фото лише прикраса і нічого не повідомляє. Тоді опис не потрібен.',
      initialValue: false,
    }),
    defineField({
      name: 'alt',
      title: 'Опис фото',
      type: 'internationalizedArrayString',
      description: 'Що зображено — для незрячих відвідувачів і пошуковиків. Українською обовʼязково.',
      hidden: ({ parent }) => Boolean((parent as { decorative?: boolean } | undefined)?.decorative),
      validation: (rule) =>
        rule.custom((items: I18nItem[] | undefined, context) => {
          if ((context.parent as { decorative?: boolean } | undefined)?.decorative) return true;
          const uk = items?.find((it) => (it.language ?? it._key) === 'uk');
          return uk?.value?.trim() ? true : 'Опишіть фото українською або увімкніть «Декоративне фото»';
        }),
    }),
  ],
});
