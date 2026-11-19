/**
 * Админка FORREST Trinity Resort (Sanity Studio). Языки — из src/lib/languages.ts
 * (тот же файл читает сайт): новый язык = одна строка там.
 */
import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { internationalizedArray } from 'sanity-plugin-internationalized-array';
import { ukUALocale } from '@sanity/locale-uk-ua';
import { languages, defaultLanguage } from '../src/lib/languages';
import { schemaTypes, singletonTypes } from './schemaTypes';
import { groupTypes } from './schemaTypes/lib/i18n';
import { structure } from './structure';

export default defineConfig({
  name: 'default',
  title: 'FORREST Trinity Resort',
  projectId: 'rxw30lco',
  dataset: 'production',
  plugins: [
    structureTool({ structure }),
    internationalizedArray({
      languages: languages.map((l) => ({ id: l.id, title: l.name })),
      defaultLanguages: [defaultLanguage],
      fieldTypes: ['string', 'text', ...groupTypes.map((t) => t.name)],
      buttonLocations: ['field'],
      languageDisplay: 'titleAndCode',
    }),
    ukUALocale(),
  ],
  schema: {
    types: schemaTypes,
    // Одиночные документы не создаются из меню «Створити».
    templates: (templates) => templates.filter(({ schemaType }) => !singletonTypes.has(schemaType)),
  },
  document: {
    // Одиночные документы нельзя удалить или продублировать: только правка и публикация.
    actions: (actions, { schemaType }) =>
      singletonTypes.has(schemaType)
        ? actions.filter(({ action }) => action && ['publish', 'discardChanges', 'restore'].includes(action))
        : actions,
  },
});
