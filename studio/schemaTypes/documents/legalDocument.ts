/**
 * «Документ»: політика конфіденційності та документи будівництва — окрема сторінка сайту на кожну мову.
 * Адреса: політика — /{мова}/<адреса>/, будівництво — /{мова}/dokumenty/<адреса>/ (src/lib/routes.ts).
 * Тексти перекладаються групою (назва, текст, SEO): одна вкладка на мову.
 * Імпорт з папки «Тексты» — studio/import/legal-documents.mjs.
 */
import { defineArrayMember, defineField, defineType } from 'sanity';
import { texts } from '../lib/i18n.ts';
import { ukOf } from '../lib/block.ts';
import { languages, defaultLanguage } from '../../../src/lib/languages.ts';

/** Адреси, які вже зайняті сторінками сайту. */
const RESERVED = ['archive', 'thanks', 'popup', '404', 'dokumenty'];

export const docTableRow = defineType({
  name: 'docTableRow', title: 'Рядок', type: 'object',
  fields: [defineField({ name: 'cells', title: 'Клітинки', type: 'array', of: [{ type: 'string' }], description: 'Зліва направо.' })],
  preview: { select: { c: 'cells' }, prepare: ({ c }) => ({ title: (c ?? []).join(' · ') }) },
});

export const docTable = defineType({
  name: 'docTable', title: 'Таблиця', type: 'object',
  fields: [
    defineField({
      name: 'headerRow', title: 'Перший рядок — заголовки стовпців', type: 'boolean', initialValue: false,
      description: 'Вимкнено — таблиця «назва — значення»: на телефоні кожен рядок показується стовпчиком.',
    }),
    defineField({ name: 'rows', title: 'Рядки', type: 'array', of: [{ type: 'docTableRow' }], validation: (r) => r.required().min(1) }),
  ],
  preview: {
    select: { rows: 'rows' },
    prepare: ({ rows }) => ({ title: 'Таблиця', subtitle: `${rows?.length ?? 0} рядк. · ${(rows?.[0]?.cells ?? []).join(' · ')}` }),
  },
});

export const documentBody = defineType({
  name: 'documentBody', title: 'Текст документа', type: 'array',
  of: [
    defineArrayMember({
      type: 'block',
      styles: [
        { title: 'Абзац', value: 'normal' },
        { title: 'Розділ (у змісті)', value: 'h2' },
        { title: 'Підрозділ', value: 'h3' },
      ],
      lists: [
        { title: 'Маркований список', value: 'bullet' },
        { title: 'Нумерований список', value: 'number' },
      ],
      marks: {
        decorators: [{ title: 'Жирний', value: 'strong' }, { title: 'Курсив', value: 'em' }],
        annotations: [{
          name: 'link', title: 'Посилання', type: 'object',
          fields: [defineField({ name: 'href', title: 'Адреса', type: 'string', description: 'https://… або mailto:…', validation: (r) => r.required() })],
        }],
      },
    }),
    defineArrayMember({ type: 'docTable' }),
  ],
});

const ADDITIONAL = languages.filter((l) => l.id !== defaultLanguage);

export const legalDocument = defineType({
  name: 'legalDocument', title: 'Документ', type: 'document',
  description: 'Політика конфіденційності або документ будівництва — окрема сторінка сайту.',
  fields: [
    texts('legalDocumentTexts', [
      defineField({ name: 'title', title: 'Назва', type: 'string', description: 'Заголовок сторінки і назва в посиланнях (FAQ, футер).' }),
      defineField({ name: 'body', title: 'Текст документа', type: 'documentBody', description: '«Розділ» потрапляє у зміст угорі сторінки. Таблиця — кнопка «+» між абзацами.' }),
      defineField({ name: 'seoTitle', title: 'SEO: заголовок вкладки', type: 'string', description: 'Порожньо — назва документа і назва сайту.' }),
      defineField({ name: 'seoDescription', title: 'SEO: опис', type: 'text', rows: 3, description: 'Порожньо — початок тексту документа.' }),
    ], { optional: ['seoTitle', 'seoDescription'] }),
    defineField({
      name: 'category', title: 'Категорія', type: 'string',
      options: { list: [{ title: 'Політика', value: 'policy' }, { title: 'Будівництво', value: 'construction' }], layout: 'radio', direction: 'horizontal' },
      description: 'Від неї залежить адреса: політика — /uk/<адреса>/, будівництво — /uk/dokumenty/<адреса>/.',
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'slug', title: 'Адреса сторінки', type: 'string',
      description: 'Латиницею, малими літерами, слова через дефіс: polityka-konfidentsiinosti. Однакова для всіх мов. Зміна адреси ламає старі посилання.',
      validation: (r) => r.required().custom((v?: string) => {
        if (!v) return true;
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v)) return 'Лише латиниця a–z, цифри і дефіс між словами';
        if (RESERVED.includes(v)) return 'Ця адреса вже зайнята сторінкою сайту';
        return true;
      }),
    }),
    defineField({
      name: 'editionDate', title: 'Дата редакції', type: 'date', options: { dateFormat: 'DD.MM.YYYY' },
      description: 'Лише якщо дата редакції є в самому документі. Порожньо — дата на сторінці не показується.',
    }),
    defineField({
      name: 'unapprovedLanguages', title: 'Переклад не затверджено', type: 'array', of: [{ type: 'string' }],
      options: { list: ADDITIONAL.map((l) => ({ title: l.name, value: l.id })), layout: 'grid' },
      description: 'Позначте мову, переклад якої ще не перевірено. Після перевірки — зніміть позначку. На сайт не впливає.',
    }),
  ],
  orderings: [{ title: 'За назвою', name: 'title', by: [{ field: 'slug', direction: 'asc' }] }],
  preview: {
    select: { g: 'texts', category: 'category', u: 'unapprovedLanguages' },
    prepare: ({ g, category, u }) => ({
      title: ukOf(g, 'title'),
      subtitle: [category === 'policy' ? 'Політика' : 'Будівництво', u?.length ? `переклад не затверджено: ${u.join(', ')}` : ''].filter(Boolean).join(' · '),
    }),
  },
});
