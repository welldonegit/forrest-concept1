/** Блоки «Інвестиція в цифрах» (картки + калькулятор) и «Сервіс для інвестора». */
import { defineField, defineType } from 'sanity';
import { text, texts } from '../lib/i18n.ts';
import { anchorField, blockGroups, hiddenField, ukOf } from '../lib/block.ts';
import { linkField, num, photoField, str, titleLinesField, titleLinesType } from '../lib/fields.ts';

export const numbersTitleLine = titleLinesType('numbersTitleLine', 'muted');
export const serviceTitleLine = titleLinesType('serviceTitleLine', 'muted');

const S = (name: string, title: string, description?: string) => defineField({ name, title, type: 'string', description });

export const numbersStep = defineType({
  name: 'numbersStep', title: 'Етап оплати', type: 'object',
  fields: [texts('numbersStepTexts', [S('title', 'Заголовок'), S('text', 'Текст')])],
  preview: { select: { g: 'texts' }, prepare: ({ g }) => ({ title: ukOf(g, 'title'), subtitle: ukOf(g, 'text') }) },
});

export const numbers = defineType({
  name: 'numbers', title: 'Інвестиція в цифрах', type: 'object',
  groups: [blockGroups[0], { name: 'calc', title: 'Калькулятор' }, blockGroups[1]],
  description: 'Числа для розрахунку (ціна за м², дохідність, оплата) — у розділі «Ціни та дохідність».',
  fields: [
    hiddenField,
    anchorField('cyfry-2'),
    titleLinesField('numbersTitleLine'),
    defineField({
      name: 'yieldCard', title: 'Картка «Дохідність»', type: 'object', group: 'content',
      fields: [texts('numbersYieldTexts', [S('label', 'Підпис'), S('value', 'Значення', 'Наприклад «12%».')])],
    }),
    defineField({
      name: 'paybackCard', title: 'Картка «Окупність»', type: 'object', group: 'content',
      fields: [texts('numbersPaybackTexts', [
        S('label', 'Підпис'), S('value', 'Число'), S('unit', 'Одиниця'), S('pointLabel', 'Підпис точки на графіку'),
        S('start', 'Початок шкали'), S('point', 'Точка окупності'), S('end', 'Кінець шкали'),
      ])],
    }),
    defineField({
      name: 'paymentCard', title: 'Картка «Оплата»', type: 'object', group: 'content',
      fields: [
        texts('numbersPaymentTexts', [S('label', 'Підпис'), S('value', 'Сума'), S('months', 'Кількість місяців'), S('monthsLabel', 'Підпис місяців')]),
        defineField({ name: 'steps', title: 'Етапи', type: 'array', of: [{ type: 'numbersStep' }] }),
      ],
    }),
    photoField('panorama', 'Панорама', { group: 'content', description: 'Фон зворотного боку карток і калькулятора.' }),
    defineField({
      name: 'calc', title: 'Калькулятор: тексти', type: 'object', group: 'calc',
      fields: [
        defineField({ name: 'title', title: 'Заголовок калькулятора', type: 'array', of: [{ type: 'numbersTitleLine' }] }),
        texts('numbersCalcTexts', [
          S('formatLabel', 'Підпис «Формат»'), S('paymentLabel', 'Підпис «Оплата»'),
          S('areaLabel', 'Підпис «Площа»'), S('areaUnit', 'Одиниця площі'),
          S('priceM2Label', 'Підпис «Ціна за м²»'), S('rentLabel', 'Підпис «Оренда»'),
          S('rentValue', 'Оренда: значення'), S('rentUnit', 'Оренда: одиниця'),
          S('priceLabel', 'Підпис «Вартість»'), S('yieldLabel', 'Підпис «Дохідність»'),
          S('firstLabel', 'Підпис «Перший внесок»'), S('monthLabel', 'Підпис «Щомісячний платіж»'),
          S('noMonthly', 'Текст замість платежу при оплаті одразу'),
          S('incomeLabel', 'Підпис «Дохід»'), S('paybackLabel', 'Підпис «Окупність»'),
          S('paybackFormat', 'Окупність: формат', '{n} — кількість років, наприклад «{n} років».'),
          S('chartTitle', 'Заголовок графіка'),
          S('breakEvenFormat', 'Точка беззбитковості: формат', '{n} — рік окупності.'),
          S('axisStart', 'Шкала: початок'), S('axisEnd', 'Шкала: кінець'),
          S('legendBefore', 'Легенда: до окупності'), S('legendAfter', 'Легенда: після окупності'),
        ]),
        linkField('cta', 'Кнопка під калькулятором'),
      ],
    }),
  ],
  preview: {
    select: { hidden: 'hidden', t: 'title.0.text', media: 'panorama' },
    prepare: ({ hidden, t, media }) => ({ title: `Інвестиція в цифрах${hidden ? ' (приховано)' : ''}`, subtitle: ukOf(t), media }),
  },
});

export const serviceItem = defineType({
  name: 'serviceItem', title: 'Послуга', type: 'object',
  fields: [texts('serviceItemTexts', [S('title', 'Назва'), defineField({ name: 'text', title: 'Текст', type: 'text', rows: 2 })])],
  preview: { select: { g: 'texts' }, prepare: ({ g }) => ({ title: ukOf(g, 'title'), subtitle: ukOf(g, 'text') }) },
});

