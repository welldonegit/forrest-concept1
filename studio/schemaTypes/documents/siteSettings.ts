/**
 * «Налаштування сайту»: тексты интерфейса и общие данные (CLAUDE.md) — меню, шапка, футер,
 * контакты, эксперт в формах, формы и ошибки, попапы, страницы «Архів» и «Дякуємо», SEO.
 * Один документ (_id siteSettings): создание и удаление выключены.
 */
import { defineField, defineType } from 'sanity';
import { text, texts } from '../lib/i18n.ts';
import { ukOf } from '../lib/block.ts';
import { iconField, linkItemType, photoField, str } from '../lib/fields.ts';
import { languages, defaultLanguage } from '../../../src/lib/languages.ts';

const S = (name: string, title: string, description?: string) => defineField({ name, title, type: 'string', description });
const T = (name: string, title: string, description?: string) => defineField({ name, title, type: 'text', rows: 3, description });

export const navLink = linkItemType('navLink');

const NETWORKS = [
  { title: 'Telegram', value: 'telegram' },
  { title: 'Viber', value: 'viber' },
  { title: 'WhatsApp', value: 'whatsapp' },
  { title: 'Instagram', value: 'instagram' },
  { title: 'Facebook', value: 'facebook' },
  { title: 'YouTube', value: 'youtube' },
  { title: 'TikTok', value: 'tiktok' },
];

export const socialLink = defineType({
  name: 'socialLink', title: 'Мережа', type: 'object',
  fields: [
    defineField({ name: 'network', title: 'Мережа', type: 'string', options: { list: NETWORKS }, validation: (r) => r.required() }),
    str('label', 'Назва (для програм читання з екрана)', { required: true }),
    str('url', 'Посилання', { required: true, description: 'Адреса профілю або чату: https://t.me/імʼя, https://wa.me/380…, viber://chat?number=%2B380…. Без імені профілю (https://t.me/) — заглушка: з нею боєвий сайт не збирається.' }),
    iconField('icon', 'Іконка'),
  ],
  preview: { select: { l: 'label', url: 'url' }, prepare: ({ l, url }) => ({ title: l, subtitle: url }) },
});

export const footerGroup = defineType({
  name: 'footerGroup', title: 'Колонка', type: 'object',
  fields: [
    text('title', { title: 'Заголовок колонки' }),
    defineField({
      name: 'contacts', title: 'Колонка контактів', type: 'boolean', initialValue: false,
      description: 'Увімкнено — замість посилань показуються телефон (Контакти → Телефон) і іконки месенджерів (Контакти → Месенджери). Вмикається в одній колонці.',
    }),
    defineField({ name: 'links', title: 'Посилання', type: 'array', of: [{ type: 'navLink' }], hidden: ({ parent }) => Boolean(parent?.contacts) }),
  ],
  preview: { select: { t: 'title', c: 'contacts' }, prepare: ({ t, c }) => ({ title: ukOf(t), subtitle: c ? 'Телефон і месенджери' : undefined }) },
});

export const quizBudget = defineType({
  name: 'quizBudget', title: 'Варіант бюджету', type: 'object',
  fields: [text('label', { title: 'Підпис' })],
  preview: { select: { l: 'label' }, prepare: ({ l }) => ({ title: ukOf(l) }) },
});

