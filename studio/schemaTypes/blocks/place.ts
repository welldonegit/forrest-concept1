/** Блоки «Локація» и «Інфраструктура». */
import { defineField, defineType } from 'sanity';
import { text, texts } from '../lib/i18n.ts';
import { anchorField, blockGroups, hiddenField, languagesField, ukOf } from '../lib/block.ts';
import { iconField, linkField, num, photoField, titleLinesField, titleLinesType } from '../lib/fields.ts';

export const locationTitleLine = titleLinesType('locationTitleLine', 'muted');
export const infraTitleLine = titleLinesType('infraTitleLine', 'mutedText');

const ICONS = [
  { title: 'Паркінг', value: 'parking' },
  { title: 'Їжа', value: 'food' },
  { title: 'Відпочинок', value: 'leisure' },
  { title: 'Готель', value: 'hotel' },
];

export const locationPin = defineType({
  name: 'locationPin', title: 'Мітка на карті', type: 'object',
  fields: [
    text('label', { title: 'Підпис мітки' }),
    defineField({ name: 'icon', title: 'Категорія', type: 'string', options: { list: ICONS, layout: 'radio', direction: 'horizontal' }, validation: (r) => r.required(), description: 'Іконки категорій — у блоці, вкладка «Іконки міток».' }),
    num('x', 'Положення по горизонталі, %', { required: true, description: 'Від лівого краю карти, 0–100.' }),
    num('y', 'Положення по вертикалі, %', { required: true, description: 'Від верхнього краю карти, 0–100.' }),
    defineField({ name: 'side', title: 'Підпис з боку', type: 'string', options: { list: [{ title: 'Ліворуч', value: 'left' }, { title: 'Праворуч', value: 'right' }], layout: 'radio', direction: 'horizontal' }, validation: (r) => r.required() }),
  ],
  preview: { select: { l: 'label', icon: 'icon' }, prepare: ({ l, icon }) => ({ title: ukOf(l), subtitle: ICONS.find((i) => i.value === icon)?.title }) },
});

export const locationFact = defineType({
  name: 'locationFact', title: 'Факт', type: 'object',
  fields: [texts('locationFactTexts', [
    defineField({ name: 'value', title: 'Число', type: 'string' }),
    defineField({ name: 'label', title: 'Підпис', type: 'string' }),
  ])],
  preview: { select: { g: 'texts' }, prepare: ({ g }) => ({ title: ukOf(g, 'value'), subtitle: ukOf(g, 'label') }) },
});

export const locationChip = defineType({
  name: 'locationChip', title: 'Плашка', type: 'object',
  fields: [text('text', { title: 'Текст' })],
  preview: { select: { t: 'text' }, prepare: ({ t }) => ({ title: ukOf(t) }) },
});

export const location = defineType({
  name: 'location', title: 'Локація', type: 'object',
  groups: [...blockGroups.slice(0, 1), { name: 'icons', title: 'Іконки міток' }, blockGroups[1]],
  fields: [
    hiddenField,
    languagesField,
    anchorField('lokatsiya-google'),
    titleLinesField('locationTitleLine'),
    text('text', { title: 'Опис під заголовком', description: 'Перенос рядка (Enter) — новий рядок на сайті.', multiline: true, group: 'content' }),
    linkField('mapLink', 'Посилання на Google-карту', { group: 'content' }),
    photoField('map', 'Карта', { group: 'content', description: 'Ілюстрація карти. Положення міток рахуються у відсотках від її розміру.' }),
    defineField({ name: 'pins', title: 'Мітки', type: 'array', of: [{ type: 'locationPin' }], group: 'content' }),
    defineField({
      name: 'resort', title: 'Мітка курорту і картка', type: 'object', group: 'content',
      fields: [
        num('x', 'Положення по горизонталі, %', { required: true }),
        num('y', 'Положення по вертикалі, %', { required: true }),
        defineField({
          name: 'card', title: 'Картка при наведенні', type: 'object',
          fields: [
            texts('locationCardTexts', [
              defineField({ name: 'badge', title: 'Плашка над назвою', type: 'string' }),
              defineField({ name: 'title', title: 'Назва', type: 'string' }),
              defineField({ name: 'subtitle', title: 'Підзаголовок', type: 'string' }),
            ]),
            photoField('image', 'Фото'),
            defineField({ name: 'facts', title: 'Факти', type: 'array', of: [{ type: 'locationFact' }] }),
            defineField({ name: 'chips', title: 'Плашки', type: 'array', of: [{ type: 'locationChip' }] }),
          ],
        }),
        text('label', { title: 'Підпис мітки курорту' }),
      ],
    }),
    defineField({
      name: 'icons', title: 'Іконки категорій міток', type: 'object', group: 'icons',
      description: 'Порожнє поле — стандартна іконка.',
      fields: ICONS.map((i) => iconField(i.value, i.title)),
    }),
  ],
  preview: {
    select: { hidden: 'hidden', t: 'title.0.text', media: 'map' },
    prepare: ({ hidden, t, media }) => ({ title: `Локація${hidden ? ' (приховано)' : ''}`, subtitle: ukOf(t), media }),
  },
});

export const infraItem = defineType({
  name: 'infraItem', title: 'Картка', type: 'object',
  fields: [
    texts('infraItemTexts', [
      defineField({ name: 'title', title: 'Заголовок', type: 'string' }),
      defineField({ name: 'lead', title: 'Рядок під заголовком', type: 'string' }),
      defineField({ name: 'text', title: 'Подробиці', type: 'text', rows: 3, description: 'Плашка при наведенні або за кнопкою «i».' }),
    ]),
    photoField('image', 'Фото'),
  ],
  preview: { select: { g: 'texts', media: 'image' }, prepare: ({ g, media }) => ({ title: ukOf(g, 'title'), subtitle: ukOf(g, 'lead'), media }) },
});

export const infrastructure = defineType({
  name: 'infrastructure', title: 'Інфраструктура', type: 'object', groups: blockGroups,
  fields: [
    hiddenField,
    languagesField,
    anchorField('infrastruktura'),
    titleLinesField('infraTitleLine'),
    text('moreLabel', { title: 'Кнопка «i» (для програм читання з екрана)', group: 'content' }),
    defineField({ name: 'items', title: 'Картки', type: 'array', of: [{ type: 'infraItem' }], group: 'content', description: 'Номер (01, 02…) ставиться за порядком.' }),
  ],
  preview: {
    select: { hidden: 'hidden', g: 'title.0.texts', media: 'items.0.image' },
    prepare: ({ hidden, g, media }) => ({ title: `Інфраструктура${hidden ? ' (приховано)' : ''}`, subtitle: ukOf(g, 'text'), media }),
  },
});
