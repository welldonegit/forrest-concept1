/** Блоки «Хід будівництва» (налаштування блоку; звіти — окремі документи), «Команда», «Питання та відповіді». */
import { defineField, defineType } from 'sanity';
import { text, texts } from '../lib/i18n.ts';
import { anchorField, blockGroups, hiddenField, languagesField, ukOf } from '../lib/block.ts';
import { linkField, num, photoField, str, titleLinesField, titleLinesType } from '../lib/fields.ts';

const S = (name: string, title: string, description?: string) => defineField({ name, title, type: 'string', description });

export const construction = defineType({
  name: 'construction', title: 'Хід будівництва', type: 'object', groups: blockGroups,
  description: 'Самі звіти — у розділі «Хід будівництва» меню. Тут — заголовок і скільки останніх звітів показувати.',
  fields: [
    hiddenField,
    languagesField,
    anchorField('budivnytstvo'),
    texts('constructionTexts', [
      S('title', 'Заголовок'),
      S('rowPrevLabel', 'Стрілка «попередні звіти» (для програм читання з екрана)'),
      S('rowNextLabel', 'Стрілка «наступні звіти» (для програм читання з екрана)'),
      S('photoPrevLabel', 'Стрілка «попереднє фото» (для програм читання з екрана)'),
      S('photoNextLabel', 'Стрілка «наступне фото» (для програм читання з екрана)'),
      S('videoLabel', 'Кнопка відео', 'Наприклад «Drone-video».'),
      S('videoAriaLabel', 'Кнопка відео (для програм читання з екрана)'),
    ], { group: 'content' }),
    num('maxItems', 'Скільки останніх звітів показувати', { group: 'content', required: true }),
    num('maxAgeDays', 'Не старші ніж, днів', { group: 'content', required: true, description: 'Старіші звіти лишаються тільки в архіві.' }),
    defineField({
      name: 'archive', title: 'Картка «Всі» (архів)', type: 'object', group: 'content',
      fields: [texts('constructionArchiveTexts', [S('title', 'Заголовок'), S('text', 'Текст'), S('ariaLabel', 'Опис посилання (для програм читання з екрана)')])],
    }),
  ],
  preview: {
    select: { hidden: 'hidden', g: 'texts' },
    prepare: ({ hidden, g }) => ({ title: `Хід будівництва${hidden ? ' (приховано)' : ''}`, subtitle: ukOf(g, 'title') }),
  },
});

export const teamStat = defineType({
  name: 'teamStat', title: 'Показник', type: 'object',
  fields: [texts('teamStatTexts', [S('value', 'Число', 'Можна лишити порожнім.'), S('label', 'Підпис')], { optional: ['value'] })],
  preview: { select: { g: 'texts' }, prepare: ({ g }) => ({ title: [ukOf(g, 'value'), ukOf(g, 'label')].filter(Boolean).join(' ') }) },
});

export const teamMember = defineType({
  name: 'teamMember', title: 'Учасник', type: 'object',
  fields: [
    str('company', 'Компанія', { required: true, description: 'Назва — однакова для всіх мов.' }),
    texts('teamMemberTexts', [S('role', 'Роль', 'Підпис на вкладці і заголовок панелі.'), defineField({ name: 'text', title: 'Текст', type: 'text', rows: 4 })]),
    photoField('logo', 'Логотип', { description: 'SVG або PNG. Опис — назва компанії.' }),
    photoField('photo', 'Фото'),
    defineField({ name: 'stats', title: 'Показники', type: 'array', of: [{ type: 'teamStat' }] }),
    defineField({
      name: 'quote', title: 'Цитата', type: 'object',
      fields: [
        texts('teamQuoteTexts', [
          defineField({ name: 'text', title: 'Текст цитати', type: 'text', rows: 3 }),
          S('name', 'Імʼя', 'TODO: написання англійською — як пишуть самі люди.'),
          S('position', 'Посада'),
        ]),
        photoField('photo', 'Фото автора'),
      ],
    }),
  ],
  preview: { select: { c: 'company', g: 'texts', media: 'logo' }, prepare: ({ c, g, media }) => ({ title: ukOf(g, 'role'), subtitle: c, media }) },
});

export const team = defineType({
  name: 'team', title: 'Команда', type: 'object', groups: blockGroups,
  fields: [
    hiddenField,
    languagesField,
    anchorField('komanda'),
    texts('teamTexts', [S('title', 'Заголовок'), defineField({ name: 'subtitle', title: 'Підзаголовок', type: 'text', rows: 2 })], { group: 'content' }),
    defineField({ name: 'members', title: 'Учасники', type: 'array', of: [{ type: 'teamMember' }], group: 'content' }),
  ],
  preview: {
    select: { hidden: 'hidden', g: 'texts', media: 'members.0.logo' },
    prepare: ({ hidden, g, media }) => ({ title: `Команда${hidden ? ' (приховано)' : ''}`, subtitle: ukOf(g, 'title'), media }),
  },
});

export const faqTitleLine = titleLinesType('faqTitleLine', 'muted');

export const faqDoc = defineType({
  name: 'faqDoc', title: 'Документ', type: 'object',
  description: 'Посилання на сторінку документа сайту; відкривається в новій вкладці.',
  fields: [
    defineField({
      name: 'document', title: 'Документ', type: 'reference', to: [{ type: 'legalDocument' }],
      description: 'Сторінка з розділу «Документи». Назва на плашці — назва документа.',
      validation: (r) => r.required(),
    }),
    texts('faqDocTexts', [
      S('title', 'Інша назва на плашці', 'Порожньо — назва документа (рекомендовано).'),
      S('note', 'Підпис під назвою', 'Номер, дата або інше з документа.'),
      S('format', 'Мітка на плашці', 'Коротке слово в рамці зліва, наприклад «Дозвіл».'),
    ], { optional: ['title', 'note'] }),
  ],
  preview: {
    select: { g: 'texts', d: 'document.texts' },
    prepare: ({ g, d }) => ({ title: ukOf(g, 'title') ?? ukOf(d, 'title') ?? 'Документ не вибрано', subtitle: ukOf(g, 'note') }),
  },
});

export const faqItem = defineType({
  name: 'faqItem', title: 'Питання', type: 'object',
  fields: [texts('faqItemTexts', [S('question', 'Питання'), defineField({ name: 'answer', title: 'Відповідь', type: 'text', rows: 5 })])],
  preview: { select: { g: 'texts' }, prepare: ({ g }) => ({ title: ukOf(g, 'question') }) },
});

export const faq = defineType({
  name: 'faq', title: 'Питання та відповіді', type: 'object', groups: blockGroups,
  fields: [
    hiddenField,
    languagesField,
    anchorField('faq'),
    titleLinesField('faqTitleLine'),
    texts('faqTexts', [
      S('docsTitle', 'Заголовок документів'),
      S('ctaTitle', 'Заголовок картки «Поставити питання»'),
      defineField({ name: 'ctaText', title: 'Текст картки', type: 'text', rows: 2 }),
    ], { group: 'content' }),
    defineField({ name: 'docs', title: 'Документи', type: 'array', of: [{ type: 'faqDoc' }], group: 'content' }),
    linkField('cta', 'Кнопка картки', { group: 'content' }),
    defineField({ name: 'items', title: 'Питання', type: 'array', of: [{ type: 'faqItem' }], group: 'content' }),
  ],
  preview: {
    select: { hidden: 'hidden', t: 'title.0.text' },
    prepare: ({ hidden, t }) => ({ title: `Питання та відповіді${hidden ? ' (приховано)' : ''}`, subtitle: ukOf(t) }),
  },
});
