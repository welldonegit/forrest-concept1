/**
 * «Налаштування сайту»: тексты интерфейса и общие данные (CLAUDE.md) — меню, шапка, футер,
 * контакты, эксперт в формах, формы и ошибки, попапы, страницы «Архів» и «Дякуємо», SEO.
 * Один документ (_id siteSettings): создание и удаление выключены.
 */
import { defineField, defineType } from 'sanity';
import { text, texts } from '../lib/i18n.ts';
import { ukOf } from '../lib/block.ts';
import { iconField, linkField, linkItemType, photoField, str } from '../lib/fields.ts';

const S = (name: string, title: string, description?: string) => defineField({ name, title, type: 'string', description });
const T = (name: string, title: string, description?: string) => defineField({ name, title, type: 'text', rows: 3, description });

export const navLink = linkItemType('navLink');

const NETWORKS = [
  { title: 'Telegram', value: 'telegram' },
  { title: 'Viber', value: 'viber' },
  { title: 'WhatsApp', value: 'whatsapp' },
  { title: 'Instagram', value: 'instagram' },
];

export const socialLink = defineType({
  name: 'socialLink', title: 'Мережа', type: 'object',
  fields: [
    defineField({ name: 'network', title: 'Мережа', type: 'string', options: { list: NETWORKS }, validation: (r) => r.required() }),
    str('label', 'Назва (для програм читання з екрана)', { required: true }),
    str('url', 'Посилання', { required: true, description: 'TODO: справжні адреси від замовника.' }),
    iconField('icon', 'Іконка'),
  ],
  preview: { select: { l: 'label', url: 'url' }, prepare: ({ l, url }) => ({ title: l, subtitle: url }) },
});

export const footerGroup = defineType({
  name: 'footerGroup', title: 'Колонка', type: 'object',
  fields: [text('title', { title: 'Заголовок колонки' }), defineField({ name: 'links', title: 'Посилання', type: 'array', of: [{ type: 'navLink' }] })],
  preview: { select: { t: 'title' }, prepare: ({ t }) => ({ title: ukOf(t) }) },
});

export const quizBudget = defineType({
  name: 'quizBudget', title: 'Варіант бюджету', type: 'object',
  fields: [text('label', { title: 'Підпис' })],
  preview: { select: { l: 'label' }, prepare: ({ l }) => ({ title: ukOf(l) }) },
});

export const quizCountry = defineType({
  name: 'quizCountry', title: 'Країна', type: 'object',
  fields: [str('code', 'Телефонний код', { required: true, description: 'Наприклад «+380».' }), text('label', { title: 'Назва країни' })],
  preview: { select: { c: 'code', l: 'label' }, prepare: ({ c, l }) => ({ title: `${c} ${ukOf(l) ?? ''}` }) },
});

