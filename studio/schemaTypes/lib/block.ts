/**
 * Общее для блоков главной: вкладки «Зміст» и «Технічне», переключатель «Приховати блок»,
 * якорь (id секции — на него ведут меню и футер).
 */
import { defineField } from 'sanity';
import { languages } from '../../../src/lib/languages.ts';

export const blockGroups = [
  { name: 'content', title: 'Зміст', default: true },
  { name: 'technical', title: 'Технічне' },
];

export const hiddenField = defineField({
  name: 'hidden',
  title: 'Приховати блок',
  type: 'boolean',
  description: 'Блок лишається в адмінці, але не показується на сайті.',
  initialValue: false,
  group: 'content',
});

/** На каких языках блок виден на сайте. Пусто — на всех (по умолчанию). */
export const languagesField = defineField({
  name: 'languages',
  title: 'Мови, на яких показувати блок',
  type: 'array',
  of: [{ type: 'string' }],
  options: { list: languages.map((l) => ({ title: `${l.name} (${l.id})`, value: l.id })), layout: 'grid' },
  description: 'Нічого не вибрано — блок показується на всіх мовах. Вибрано — тільки на цих мовах.',
  group: 'content',
});

export function anchorField(example: string) {
  return defineField({
    name: 'anchor',
    title: 'Якір блоку',
    type: 'string',
    description: `Адреса блоку на сторінці (#${example}). На неї ведуть пункти меню і футера — не змінюйте без розробника.`,
    group: 'technical',
    readOnly: true,
    validation: (rule) => rule.required(),
  });
}

/** Украинское значение переводимого поля — для превью в списке. */
export function ukOf(items: unknown, field?: string): string | undefined {
  if (!Array.isArray(items)) return undefined;
  const uk = items.find((it) => (it?.language ?? it?._key) === 'uk');
  const v = field ? uk?.value?.[field] : uk?.value;
  return typeof v === 'string' ? v : undefined;
}
