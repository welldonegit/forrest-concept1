/** Блоки «Апартаменти», «Форма: фінмодель», «Фінальна форма». */
import { defineField, defineType } from 'sanity';
import { text, texts } from '../lib/i18n.ts';
import { anchorField, blockGroups, hiddenField, languagesField, ukOf } from '../lib/block.ts';
import { photoField, str, titleLinesField, titleLinesType } from '../lib/fields.ts';
import { languages, defaultLanguage } from '../../../src/lib/languages.ts';

export const apartmentsTitleLine = titleLinesType('apartmentsTitleLine', 'muted');
export const formTitleLine = titleLinesType('formTitleLine', 'mutedText');

export const apartmentItem = defineType({
  name: 'apartmentItem', title: 'Картка формату', type: 'object',
  fields: [
    defineField({
      name: 'format', title: 'Формат', type: 'reference', to: [{ type: 'apartmentFormat' }],
      description: 'Назва, площа, опис і планування — з розділу «Формати апартаментів».',
      validation: (r) => r.required(),
    }),
    photoField('image', 'Фото картки'),
  ],
  preview: { select: { name: 'format.name', area: 'format.area', media: 'image' }, prepare: ({ name, area, media }) => ({ title: name, subtitle: ukOf(area), media }) },
});

export const apartments = defineType({
  name: 'apartments', title: 'Апартаменти', type: 'object', groups: blockGroups,
  fields: [
    hiddenField,
    languagesField,
    anchorField('apartamenty'),
    titleLinesField('apartmentsTitleLine'),
    texts('apartmentsTexts', [
      defineField({ name: 'prevLabel', title: 'Стрілка «назад» (для програм читання з екрана)', type: 'string' }),
      defineField({ name: 'nextLabel', title: 'Стрілка «вперед» (для програм читання з екрана)', type: 'string' }),
      defineField({ name: 'planLabel', title: 'Кнопка «Планування»', type: 'string' }),
    ], { group: 'content' }),
    defineField({ name: 'items', title: 'Картки', type: 'array', of: [{ type: 'apartmentItem' }], group: 'content', validation: (r) => r.required().min(1) }),
  ],
  preview: {
    select: { hidden: 'hidden', t: 'title.0.text', media: 'items.0.image' },
    prepare: ({ hidden, t, media }) => ({ title: `Апартаменти${hidden ? ' (приховано)' : ''}`, subtitle: ukOf(t), media }),
  },
});

export const formBullet = defineType({
  name: 'formBullet', title: 'Пункт', type: 'object',
  fields: [text('text', { title: 'Текст пункту' }), photoField('image', 'Фото пункту')],
  preview: { select: { t: 'text', media: 'image' }, prepare: ({ t, media }) => ({ title: ukOf(t), media }) },
});

const bulletsField = defineField({
  name: 'bullets', title: 'Що отримає інвестор', type: 'array', of: [{ type: 'formBullet' }], group: 'content',
  description: 'Три картки з фото ліворуч від форми.',
});

export const form = defineType({
  name: 'form', title: 'Форма: фінмодель', type: 'object', groups: blockGroups,
  fields: [
    hiddenField,
    languagesField,
    anchorField('forma'),
    titleLinesField('formTitleLine'),
    text('text', { title: 'Текст під заголовком', multiline: true, group: 'content' }),
    bulletsField,
  ],
  preview: {
    select: { hidden: 'hidden', g: 'title.0.texts', media: 'bullets.0.image' },
    prepare: ({ hidden, g, media }) => ({ title: `Форма: фінмодель${hidden ? ' (приховано)' : ''}`, subtitle: ukOf(g, 'text'), media }),
  },
});

export const choiceOption = defineType({
  name: 'choiceOption', title: 'Варіант', type: 'object',
  fields: [
    text('label', { title: 'Підпис' }),
    str('value', 'Технічне значення для заявки', { required: true, description: 'Латиницею, однакове для всіх мов. Його бачить менеджер у CRM — не змінюйте без потреби.' }),
  ],
  preview: { select: { l: 'label', v: 'value' }, prepare: ({ l, v }) => ({ title: ukOf(l), subtitle: v }) },
});

export const formFinal = defineType({
  name: 'formFinal', title: 'Фінальна форма', type: 'object', groups: blockGroups,
  fields: [
    hiddenField,
    languagesField,
    anchorField('forma-final'),
    titleLinesField('formTitleLine'),
    texts('formFinalTexts', [
      defineField({ name: 'text', title: 'Текст під заголовком', type: 'text', rows: 3 }),
      defineField({ name: 'categoryLabel', title: 'Підпис поля «Категорія інвестиції»', type: 'string', description: 'Над списком категорій апартаментів.' }),
      defineField({ name: 'categoryPlaceholder', title: 'Текст у порожньому полі категорії', type: 'string', description: 'Видно, поки відвідувач нічого не вибрав. Наприклад «Оберіть категорію інвестиції».' }),
      defineField({ name: 'categoryPrice', title: 'Ціна в списку категорій', type: 'string', description: '{n} — ціна з «Формати апартаментів» → «Ціна від, $». Наприклад «від {n} $». Категорії та порядок — як у блоці «Апартаменти».' }),
      defineField({ name: 'goalLabel', title: 'Питання про мету інвестиції (не використовується)', type: 'string', description: 'Старе поле: з 2026-11-26 у формі замість нього — «Категорія інвестиції». Можна не заповнювати.' }),
      defineField({ name: 'contactLegend', title: 'Підпис «Як звʼязатися»', type: 'string' }),
      defineField({ name: 'submitLabel', title: 'Кнопка відправки', type: 'string' }),
      defineField({ name: 'note', title: 'Підпис біля кнопки', type: 'string' }),
    ], { group: 'content', optional: ['goalLabel'] }),
    bulletsField,
    defineField({ name: 'goals', title: 'Варіанти мети (не використовується)', type: 'array', of: [{ type: 'choiceOption' }], group: 'content', description: 'Старі варіанти: на сайті більше не показуються.' }),
    defineField({ name: 'contactOptions', title: 'Способи звʼязку', type: 'array', of: [{ type: 'choiceOption' }], group: 'content' }),
    defineField({
      name: 'unapprovedLanguages', title: 'Переклад не затверджено', type: 'array', of: [{ type: 'string' }], group: 'content',
      options: { list: languages.filter((l) => l.id !== defaultLanguage).map((l) => ({ title: l.name, value: l.id })), layout: 'grid' },
      description: 'Позначте мову, переклад якої ще не перевірено. Після перевірки — зніміть позначку. На сайт не впливає.',
    }),
  ],
  preview: {
    select: { hidden: 'hidden', g: 'title.0.texts', media: 'bullets.0.image' },
    prepare: ({ hidden, g, media }) => ({ title: `Фінальна форма${hidden ? ' (приховано)' : ''}`, subtitle: ukOf(g, 'text'), media }),
  },
});