const L = (type: string, title: string) => defineType({
  name: type, title, type: 'object',
  fields: [text('label', { title: 'Підпис' })],
  preview: { select: { l: 'label' }, prepare: ({ l }) => ({ title: ukOf(l) }) },
});
export const dashNavItem = L('dashNavItem', 'Пункт меню');
export const dashAxisItem = L('dashAxisItem', 'Підпис шкали');

export const dashKpi = defineType({
  name: 'dashKpi', title: 'Показник', type: 'object',
  fields: [
    texts('dashKpiTexts', [S('label', 'Підпис'), S('note', 'Примітка')]),
    num('value', 'Число', { required: true, description: 'При появі рахується від 0.' }),
    str('prefix', 'Перед числом', { description: 'Наприклад «$».' }),
    str('suffix', 'Після числа', { description: 'Наприклад «%».' }),
  ],
  preview: { select: { g: 'texts', v: 'value' }, prepare: ({ g, v }) => ({ title: `${v ?? ''} ${ukOf(g, 'label') ?? ''}` }) },
});

export const dashReport = defineType({
  name: 'dashReport', title: 'Звіт', type: 'object',
  fields: [text('label', { title: 'Назва' }), str('tag', 'Мітка', { description: 'Наприклад «PDF».' })],
  preview: { select: { l: 'label', tag: 'tag' }, prepare: ({ l, tag }) => ({ title: ukOf(l), subtitle: tag }) },
});

export const dashStay = defineType({
  name: 'dashStay', title: 'Бронювання', type: 'object',
  fields: [text('dates', { title: 'Дати' }), str('tag', 'Мітка')],
  preview: { select: { d: 'dates', tag: 'tag' }, prepare: ({ d, tag }) => ({ title: ukOf(d), subtitle: tag }) },
});

export const investorService = defineType({
  name: 'investorService', title: 'Сервіс для інвестора', type: 'object',
  groups: [blockGroups[0], { name: 'dashboard', title: 'Макет кабінету' }, blockGroups[1]],
  fields: [
    hiddenField,
    anchorField('servis'),
    titleLinesField('serviceTitleLine'),
    text('lead', { title: 'Підзаголовок', multiline: true, group: 'content' }),
    defineField({
      name: 'feature', title: 'Послуга 01 (під ноутбуком)', type: 'object', group: 'content',
      fields: [texts('serviceFeatureTexts', [S('title', 'Назва'), defineField({ name: 'text', title: 'Текст', type: 'text', rows: 2 })])],
    }),
    defineField({ name: 'services', title: 'Послуги 02–07', type: 'array', of: [{ type: 'serviceItem' }], group: 'content', description: 'Перші три — ліва колонка, решта — права.' }),
    defineField({
      name: 'dashboard', title: 'Макет кабінету інвестора', type: 'object', group: 'dashboard',
      description: 'Ілюстрація на екрані ноутбука і телефона. Цифри — приклад, не реальні дані.',
      fields: [
        texts('dashTexts', [
          S('ariaLabel', 'Опис макета для програм читання з екрана'),
          S('unit', 'Обʼєкт (апартамент)'), S('title', 'Заголовок'), S('status', 'Статус'),
          S('chartTitle', 'Заголовок графіка'), S('chartPeriod', 'Період графіка'), S('reportsTitle', 'Заголовок звітів'),
        ]),
        str('brand', 'Назва в макеті'),
        defineField({ name: 'nav', title: 'Меню макета', type: 'array', of: [{ type: 'dashNavItem' }], description: 'Перший пункт — активний.' }),
        defineField({ name: 'kpis', title: 'Показники', type: 'array', of: [{ type: 'dashKpi' }] }),
        defineField({ name: 'chartPoints', title: 'Точки графіка', type: 'array', of: [{ type: 'number' }], description: 'Висота від верху, 0–100 (менше — вище), рівний крок по місяцях.' }),
        defineField({ name: 'chartAxis', title: 'Підписи шкали', type: 'array', of: [{ type: 'dashAxisItem' }] }),
        defineField({ name: 'reports', title: 'Звіти', type: 'array', of: [{ type: 'dashReport' }] }),
        defineField({
          name: 'phone', title: 'Телефон', type: 'object',
          fields: [
            texts('dashPhoneTexts', [S('payoutLabel', 'Підпис виплати'), S('occupancyLabel', 'Підпис заповнюваності')]),
            num('payout', 'Виплата'), str('payoutPrefix', 'Перед сумою'), num('occupancy', 'Заповнюваність, %', { description: '0–100.' }),
            defineField({ name: 'stays', title: 'Бронювання', type: 'array', of: [{ type: 'dashStay' }] }),
          ],
        }),
      ],
    }),
  ],
  preview: {
    select: { hidden: 'hidden', t: 'title.0.text' },
    prepare: ({ hidden, t }) => ({ title: `Сервіс для інвестора${hidden ? ' (приховано)' : ''}`, subtitle: ukOf(t) }),
  },
});
