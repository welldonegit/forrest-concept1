/** Блоки «Хід будівництва» (налаштування блоку; звіти — окремі документи), «Команда», «Питання та відповіді». */
import { defineField, defineType } from 'sanity';
import { text, texts } from '../lib/i18n.ts';
import { anchorField, blockGroups, hiddenField, ukOf } from '../lib/block.ts';
import { linkField, num, photoField, str, titleLinesField, titleLinesType } from '../lib/fields.ts';

const S = (name: string, title: string, description?: string) => defineField({ name, title, type: 'string', description });

export const construction = defineType({
  name: 'construction', title: 'Хід будівництва', type: 'object', groups: blockGroups,
  description: 'Самі звіти — у розділі «Хід будівництва» меню. Тут — заголовок і скільки останніх звітів показувати.',
  fields: [
    hiddenField,
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
  fields: [
    texts('faqDocTexts', [S('title', 'Назва'), S('note', 'Підпис під назвою', 'Обсяг, призначення.')]),
    str('format', 'Формат на плашці', { description: 'Наприклад «PDF».' }),
    defineField({
      name: 'file', title: 'Файл', type: 'file', options: { accept: '.pdf,application/pdf' },
      description: 'PDF для завантаження. Поки файлу немає — посилання без адреси. TODO: файл від замовника.',
    }),
  ],
  preview: { select: { g: 'texts', f: 'file.asset.originalFilename' }, prepare: ({ g, f }) => ({ title: ukOf(g, 'title'), subtitle: f ?? 'файл не завантажено' }) },
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
