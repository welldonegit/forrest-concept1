/**
 * Документ «Головна сторінка»: упорядкований список блоків. Блок можна додати, приховати,
 * перетягнути на інше місце або видалити — без правки коду (CLAUDE.md).
 * Один документ на сайт (_id landing): створення нових і видалення вимкнені в sanity.config.ts.
 */
import { defineField, defineType } from 'sanity';
import { blockTypes } from '../blocks/index.ts';

export const landing = defineType({
  name: 'landing',
  title: 'Головна сторінка',
  type: 'document',
  fields: [
    defineField({
      name: 'blocks',
      title: 'Блоки сторінки',
      type: 'array',
      description: 'Порядок тут — порядок на сайті. Перетягніть блок за ручку ліворуч, щоб перемістити. «Приховати блок» — усередині блоку.',
      of: blockTypes.map((t) => ({ type: t.name })),
    }),
  ],
  preview: { prepare: () => ({ title: 'Головна сторінка' }) },
});
