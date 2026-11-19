/** Повторяющиеся поля схем: заголовок по строкам, ссылка, фото, число, иконка. */
import { defineField, defineType, type FieldDefinition } from 'sanity';
import { text, texts } from './i18n.ts';
import { ukOf } from './block.ts';

type Opts = { description?: string; group?: string; required?: boolean; hidden?: FieldDefinition['hidden']; readOnly?: boolean };

export function str(name: string, title: string, o: Opts = {}) {
  return defineField({
    name, title, type: 'string', description: o.description, group: o.group, hidden: o.hidden, readOnly: o.readOnly,
    validation: o.required ? (r) => r.required() : undefined,
  });
}

export function num(name: string, title: string, o: Opts = {}) {
  return defineField({
    name, title, type: 'number', description: o.description, group: o.group, readOnly: o.readOnly,
    validation: o.required ? (r) => r.required() : undefined,
  });
}

export function bool(name: string, title: string, o: Opts = {}) {
  return defineField({ name, title, type: 'boolean', description: o.description, group: o.group, initialValue: false });
}

export function photoField(name: string, title: string, o: Opts = {}) {
  return defineField({
    name, title, type: 'photo', description: o.description, group: o.group,
    validation: o.required === false ? undefined : (r) => r.required(),
  });
}

/** SVG-иконка контента (CLAUDE.md, решение 2026-11-19): пусто — на сайте иконка из кода. */
export function iconField(name: string, title: string, o: Opts = {}) {
  return defineField({
    name, title, type: 'svgIcon', group: o.group,
    description: o.description ?? 'SVG, один колір, квадратне полотно (viewBox 0 0 24 24). Порожньо — показується стандартна іконка. Вимоги — docs/ADMIN.md.',
  });
}

/** Ссылка: подпись переводится, адрес общий. */
export function linkField(name: string, title: string, o: Opts & { hrefHint?: string } = {}) {
  return defineField({
    name, title, type: 'object', group: o.group, description: o.description,
    options: { collapsible: false },
    fields: [
      text('label', { title: 'Підпис' }),
      defineField({
        name: 'href', title: 'Адреса', type: 'string',
        description: o.hrefHint ?? 'Посилання (https://…) або якір блоку на сторінці (#forma).',
        validation: (r) => r.required(),
      }),
    ],
  });
}

/** Тип элемента списка ссылок (меню, футер). */
export function linkItemType(name: string) {
  return defineType({
    name, title: 'Посилання', type: 'object',
    fields: [
      text('label', { title: 'Підпис' }),
      defineField({ name: 'href', title: 'Адреса', type: 'string', description: 'Посилання (https://…) або якір блоку (#forma).', validation: (r) => r.required() }),
    ],
    preview: { select: { l: 'label', href: 'href' }, prepare: ({ l, href }) => ({ title: ukOf(l), subtitle: href }) },
  });
}

/**
 * Заголовок по строкам. kind:
 *  - 'muted'     — строка целиком приглушённым цветом (переключатель);
 *  - 'mutedText' — продолжение строки приглушённым цветом (второй текст);
 *  - 'plain'     — только текст.
 */
export function titleLinesType(name: string, kind: 'muted' | 'mutedText' | 'plain') {
  const fields: FieldDefinition[] =
    kind === 'mutedText'
      ? [texts(`${name}Texts`, [
          defineField({ name: 'text', title: 'Текст рядка', type: 'string' }),
          defineField({ name: 'mutedText', title: 'Продовження сірим', type: 'string', description: 'Частина рядка приглушеним кольором. Можна лишити порожнім.' }),
        ], { optional: ['mutedText'] })]
      : [text('text', { title: 'Текст рядка' })];
  if (kind === 'muted') fields.push(bool('muted', 'Сірим кольором', { description: 'Рядок приглушеним кольором, як у макеті.' }));
  return defineType({
    name, title: 'Рядок заголовка', type: 'object', fields,
    preview: {
      select: { t: 'text', g: 'texts', muted: 'muted' },
      prepare: ({ t, g, muted }) => ({ title: ukOf(t) ?? [ukOf(g, 'text'), ukOf(g, 'mutedText')].filter(Boolean).join(' · '), subtitle: muted ? 'сірим' : undefined }),
    },
  });
}

export function titleLinesField(type: string, o: Opts = {}) {
  return defineField({
    name: 'title', title: 'Заголовок', type: 'array', of: [{ type }], group: o.group ?? 'content',
    description: o.description ?? 'Кожен рядок — окремо, як переноситься на сайті.',
    validation: (r) => r.required().min(1),
  });
}
