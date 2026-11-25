/** Блок «Перший екран» (Hero): заголовок у два рядки, підзаголовок, кнопки, фото літо/зима. */
import { defineField, defineType } from 'sanity';
import { text, texts } from '../lib/i18n.ts';
import { blockGroups, hiddenField, languagesField, ukOf } from '../lib/block.ts';
import { linkField, photoField, str, num } from '../lib/fields.ts';

export const heroTitleLine = defineType({
  name: 'heroTitleLine', title: 'Рядок заголовка', type: 'object',
  fields: [text('text', { title: 'Текст рядка' })],
  preview: { select: { t: 'text' }, prepare: ({ t }) => ({ title: ukOf(t) }) },
});

export const hero = defineType({
  name: 'hero', title: 'Перший екран', type: 'object', groups: blockGroups,
  fields: [
    hiddenField,
    languagesField,
    defineField({
      name: 'title', title: 'Заголовок', type: 'array', of: [{ type: 'heroTitleLine' }], group: 'content',
      description: 'Два рядки: перший — темний ліворуч, другий — білий праворуч.',
      validation: (r) => r.required().length(2),
    }),
    texts('heroTexts', [
      defineField({ name: 'lead', title: 'Підзаголовок', type: 'text', rows: 3, description: 'Перенос рядка (Enter) — перенос на компʼютері; на телефоні текст іде суцільно.' }),
      defineField({ name: 'presentationLabel', title: 'Кнопка відео презентації', type: 'string' }),
    ], { group: 'content' }),
    linkField('cta', 'Головна кнопка', { group: 'content' }),
    str('presentationVideoUrl', 'Відео презентації', {
      group: 'content',
      description: 'Посилання на YouTube (youtube.com або youtu.be). Кнопка відео презентації відкриває його у вікні — так само, як відео в блоці «Дохідність 365 днів на рік». Порожньо — кнопка без дії.',
    }),
    defineField({
      name: 'season', title: 'Кнопка «лето / зима»', type: 'object', group: 'content',
      fields: [texts('heroSeasonTexts', [
        defineField({ name: 'prefix', title: 'Перший рядок', type: 'string', description: 'Наприклад «Подивитись».' }),
        defineField({ name: 'toWinter', title: 'Підпис «на зиму»', type: 'string' }),
        defineField({ name: 'toSummer', title: 'Підпис «на літо»', type: 'string' }),
      ])],
    }),
    photoField('imageWinter', 'Фото: зима (компʼютер)', { group: 'content', description: 'Показується першим. Завантажуйте оригінал.' }),
    photoField('imageSummer', 'Фото: літо (компʼютер)', { group: 'content' }),
    photoField('imageWinterMobile', 'Фото: зима (телефон)', { group: 'content', description: 'Вертикальний кадр для екранів до 768 px.' }),
    photoField('imageSummerMobile', 'Фото: літо (телефон)', { group: 'content' }),
    defineField({
      name: 'skyline', title: 'Контур будівель на фото', type: 'object', group: 'technical', readOnly: true,
      description: 'Точки контуру будівель на фото «літо (компʼютер)» — з-за нього виїжджає заголовок. Привʼязаний до цього фото: при заміні фото потрібен новий контур (розробник).',
      fields: [
        num('width', 'Ширина фото, px'),
        num('height', 'Висота фото, px'),
        defineField({ name: 'points', title: 'Точки', type: 'array', of: [{ type: 'skylinePoint' }] }),
      ],
    }),
  ],
  preview: {
    select: { hidden: 'hidden', t0: 'title.0.text', t1: 'title.1.text', media: 'imageWinter' },
    prepare: ({ hidden, t0, t1, media }) => ({ title: `Перший екран${hidden ? ' (приховано)' : ''}`, subtitle: [ukOf(t0), ukOf(t1)].filter(Boolean).join(' '), media }),
  },
});

export const skylinePoint = defineType({
  name: 'skylinePoint', title: 'Точка', type: 'object',
  fields: [num('x', 'x'), num('y', 'y')],
});
