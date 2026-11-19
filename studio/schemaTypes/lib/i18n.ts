/**
 * Переводимые поля (sanity-plugin-internationalized-array).
 *
 * texts()  — все тексты одного элемента (карточки, подписи калькулятора, попапа) переводятся вместе:
 *            у элемента одна вкладка на язык со всеми его текстами. Так число уникальных полей
 *            набора данных не растёт с числом текстов и не зависит от числа языков
 *            (лимит бесплатного тарифа — 2 000, план этапа 3).
 * text()   — одиночный переводимый текст (строка или абзац).
 *
 * Обязателен только украинский. Пустой перевод на сайте заменяется украинским текстом,
 * сборка печатает список пропусков (src/lib/content.ts).
 */
import { defineField, defineType, type FieldDefinition, type Rule } from 'sanity';

/** Типы-группы для fieldTypes плагина: регистрируются здесь при описании схем. */
export const groupTypes: ReturnType<typeof defineType>[] = [];

const pascal = (s: string) => s[0].toUpperCase() + s.slice(1);

type I18nItem = { _key: string; language?: string; value?: unknown };

const UK = 'uk';
const HINT = 'Українська — обовʼязково. Порожній переклад на сайті замінюється українським текстом.';

function isEmpty(v: unknown) {
  return v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
}

/** Проверка: украинский есть и обязательные поля в нём заполнены. */
function requireUk(required: string[] | true) {
  return (items: I18nItem[] | undefined) => {
    const uk = items?.find((it) => (it.language ?? it._key) === UK);
    if (!uk) return 'Додайте український текст';
    if (required === true) return isEmpty(uk.value) ? { message: 'Заповніть український текст', path: [{ _key: uk._key }, 'value'] } : true;
    const value = (uk.value ?? {}) as Record<string, unknown>;
    const missing = required.filter((name) => isEmpty(value[name]));
    if (!missing.length) return true;
    return missing.map((name) => ({ message: 'Заповніть українською', path: [{ _key: uk._key }, 'value', name] }));
  };
}

interface TextsOptions {
  /** Имя поля в схеме; по умолчанию texts. */
  name?: string;
  title?: string;
  description?: string;
  /** Поля, обязательные в украинском; по умолчанию — все, кроме помеченных optional. */
  optional?: string[];
  group?: string;
}

/**
 * Тексты элемента одной группой. typeName — уникальное имя типа-группы (например statsCardTexts).
 * fields — обычные поля Sanity (string/text) с title и description на украинском.
 */
export function texts(typeName: string, fields: FieldDefinition[], options: TextsOptions = {}) {
  groupTypes.push(defineType({ name: typeName, title: options.title ?? 'Тексти', type: 'object', fields }));
  const required = fields.map((f) => f.name).filter((n) => !options.optional?.includes(n));
  return defineField({
    name: options.name ?? 'texts',
    title: options.title ?? 'Тексти',
    description: options.description ?? HINT,
    type: `internationalizedArray${pascal(typeName)}`,
    group: options.group,
    validation: (rule: Rule) => rule.custom(requireUk(required) as never),
  });
}

interface TextOptions {
  title: string;
  description?: string;
  /** Абзац (несколько строк) вместо строки. */
  multiline?: boolean;
  optional?: boolean;
  group?: string;
  hidden?: FieldDefinition['hidden'];
}

/** Одиночный переводимый текст. */
export function text(name: string, options: TextOptions) {
  return defineField({
    name,
    title: options.title,
    description: options.description ?? HINT,
    type: options.multiline ? 'internationalizedArrayText' : 'internationalizedArrayString',
    group: options.group,
    hidden: options.hidden,
    validation: options.optional ? undefined : (rule: Rule) => rule.custom(requireUk(true) as never),
  });
}
