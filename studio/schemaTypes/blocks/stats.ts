/** Блок «Цифри» (Stats): чотири картки з числом, підписом, плашкою і фото. */
import { defineField, defineType } from 'sanity';
import { texts } from '../lib/i18n.ts';
import { blockGroups, hiddenField, languagesField, ukOf } from '../lib/block.ts';

export const statsCard = defineType({
  name: 'statsCard',
  title: 'Картка',
  type: 'object',
  fields: [
    defineField({
      name: 'value',
      title: 'Число',
      type: 'string',
      description: 'Однакове для всіх мов, наприклад «460+» або «10».',
      validation: (rule) => rule.required(),
    }),
    texts('statsCardTexts', [
      defineField({ name: 'unit', title: 'Одиниця біля числа', type: 'string', description: 'Наприклад «років». Можна лишити порожнім.' }),
      defineField({ name: 'text', title: 'Підпис під числом', type: 'string' }),
      defineField({ name: 'chip', title: 'Плашка', type: 'string', description: 'Короткий текст на плашці внизу картки.' }),
    ], { optional: ['unit'] }),
    defineField({ name: 'image', title: 'Фото картки', type: 'photo', validation: (rule) => rule.required() }),
  ],
  preview: {
    select: { value: 'value', texts: 'texts', media: 'image' },
    prepare: ({ value, texts, media }) => ({
      title: [value, ukOf(texts, 'unit')].filter(Boolean).join(' '),
      subtitle: ukOf(texts, 'text'),
      media,
    }),
  },
});

export const stats = defineType({
  name: 'stats',
  title: 'Цифри',
  type: 'object',
  groups: blockGroups,
  fields: [
    hiddenField,
    languagesField,
    defineField({
      name: 'cards',
      title: 'Картки',
      type: 'array',
      of: [{ type: 'statsCard' }],
      description: 'Чотири картки під першим екраном. Порядок — як на сайті.',
      group: 'content',
      validation: (rule) => rule.required().length(4),
    }),
  ],
  preview: {
    select: { hidden: 'hidden', v0: 'cards.0.value', t0: 'cards.0.texts', media: 'cards.0.image' },
    prepare: ({ hidden, v0, t0, media }) => ({
      title: `Цифри${hidden ? ' (приховано)' : ''}`,
      subtitle: [v0, ukOf(t0, 'text')].filter(Boolean).join(' '),
      media,
    }),
  },
});