export const quizBonus = defineType({
  name: 'quizBonus', title: 'Бонус', type: 'object',
  fields: [
    text('title', { title: 'Назва бонусу' }),
    photoField('image', 'Мініатюра', { description: 'Маленьке фото поруч із назвою (44 px). Зазвичай декоративне.' }),
  ],
  preview: { select: { t: 'title', media: 'image' }, prepare: ({ t, media }) => ({ title: ukOf(t), media }) },
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
        defineField({ name: 'messengers', title: 'Месенджери', description: 'Кнопки «написати менеджеру»: меню, колонка контактів футера, картка експерта у формах і попапах.', type: 'array', of: [{ type: 'socialLink' }] }),
        defineField({ name: 'socials', title: 'Соцмережі', description: 'Іконки в першій колонці футера, під адресою (у тому ж порядку; Telegram там не показується — він є в месенджерах) і профілі в структурованих даних для пошуковиків (усі).', type: 'array', of: [{ type: 'socialLink' }] }),
      ],
    }),
    defineField({
      name: 'header', title: 'Шапка', type: 'object', group: 'header',
      fields: [
        texts('headerTexts', [
          S('logoAlt', 'Опис логотипа'), S('menuOpenLabel', 'Кнопка «Відкрити меню»'), S('menuCloseLabel', 'Кнопка «Закрити меню»'),
          S('menuDialogLabel', 'Назва меню'), S('languageButtonLabel', 'Кнопка мови'), S('languageListLabel', 'Список мов'),
        ], { description: 'Здебільшого підписи для програм читання з екрана. Українська — обовʼязково.' }),
        defineField({
          name: 'cta', title: 'Кнопка «Звʼязатися»', type: 'object', options: { collapsible: false },
          description: 'Відкриває попап «Звʼязатися» (Попапи → Попап «Звʼязатися»). Без JavaScript — дзвінок на номер із «Контакти → Телефон для дзвінка».',
          fields: [text('label', { title: 'Підпис' })],
        }),
        str('homeHref', 'Посилання логотипа', { description: 'Технічне: #top — нагору сторінки.', readOnly: true }),
      ],
    }),
    defineField({
      name: 'menu', title: 'Меню', type: 'object', group: 'header',
      fields: [
        texts('menuTexts', [
          S('navLabel', 'Назва навігації (для програм читання з екрана)'), S('imageCaption', 'Підпис фото'),
          S('salesLabel', 'Заголовок «Відділ продажу»'), S('messengersLabel', 'Заголовок «Месенджери»'),
          S('addressLabel', 'Заголовок «Адреса»'),
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
            S('turnstile', 'Не пройдено перевірку «я не робот»'), S('send', 'Не вдалося відправити'),
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
            S('submitLabel', 'Кнопка відправки'), S('planLabel', 'Підпис «Планування»'),
            S('photoLabel', 'Підпис фото'), S('prevLabel', 'Стрілка «назад»'), S('nextLabel', 'Стрілка «вперед»'),
          ])],
        }),
        defineField({
          name: 'video', title: 'Відео-попап', type: 'object',
          fields: [texts('popupVideoTexts', [S('dialogLabel', 'Назва вікна'), S('closeLabel', 'Кнопка «Закрити»'), S('frameTitle', 'Назва відео')])],
        }),
        defineField({
          name: 'world', title: 'Вікно «Детальніше» світу (WIND, ROCK, SUN)', type: 'object',
          description: 'Спільні підписи вікна. Тексти кожного світу — у блоці «Три світи» → світ → «Вікно «Детальніше»». Способи звʼязку — «Форми» → способи звʼязку.',
          fields: [texts('popupWorldTexts', [
            S('tabsLabel', 'Назва перемикача світів (для програм читання з екрана)'),
            S('aboutLabel', 'Підпис «Про секцію»'), S('commissioningLabel', 'Підпис «Введення в експлуатацію»'),
            S('accessLabel', 'Підпис «Доступ до траси»'), S('featuresLabel', 'Підпис «Ключова інфраструктура»'),
            S('formTitle', 'Заголовок форми', '{name} — назва світу: «Отримайте матеріали по {name}».'),
            T('formText', 'Текст під заголовком форми'),
            S('nameLabel', 'Підпис поля «Імʼя»'), S('phoneLabel', 'Підпис поля «Телефон»'), S('contactLegend', 'Підпис «Зручний спосіб звʼязку»'),
            S('submitLabel', 'Кнопка відправки'),
            T('consentText', 'Текст під кнопкою', '{link} — місце посилання на політику конфіденційності (Форми → Політика конфіденційності).'),
            S('consentLinkLabel', 'Текст посилання на політику'),
          ])],
        }),
        defineField({
          name: 'contact', title: 'Попап «Звʼязатися»', type: 'object',
          description: 'Відкривається кнопкою «Звʼязатися» в шапці. Поля «Імʼя» і «Телефон», підказки і тексти помилок — спільні («Форми заявки»).',
          fields: [
            texts('popupContactTexts', [
              S('dialogLabel', 'Назва вікна (для програм читання з екрана)'),
              T('title', 'Заголовок'),
              S('submitLabel', 'Кнопка відправки'),
            ]),
            photoField('image', 'Фото', { description: 'Ліворуч від форми (на телефоні — над нею, 16:9). Точка фокусу визначає, яка частина фото видна.' }),
            defineField({
              name: 'unapprovedLanguages', title: 'Переклад не затверджено', type: 'array', of: [{ type: 'string' }],
              options: { list: languages.filter((l) => l.id !== defaultLanguage).map((l) => ({ title: l.name, value: l.id })), layout: 'grid' },
              description: 'Позначте мову, переклад якої ще не перевірено. Після перевірки — зніміть позначку. На сайт не впливає.',
            }),
          ],
        }),
        defineField({
          name: 'quiz', title: 'Квіз «Розрахувати дохід»', type: 'object',
          fields: [
            texts('popupQuizTexts', [
              S('tabLabel', 'Бічна вкладка'), S('tabAriaLabel', 'Бічна вкладка (для програм читання з екрана)'), S('eyebrow', 'Надпис над кроками'),
              S('formatTitle', 'Крок 1: заголовок'), S('budgetTitle', 'Крок 2: заголовок'),
              S('messengerTitle', 'Крок 3: заголовок'), T('messengerText', 'Крок 3: текст під заголовком'),
              S('messengerGroupLabel', 'Крок 3: назва групи (для програм читання з екрана)'),
              S('formTitle', 'Крок 4: заголовок'), S('nameLabel', 'Підпис поля «Імʼя»'), S('countryLabel', 'Підпис «Код країни»'),
              S('phonePlaceholder', 'Підказка в полі телефону'),
              S('backLabel', 'Кнопка «Назад»'), S('nextLabel', 'Кнопка «Далі»'), S('submitLabel', 'Кнопка відправки'),
              S('managerName', 'Менеджер: імʼя'), S('managerRole', 'Менеджер: посада'), S('onlineLabel', 'Позначка «Онлайн» (для програм читання з екрана)'),
              T('bubbleFormat', 'Репліка менеджера, крок 1'), T('bubbleBudget', 'Репліка менеджера, крок 2'),
              T('bubbleMessenger', 'Репліка менеджера, крок 3'),
              T('bubbleContact', 'Репліка менеджера, крок 4', '{messenger} — назва обраного месенджера.'),
              S('bonusesTitle', 'Заголовок «Ваші бонуси»'), S('bonusLockedLabel', 'Бонус закритий (для програм читання з екрана)'),
              S('bonusOpenLabel', 'Бонус відкритий (для програм читання з екрана)'),
            ]),
            photoField('managerPhoto', 'Менеджер: фото', { description: 'Квадратне фото, обличчя по центру. На сайті — кружок 56 px.' }),
            defineField({
              name: 'bonuses', title: 'Бонуси', type: 'array', of: [{ type: 'quizBonus' }],
              description: 'Список «Ваші бонуси» біля менеджера. Відкриваються на кроці з формою.',
            }),
            defineField({ name: 'budgets', title: 'Варіанти бюджету', type: 'array', of: [{ type: 'quizBudget' }] }),
            defineField({ name: 'countries', title: 'Країни', type: 'array', of: [{ type: 'quizCountry' }] }),
          ],
        }),
      ],
    }),
    defineField({
      name: 'privacyPolicy', title: 'Політика конфіденційності', type: 'reference', to: [{ type: 'legalDocument' }], group: 'forms',
      description: 'Документ, на який веде посилання «політикою конфіденційності» у формах. Відкривається в новій вкладці.',
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
      name: 'seo', title: 'SEO', type: 'object', group: 'seo',
      description: 'Заголовки й описи інших сторінок — у розділі «Сторінки» (архів, «Дякуємо») і в кожному документі.',
      fields: [
        texts('seoTexts', [
          S('title', 'Заголовок вкладки головної', 'До 60 знаків — так видно в пошуку повністю.'),
          T('description', 'Опис головної для пошуковиків', 'До 160 знаків.'),
        ], { title: 'Головна сторінка' }),
        str('siteName', 'Назва сайту для соцмереж', { required: true, description: 'Підпис над карткою посилання у Facebook, Telegram тощо (og:site_name) і назва в структурованих даних. Однакова для всіх мов.' }),
        photoField('ogImage', 'Картинка для соцмереж', {
          required: false,
          description: 'Показується, коли посиланням на сайт діляться в месенджерах і соцмережах. Найкраще 1200×630 або більше; сайт сам обріже до 1200×630 за точкою фокуса. Порожньо — фото першого екрана головної.',
        }),
        defineField({
          name: 'unapprovedLanguages', title: 'SEO: переклад не затверджено', type: 'array', of: [{ type: 'string' }],
          options: { list: languages.filter((l) => l.id !== defaultLanguage).map((l) => ({ title: l.name, value: l.id })), layout: 'grid' },
          description: 'Позначте мову, SEO-тексти якої (головна, архів, «Дякуємо») ще не перевірено. Після перевірки — зніміть позначку. На сайт не впливає.',
        }),
      ],
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
