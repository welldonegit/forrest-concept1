/** Документы: «Звіт місяця» (хід будівництва), «Формат апартаментів», «Ціни та дохідність». */
import { defineField, defineType } from 'sanity';
import { text, texts } from '../lib/i18n.ts';
import { ukOf } from '../lib/block.ts';
import { num, photoField, str } from '../lib/fields.ts';
import { languages, defaultLanguage } from '../../../src/lib/languages.ts';

const MONTHS = ['січень', 'лютий', 'березень', 'квітень', 'травень', 'червень', 'липень', 'серпень', 'вересень', 'жовтень', 'листопад', 'грудень'];

export const reportWork = defineType({
  name: 'reportWork', title: 'Виконана робота', type: 'object',
  fields: [text('text', { title: 'Що зроблено' })],
  preview: { select: { t: 'text' }, prepare: ({ t }) => ({ title: ukOf(t) }) },
});

export const constructionReport = defineType({
  name: 'constructionReport', title: 'Звіт місяця', type: 'document',
  fields: [
    defineField({
      name: 'date', title: 'Дата звіту', type: 'date', options: { dateFormat: 'DD.MM.YYYY' },
      description: 'За нею — підпис місяця і порядок: нові звіти зверху.',
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'queue', title: 'Черга', type: 'string',
      options: { list: ['WIND', 'ROCK', 'SUN'], layout: 'radio', direction: 'horizontal' },
      description: 'Порожньо — звіт про весь курорт: мітки черги на картці немає.',
    }),
    texts('reportTexts', [
      defineField({ name: 'title', title: 'Заголовок', type: 'string' }),
      defineField({ name: 'text', title: 'Текст', type: 'text', rows: 4, description: 'Абзац під заголовком. Можна не заповнювати, якщо є список робіт.' }),
    ], { optional: ['text'] }),
    defineField({
      name: 'slides', title: 'Фото', type: 'array', of: [{ type: 'photo' }], options: { layout: 'grid' },
      description: 'Перетягніть кілька фото одразу. Порядок — як у гортанні на сайті.',
      validation: (r) => r.required().min(1),
    }),
    defineField({ name: 'works', title: 'Виконані роботи', type: 'array', of: [{ type: 'reportWork' }] }),
    defineField({
      name: 'video', title: 'Дрон-відео', type: 'object',
      fields: [
        str('url', 'Посилання на YouTube', { description: 'Порожньо — кнопки відео немає. TODO: посилання від замовника.' }),
        str('duration', 'Тривалість', { description: 'Наприклад «1:20».' }),
      ],
    }),
    defineField({
      name: 'unapprovedLanguages', title: 'Переклад не затверджено', type: 'array', of: [{ type: 'string' }],
      options: { list: languages.filter((l) => l.id !== defaultLanguage).map((l) => ({ title: l.name, value: l.id })), layout: 'grid' },
      description: 'Позначте мову, переклад якої ще не перевірено. Після перевірки — зніміть позначку. На сайт не впливає.',
    }),
  ],
  orderings: [{ title: 'Нові зверху', name: 'dateDesc', by: [{ field: 'date', direction: 'desc' }] }],
  preview: {
    select: { date: 'date', queue: 'queue', g: 'texts', media: 'slides.0', u: 'unapprovedLanguages' },
    prepare: ({ date, queue, g, media, u }) => {
      const d = date ? new Date(`${date}T00:00:00`) : null;
      const title = d ? [`${MONTHS[d.getMonth()]} ${d.getFullYear()}`, queue].filter(Boolean).join(' · ') : 'Без дати';
      const subtitle = [ukOf(g, 'title'), u?.length ? `переклад не затверджено: ${u.join(', ')}` : ''].filter(Boolean).join(' · ');
      return { title, subtitle, media };
    },
  },
});

export const formatTag = defineType({
  name: 'formatTag', title: 'Плашка', type: 'object',
  fields: [text('label', { title: 'Текст плашки' })],
  preview: { select: { l: 'label' }, prepare: ({ l }) => ({ title: ukOf(l) }) },
});

