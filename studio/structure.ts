/** Меню админки: разделы в порядке, утверждённом в плане этапа 3. */
import type { StructureResolver } from 'sanity/structure';

export const structure: StructureResolver = (S) =>
  S.list()
    .title('Вміст сайту')
    .items([
      S.listItem()
        .title('Головна сторінка')
        .id('landing')
        .child(S.document().schemaType('landing').documentId('landing').title('Головна сторінка')),
    ]);