export const siteSettings = defineType({
  name: 'siteSettings', title: 'Налаштування сайту', type: 'document',
  groups: [
    { name: 'contacts', title: 'Контакти', default: true },
    { name: 'header', title: 'Меню і шапка' },
    { name: 'footer', title: 'Футер' },
    { name: 'forms', title: 'Форми' },
    { name: 'manager', title: 'Експерт у формах' },
    { name: 'popups', title: 'Попапи' },
    { name: 'pages', title: 'Сторінки' },
    { name: 'seo', title: 'SEO' },
    { name: 'ui', title: 'Службові підписи' },
    { name: 'technical', title: 'Технічне' },
  ],
  fields: [
    defineField({
      name: 'contacts', title: 'Контакти', type: 'object', group: 'contacts',
      description: 'Показуються в меню, футері і картці експерта.',
      fields: [
        str('phone', 'Телефон (як показувати)', { required: true }),
        str('phoneHref', 'Телефон для дзвінка', { required: true, description: 'tel: і номер без пробілів, наприклад tel:+380777999999.' }),
        text('address', { title: 'Адреса', multiline: true }),
        defineField({ name: 'messengers', title: 'Месенджери', type: 'array', of: [{ type: 'socialLink' }] }),
        defineField({ name: 'socials', title: 'Соцмережі', type: 'array', of: [{ type: 'socialLink' }] }),
      ],
    }),
    defineField({
      name: 'header', title: 'Шапка', type: 'object', group: 'header',
      fields: [
        texts('headerTexts', [
          S('logoAlt', 'Опис логотипа'), S('menuOpenLabel', 'Кнопка «Відкрити меню»'), S('menuCloseLabel', 'Кнопка «Закрити меню»'),
          S('menuDialogLabel', 'Назва меню'), S('languageButtonLabel', 'Кнопка мови'), S('languageListLabel', 'Список мов'),
        ], { description: 'Здебільшого підписи для програм читання з екрана. Українська — обовʼязково.' }),
        linkField('cta', 'Кнопка «Звʼязатися»'),
        str('homeHref', 'Посилання логотипа', { description: 'Технічне: #top — нагору сторінки.', readOnly: true }),
      ],
    }),
    defineField({
      name: 'menu', title: 'Меню', type: 'object', group: 'header',
      fields: [
        texts('menuTexts', [
          S('navLabel', 'Назва навігації (для програм читання з екрана)'), S('imageCaption', 'Підпис фото'),
          S('salesLabel', 'Заголовок «Відділ продажу»'), S('messengersLabel', 'Заголовок «Месенджери»'),
          S('addressLabel', 'Заголовок «Адреса»'), S('socialsLabel', 'Заголовок «Соцмережі»'),
        ]),
        defineField({ name: 'primary', title: 'Великі пункти', type: 'array', of: [{ type: 'navLink' }] }),
        defineField({ name: 'secondary', title: 'Малі пункти', type: 'array', of: [{ type: 'navLink' }] }),
        photoField('image', 'Фото в меню'),
      ],
    }),
    defineField({
      name: 'footer', title: 'Футер', type: 'object', group: 'footer',
      fields: [
        texts('footerTexts', [
          T('address', 'Адреса'), S('wordmarkLabel', 'Опис великого напису FORREST'), S('copyright', 'Копірайт'),
        ]),
        defineField({ name: 'groups', title: 'Колонки посилань', type: 'array', of: [{ type: 'footerGroup' }] }),
        defineField({ name: 'legalLinks', title: 'Юридичні посилання', type: 'array', of: [{ type: 'navLink' }], description: 'Політика конфіденційності — виберіть документ.' }),
        defineField({
          name: 'credit', title: 'Студія-розробник', type: 'object',
          fields: [text('label', { title: 'Підпис' }), str('logoLabel', 'Назва студії'), str('href', 'Посилання', { description: 'TODO: адреса студії.' })],
        }),
        photoField('image', 'Фото футера'),
      ],
    }),
    defineField({
      name: 'manager', title: 'Експерт у формах', type: 'object', group: 'manager',
      description: 'Картка біля форм «Фінмодель» і «Фінальна форма». Телефон і месенджери — з «Контактів».',
      fields: [photoField('photo', 'Фото'), texts('managerTexts', [S('name', 'Імʼя'), S('role', 'Посада')])],
    }),
    defineField({
      name: 'form', title: 'Форми заявки', type: 'object', group: 'forms',
      description: 'Спільне для всіх форм: «Фінмодель», «Фінальна форма», квіз, попап апартамента.',
      fields: [
        texts('formTexts', [
          S('nameLabel', 'Підпис поля «Імʼя»'), S('namePlaceholder', 'Підказка в полі «Імʼя»'),
          S('phoneLabel', 'Підпис поля «Телефон»'), S('phonePlaceholder', 'Підказка в полі «Телефон»'),
          S('formatLabel', 'Підпис списку форматів'), S('formatUndecidedLabel', 'Пункт «Ще не визначився»'),
          S('contactLegend', 'Підпис «Як звʼязатися»'), S('submitLabel', 'Кнопка відправки'),
          S('successTitle', 'Успіх: заголовок'), T('successText', 'Успіх: текст'),
        ]),
        defineField({ name: 'formats', title: 'Формати в списку', type: 'array', of: [{ type: 'reference', to: [{ type: 'apartmentFormat' }] }] }),
        defineField({ name: 'contactOptions', title: 'Способи звʼязку', type: 'array', of: [{ type: 'choiceOption' }] }),
        defineField({
          name: 'errors', title: 'Тексти помилок', type: 'object',
          fields: [texts('formErrorTexts', [
            S('required', 'Порожнє обовʼязкове поле'), S('phone', 'Неправильний телефон'),
            S('turnstile', 'Не пройдено перевірку «я не робот»'), S('send', 'Не вдалося відправити'), S('consent', 'Немає згоди (квіз)'),
          ])],
        }),
      ],
    }),
    defineField({
      name: 'popups', title: 'Попапи', type: 'object', group: 'popups',
      fields: [
        defineField({
          name: 'apartment', title: 'Попап апартамента', type: 'object',
          fields: [texts('popupApartmentTexts', [
            S('dialogLabel', 'Назва вікна (для програм читання з екрана)'), S('areaLabel', 'Підпис «Площа»'), S('priceLabel', 'Підпис «Вартість»'),
            S('incomeLabel', 'Підпис «Дохід»'), S('yieldLabel', 'Підпис «Дохідність»'), S('fromFormat', 'Формат «від {n}»', '{n} — сума.'),
            S('yieldFormat', 'Формат дохідності', '{n} — відсоток.'), S('descriptionLabel', 'Заголовок «Опис»'), S('phoneLabel', 'Підпис поля телефону'),
            S('submitLabel', 'Кнопка відправки'), S('successLabel', 'Текст успіху'), S('planLabel', 'Підпис «Планування»'),
            S('photoLabel', 'Підпис фото'), S('prevLabel', 'Стрілка «назад»'), S('nextLabel', 'Стрілка «вперед»'),
          ])],
        }),
        defineField({
          name: 'video', title: 'Відео-попап', type: 'object',
          fields: [texts('popupVideoTexts', [S('dialogLabel', 'Назва вікна'), S('closeLabel', 'Кнопка «Закрити»'), S('frameTitle', 'Назва відео')])],
        }),
        defineField({
          name: 'quiz', title: 'Квіз «Розрахувати дохід»', type: 'object',
          fields: [
            texts('popupQuizTexts', [
              S('tabLabel', 'Бічна вкладка'), S('tabAriaLabel', 'Бічна вкладка (для програм читання з екрана)'), S('eyebrow', 'Надпис над кроком'),
              S('formatTitle', 'Крок 1: заголовок'), S('budgetTitle', 'Крок 2: заголовок'), S('contactTitle', 'Крок 3: заголовок'),
              T('contactText', 'Крок 3: текст'), S('nameLabel', 'Підпис поля «Імʼя»'), S('countryLabel', 'Підпис «Країна»'),
              S('phonePlaceholder', 'Підказка в полі телефону'), S('emailLabel', 'Підпис поля email'),
              T('consentText', 'Текст згоди', '{link} — місце посилання.'), S('consentLinkLabel', 'Текст посилання в згоді'),
              S('backLabel', 'Кнопка «Назад»'), S('nextLabel', 'Кнопка «Далі»'), S('submitLabel', 'Кнопка відправки'),
              S('successTitle', 'Успіх: заголовок'), T('successText', 'Успіх: текст'), S('returnLabel', 'Кнопка «Повернутися»'),
            ]),
            defineField({ name: 'budgets', title: 'Варіанти бюджету', type: 'array', of: [{ type: 'quizBudget' }] }),
            defineField({ name: 'countries', title: 'Країни', type: 'array', of: [{ type: 'quizCountry' }] }),
          ],
        }),
      ],
    }),
    defineField({
      name: 'privacyPolicy', title: 'Політика конфіденційності у згоді', type: 'reference', to: [{ type: 'legalDocument' }], group: 'forms',
      description: 'Документ, на який веде посилання в згоді на обробку даних (квіз). Відкривається в новій вкладці.',
    }),
    defineField({
      name: 'archivePage', title: 'Сторінка «Архів звітів»', type: 'object', group: 'pages',
      fields: [texts('archivePageTexts', [
        S('title', 'Заголовок, рядок 1'), S('subtitle', 'Заголовок, рядок 2'), S('backLabel', 'Посилання «На головну»'),
        S('seoTitle', 'SEO: заголовок вкладки'), T('seoDescription', 'SEO: опис'),
      ])],
    }),
    defineField({
      name: 'thanksPage', title: 'Сторінка «Дякуємо»', type: 'object', group: 'pages',
      fields: [texts('thanksPageTexts', [
        T('message', 'Повідомлення', 'Замість заголовка першого екрана. Перенос рядка (Enter) — перенос на компʼютері.'),
        S('homeButton', 'Кнопка «На головну»', 'Єдина кнопка першого екрана, веде на головну сторінку цією мовою.'),
        S('seoTitle', 'SEO: заголовок вкладки'), T('seoDescription', 'SEO: опис'),
      ])],
    }),
    defineField({
      name: 'notFoundPage', title: 'Сторінка 404 («Сторінку не знайдено»)', type: 'object', group: 'pages',
      description: 'Показується, коли відвідувач відкрив адресу, якої на сайті немає.',
      fields: [texts('notFoundPageTexts', [
        T('message', 'Повідомлення', 'Замість заголовка першого екрана. Перенос рядка (Enter) — перенос на компʼютері.'),
        S('homeButton', 'Кнопка «На головну»', 'Єдина кнопка першого екрана, веде на головну сторінку цією мовою.'),
        S('seoTitle', 'Заголовок вкладки браузера'),
      ])],
    }),
    defineField({
      name: 'documentPage', title: 'Сторінки документів', type: 'object', group: 'pages',
      description: 'Спільні підписи сторінок з розділу «Документи».',
      fields: [texts('documentPageTexts', [
        S('backLabel', 'Посилання «На головну»'),
        S('tocTitle', 'Заголовок змісту', 'Над списком розділів угорі довгого документа.'),
        S('editionLabel', 'Підпис перед датою редакції', 'Наприклад «Редакція від» — далі дата з документа.'),
      ])],
    }),
    defineField({
      name: 'seo', title: 'SEO головної', type: 'object', group: 'seo',
      fields: [texts('seoTexts', [S('title', 'Заголовок вкладки'), T('description', 'Опис для пошуковиків')])],
    }),
    defineField({
      name: 'ui', title: 'Службові підписи', type: 'object', group: 'ui',
      fields: [texts('uiTexts', [
        S('skipLink', 'Посилання «Перейти до змісту»', 'Видно при навігації клавіатурою.'),
        S('swipeHint', 'Підказка «Гортайте»'), S('closeLabel', 'Кнопка «Закрити»'),
      ])],
    }),
    defineField({
      name: 'analytics', title: 'Аналітика', type: 'object', group: 'technical',
      fields: [str('gtmId', 'ID контейнера Google Tag Manager', { description: 'Наприклад GTM-WPFP499D. Порожньо — GTM не підключається.' })],
    }),
  ],
  preview: { prepare: () => ({ title: 'Налаштування сайту' }) },
});
