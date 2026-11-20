/** Меню админки: разделы в порядке, утверждённом в плане этапа 3. */
import type { StructureResolver } from 'sanity/structure';

const singleton = (S: Parameters<StructureResolver>[0], type: string, title: string) =>
  S.listItem().title(title).id(type).child(S.document().schemaType(type).documentId(type).title(title));

export const structure: StructureResolver = (S) =>
  S.list()
    .title('Вміст сайту')
    .items([
      singleton(S, 'landing', 'Головна сторінка'),
      S.listItem()
        .title('Хід будівництва')
        .id('constructionReport')
        .child(
          S.documentTypeList('constructionReport')
            .title('Звіти по місяцях')
            .defaultOrdering([{ field: 'date', direction: 'desc' }]),
        ),
      S.documentTypeListItem('apartmentFormat').title('Формати апартаментів'),
      singleton(S, 'pricing', 'Ціни та дохідність'),
      S.documentTypeListItem('legalDocument').title('Документи'),
      singleton(S, 'siteSettings', 'Налаштування сайту'),
    ]);