export const apartmentFormat = defineType({
  name: 'apartmentFormat', title: 'Формат апартаментів', type: 'document',
  description: 'Один формат — одна картка. Його використовують картки «Апартаменти», попап, список у формах, квіз і калькулятор.',
  fields: [
    str('name', 'Назва', { required: true, description: 'Superior, Deluxe… — однаково для всіх мов.' }),
    texts('formatTexts', [
      defineField({ name: 'area', title: 'Площа', type: 'string', description: 'Наприклад «29,5–34,5 м²».' }),
      defineField({ name: 'description', title: 'Опис (у попапі)', type: 'text', rows: 4 }),
    ]),
    defineField({ name: 'tags', title: 'Плашки (у попапі)', type: 'array', of: [{ type: 'formatTag' }], description: 'Перша — залита кольором.' }),
    defineField({ name: 'gallery', title: 'Додаткові фото (у попапі)', type: 'array', of: [{ type: 'photo' }], options: { layout: 'grid' }, description: 'Після фото з картки. Можна не додавати.' }),
    photoField('plan', 'Планування', { description: 'Останній слайд попапу, вписується цілком на білому.' }),
    num('priceFrom', 'Ціна від, $', { description: 'Мінімальна ціна апартамента в доларах, лише число (наприклад 132750). Показується в списку «Категорія інвестиції» фінальної форми: «від 132 750 $». Порожньо — категорія без ціни.' }),
  ],
  preview: { select: { name: 'name', g: 'texts', media: 'plan' }, prepare: ({ name, g, media }) => ({ title: name, subtitle: ukOf(g, 'area'), media }) },
});

export const pricingFormat = defineType({
  name: 'pricingFormat', title: 'Формат у розрахунку', type: 'object',
  fields: [
    defineField({ name: 'format', title: 'Формат', type: 'reference', to: [{ type: 'apartmentFormat' }], validation: (r) => r.required() }),
    num('area', 'Площа для розрахунку, м²', { required: true }),
    num('yieldPercent', 'Річна дохідність, %', { required: true }),
  ],
  preview: { select: { name: 'format.name', area: 'area', y: 'yieldPercent' }, prepare: ({ name, area, y }) => ({ title: name, subtitle: `${area} м² · ${y}%` }) },
});

export const pricingPayment = defineType({
  name: 'pricingPayment', title: 'Варіант оплати', type: 'object',
  fields: [
    texts('pricingPaymentTexts', [
      defineField({ name: 'title', title: 'Назва', type: 'string' }),
      defineField({ name: 'note', title: 'Примітка', type: 'string' }),
    ]),
    num('firstPercent', 'Перший внесок, % ціни', { required: true, description: '100 — оплата одразу.' }),
    num('months', 'Розтермінування, місяців', { required: true, description: '0 — без розтермінування.' }),
    defineField({ name: 'isDefault', title: 'Вибраний за замовчуванням', type: 'boolean', initialValue: false }),
  ],
  preview: { select: { g: 'texts', f: 'firstPercent', m: 'months' }, prepare: ({ g, f, m }) => ({ title: ukOf(g, 'title'), subtitle: `${f}% · ${m} міс.` }) },
});

export const pricing = defineType({
  name: 'pricing', title: 'Ціни та дохідність', type: 'document',
  description: 'Вихідні числа калькулятора. Їх використовують калькулятор, квіз і попап апартамента. TODO: ціну за м² і дохідність має підтвердити замовник.',
  fields: [
    num('pricePerM2', 'Ціна за м²', { required: true }),
    str('currency', 'Знак валюти', { required: true, description: 'Перед сумою, наприклад «$».' }),
    defineField({ name: 'formats', title: 'Формати', type: 'array', of: [{ type: 'pricingFormat' }], description: 'Перший — вибраний при відкритті сторінки.' }),
    defineField({ name: 'payments', title: 'Варіанти оплати', type: 'array', of: [{ type: 'pricingPayment' }] }),
    num('years', 'Скільки років на графіку', { required: true }),
  ],
  preview: { prepare: () => ({ title: 'Ціни та дохідність' }) },
});
