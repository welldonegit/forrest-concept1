/**
 * Блоки «Переваги інвестування в Україну», «Фото між блоками», «Буковель. Попит упродовж року»
 * (выгрузка 2026-11-25: design-export/updates/2026-11-25/ukraine-bukovel/). На старте — только на en
 * (поле «Мови, на яких показувати блок»).
 */
import { defineField, defineType } from 'sanity';
import { texts } from '../lib/i18n.ts';
import { anchorField, blockGroups, hiddenField, languagesField, ukOf } from '../lib/block.ts';
import { bool, photoField, str, titleLinesField, titleLinesType } from '../lib/fields.ts';

export const whyTitleLine = titleLinesType('whyTitleLine', 'muted');

const leadTexts = (name: string) =>
  texts(name, [defineField({ name: 'lead', title: 'Абзац праворуч від заголовка', type: 'text', rows: 4 })], { group: 'content' });

const languagesNote = (languages?: string[]) => (languages?.length ? ` · лише ${languages.join(', ')}` : '');

export const whyUkraineCard = defineType({
  name: 'whyUkraineCard', title: 'Картка', type: 'object',
  fields: [
    str('value', 'Число', { description: 'Велике число, наприклад «$588» або «40%». Однакове для всіх мов. Для картки із зірками ЄС — порожньо.' }),
    texts('whyUkraineCardTexts', [
      defineField({ name: 'prefix', title: 'Перед числом (сірим)', type: 'string', description: 'Наприклад «до». Можна лишити порожнім.' }),
      defineField({ name: 'unit', title: 'Після числа (сірим)', type: 'string', description: 'Наприклад «млрд». Можна лишити порожнім.' }),
      defineField({ name: 'title', title: 'Заголовок картки', type: 'string' }),
      defineField({ name: 'text', title: 'Текст', type: 'text', rows: 3 }),
    ], { optional: ['prefix', 'unit'] }),
    defineField({
      name: 'visual', title: 'Що показати під числом', type: 'string', initialValue: 'none',
      options: { list: [{ title: 'Нічого', value: 'none' }, { title: 'Смужка заповнення', value: 'bar' }, { title: 'Зірки ЄС (замість числа)', value: 'stars' }], layout: 'radio' },
    }),
    defineField({
      name: 'barPercent', title: 'Заповнення смужки, %', type: 'number', description: 'Від 0 до 100.',
      hidden: ({ parent }) => parent?.visual !== 'bar', validation: (r) => r.min(0).max(100),
    }),
    bool('dark', 'Темна картка', { description: 'Темно-зелений фон і білий текст, як третя картка в макеті.' }),
  ],
  preview: {
    select: { v: 'value', g: 'texts', dark: 'dark' },
    prepare: ({ v, g, dark }) => ({ title: [ukOf(g, 'prefix'), v, ukOf(g, 'unit')].filter(Boolean).join(' ') || ukOf(g, 'title'), subtitle: `${ukOf(g, 'title') ?? ''}${dark ? ' · темна' : ''}` }),
  },
});

export const whyUkraine = defineType({
  name: 'whyUkraine', title: 'Переваги інвестування в Україну', type: 'object', groups: blockGroups,
  fields: [
    hiddenField,
    languagesField,
    anchorField('chomu-ukraina'),
    titleLinesField('whyTitleLine', { description: 'Кожен рядок — окремо; «Сірим кольором» — приглушений рядок, як у макеті.' }),
    leadTexts('whyUkraineTexts'),
    defineField({ name: 'cards', title: 'Картки', type: 'array', of: [{ type: 'whyUkraineCard' }], group: 'content', description: 'Номер (01, 02…) ставиться за порядком. У макеті — три.', validation: (r) => r.required().min(1) }),
  ],
  preview: {
    select: { hidden: 'hidden', languages: 'languages', t: 'title.0.text', t1: 'title.1.text' },
    prepare: ({ hidden, languages, t, t1 }) => ({ title: `Переваги інвестування в Україну${hidden ? ' (приховано)' : ''}${languagesNote(languages)}`, subtitle: [ukOf(t), ukOf(t1)].filter(Boolean).join(' ') }),
  },
});

export const photoBand = defineType({
  name: 'photoBand', title: 'Фото між блоками', type: 'object', groups: blockGroups,
  fields: [
    hiddenField,
    languagesField,
    photoField('image', 'Фото', { group: 'content', description: 'На всю ширину; верх і низ плавно розчиняються у фоні сторінки. Завантажуйте оригінал — сайт сам готує розміри.' }),
  ],
  preview: {
    select: { hidden: 'hidden', languages: 'languages', media: 'image' },
    prepare: ({ hidden, languages, media }) => ({ title: `Фото між блоками${hidden ? ' (приховано)' : ''}${languagesNote(languages)}`, media }),
  },
});

export const whyBukovelRow = defineType({
  name: 'whyBukovelRow', title: 'Рядок з числом', type: 'object',
  fields: [
    str('value', 'Число', { required: true, description: 'Наприклад «≈3», «186», «7». Однакове для всіх мов.' }),
    texts('whyBukovelRowTexts', [
      defineField({ name: 'unit', title: 'Після числа (сірим)', type: 'string', description: 'Наприклад «млн», «тис.», «хв».' }),
      defineField({ name: 'title', title: 'Заголовок', type: 'string' }),
      defineField({ name: 'text', title: 'Текст', type: 'text', rows: 3 }),
    ], { optional: ['unit'] }),
  ],
  preview: { select: { v: 'value', g: 'texts' }, prepare: ({ v, g }) => ({ title: [v, ukOf(g, 'unit')].filter(Boolean).join(' '), subtitle: ukOf(g, 'title') }) },
});

export const whyBukovel = defineType({
  name: 'whyBukovel', title: 'Буковель. Попит упродовж року', type: 'object', groups: blockGroups,
  fields: [
    hiddenField,
    languagesField,
    anchorField('chomu-bukovel'),
    titleLinesField('whyTitleLine', { description: 'Кожен рядок — окремо; «Сірим кольором» — приглушений рядок, як у макеті.' }),
    leadTexts('whyBukovelTexts'),
    defineField({ name: 'rows', title: 'Рядки з числами', type: 'array', of: [{ type: 'whyBukovelRow' }], group: 'content', validation: (r) => r.required().min(1) }),
  ],
  preview: {
    select: { hidden: 'hidden', languages: 'languages', t: 'title.0.text', t1: 'title.1.text' },
    prepare: ({ hidden, languages, t, t1 }) => ({ title: `Буковель. Попит упродовж року${hidden ? ' (приховано)' : ''}${languagesNote(languages)}`, subtitle: [ukOf(t), ukOf(t1)].filter(Boolean).join(' ') }),
  },
});

