/**
 * Общее для блоков главной: вкладки «Зміст» и «Технічне», переключатель «Приховати блок»,
 * якорь (id секции — на него ведут меню и футер).
 */
import { defineField } from 'sanity';

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
