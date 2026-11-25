/** Блоки «Сезонність», «Три світи», «Інвестиційна модель». */
import { defineField, defineType } from 'sanity';
import { text, texts } from '../lib/i18n.ts';
import { anchorField, blockGroups, hiddenField, ukOf } from '../lib/block.ts';
import { bool, linkField, photoField, str, titleLinesType } from '../lib/fields.ts';

export const seasonTitleLine = titleLinesType('seasonTitleLine', 'plain');

export const season = defineType({
  name: 'season', title: 'Сезонність (відео)', type: 'object', groups: blockGroups,
  fields: [
    hiddenField,
    anchorField('season'),
    defineField({
      name: 'title', title: 'Заголовок', type: 'array', of: [{ type: 'seasonTitleLine' }], group: 'content',
      description: 'Перший рядок — приглушеним кольором, наступні — основним.',
      validation: (r) => r.required().min(1),
    }),
    texts('seasonTexts', [
      defineField({ name: 'text', title: 'Текст', type: 'text', rows: 4 }),
      defineField({ name: 'durationLabel', title: 'Тривалість відео', type: 'string', description: 'Наприклад «60 сек».' }),
      defineField({ name: 'playLabel', title: 'Кнопка «Дивитися відео»', type: 'string' }),
    ], { group: 'content' }),
    photoField('poster', 'Кадр відео', { group: 'content' }),
    str('videoUrl', 'Відео (YouTube)', { group: 'content', required: true, description: 'Посилання на YouTube. На сайті відкривається в режимі без cookie.' }),
  ],
  preview: {
    select: { hidden: 'hidden', t: 'title.0.text', t1: 'title.1.text', media: 'poster' },
    prepare: ({ hidden, t, t1, media }) => ({ title: `Сезонність${hidden ? ' (приховано)' : ''}`, subtitle: [ukOf(t), ukOf(t1)].filter(Boolean).join(' '), media }),
  },
});

export const worldsTitleLine = defineType({
  name: 'worldsTitleLine', title: 'Рядок заголовка', type: 'object',
  fields: [
    texts('worldsTitleLineTexts', [
      defineField({ name: 'before', title: 'Текст до фото', type: 'string' }),
      defineField({ name: 'after', title: 'Текст після фото', type: 'string', description: 'Можна лишити порожнім.' }),
    ], { optional: ['after'] }),
    photoField('image', 'Фото-«пігулка» в рядку', { required: false, description: 'Маленьке фото всередині рядка. Можна не додавати.' }),
    bool('muted', 'Сірим кольором'),
  ],
  preview: {
    select: { g: 'texts', media: 'image' },
    prepare: ({ g, media }) => ({ title: [ukOf(g, 'before'), ukOf(g, 'after')].filter(Boolean).join(' … '), media }),
  },
});

export const worldFeature = defineType({
  name: 'worldFeature', title: 'Пункт інфраструктури', type: 'object',
  fields: [text('label', { title: 'Текст' })],
  preview: { select: { l: 'label' }, prepare: ({ l }) => ({ title: ukOf(l) }) },
});

export const world = defineType({
  name: 'world', title: 'Світ', type: 'object',
  groups: [{ name: 'card', title: 'Картка', default: true }, { name: 'popup', title: 'Вікно «Детальніше»' }],
  fields: [
    str('name', 'Назва світу', { required: true, group: 'card', description: 'WIND, ROCK, SUN — однаково для всіх мов.' }),
    texts('worldTexts', [
      defineField({ name: 'overline', title: 'Надпис над назвою', type: 'string' }),
      defineField({ name: 'subtitle', title: 'Підзаголовок', type: 'text', rows: 2 }),
    ], { group: 'card' }),
    linkField('cta', 'Кнопка', { group: 'card', description: 'Кнопка відкриває вікно «Детальніше» цього світу. Адреса — запасна: куди веде кнопка, якщо вікно не завантажилось (зазвичай #forma).' }),
    photoField('image', 'Фото', { group: 'card', description: 'Те саме фото — і в картці, і ліворуч у вікні «Детальніше».' }),
    texts('worldPopupTexts', [
      defineField({ name: 'about', title: 'Про секцію', type: 'text', rows: 5 }),
      defineField({ name: 'commissioning', title: 'Введення в експлуатацію', type: 'string', description: 'Наприклад «IV квартал 2028 року».' }),
      defineField({ name: 'access', title: 'Доступ до траси', type: 'string', description: 'Наприклад «Ski In / Ski Out, 5G».' }),
    ], { name: 'popupTexts', title: 'Вікно «Детальніше»: тексти', group: 'popup' }),
    defineField({
      name: 'features', title: 'Ключова інфраструктура', type: 'array', of: [{ type: 'worldFeature' }], group: 'popup',
      description: 'Пункти-«пігулки» у вікні «Детальніше», у цьому порядку.',
    }),
  ],
  preview: { select: { name: 'name', g: 'texts', media: 'image' }, prepare: ({ name, g, media }) => ({ title: name, subtitle: ukOf(g, 'overline'), media }) },
});

export const worlds = defineType({
  name: 'worlds', title: 'Три світи', type: 'object', groups: blockGroups,
  fields: [
    hiddenField,
    anchorField('worlds'),
    defineField({ name: 'title', title: 'Заголовок', type: 'array', of: [{ type: 'worldsTitleLine' }], group: 'content', validation: (r) => r.required().min(1) }),
    defineField({
      name: 'worlds', title: 'Світи', type: 'array', of: [{ type: 'world' }], group: 'content',
      description: 'Рівно три: центральна картка і дві бічні.',
      validation: (r) => r.required().length(3),
    }),
  ],
  preview: {
    select: { hidden: 'hidden', g: 'title.0.texts', media: 'worlds.0.image' },
    prepare: ({ hidden, g, media }) => ({ title: `Три світи${hidden ? ' (приховано)' : ''}`, subtitle: ukOf(g, 'before'), media }),
  },
});

export const modelStep = defineType({
  name: 'modelStep', title: 'Крок', type: 'object',
  fields: [texts('modelStepTexts', [
    defineField({ name: 'title', title: 'Заголовок кроку', type: 'string' }),
    defineField({ name: 'text', title: 'Текст', type: 'text', rows: 3 }),
  ])],
  preview: { select: { g: 'texts' }, prepare: ({ g }) => ({ title: ukOf(g, 'title'), subtitle: ukOf(g, 'text') }) },
});

export const model = defineType({
  name: 'model', title: 'Інвестиційна модель', type: 'object', groups: blockGroups,
  fields: [
    hiddenField,
    anchorField('model'),
    texts('modelTexts', [
      defineField({ name: 'title', title: 'Заголовок для програм читання з екрана', type: 'string', description: 'На сайті не видно, його озвучують програми для незрячих. TODO: текст чекає підтвердження.' }),
      defineField({ name: 'text', title: 'Абзац над кроками', type: 'text', rows: 4, description: 'При прокручуванні проявляється по словах.' }),
    ], { group: 'content' }),
    defineField({ name: 'steps', title: 'Кроки', type: 'array', of: [{ type: 'modelStep' }], group: 'content', description: 'Номер (01, 02…) ставиться за порядком.', validation: (r) => r.required().min(1) }),
  ],
  preview: {
    select: { hidden: 'hidden', g: 'texts' },
    prepare: ({ hidden, g }) => ({ title: `Інвестиційна модель${hidden ? ' (приховано)' : ''}`, subtitle: ukOf(g, 'text') }),
  },
});
