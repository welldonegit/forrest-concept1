/**
 * Тексты блоков «Переваги інвестування в Україну», «Фото між блоками», «Буковель»
 * (выгрузка 2026-11-25, design-export/updates/2026-11-25/ukraine-bukovel/blocks.html).
 * uk — из выгрузки дословно; en — перевод разработчика, НЕ УТВЕРЖДЁН (docs/ROADMAP.md, решения).
 * Читают: studio/import/ukraine-bukovel-2026-11-25.mjs (запись в Sanity) и src/content-fixtures (тестовая сборка).
 * Блоки видны только на en (languages: ['en']); uk хранится для редактора и на будущее.
 */
export const LANGUAGES = ['en'];

export const UKRAINE = {
  anchor: 'chomu-ukraina',
  title: [
    { uk: 'Переваги інвестування', en: 'Benefits of investing' },
    { uk: 'в Україну', en: 'in Ukraine', muted: true },
  ],
  lead: {
    uk: 'Відновлення України формує один із найбільших інвестиційних ринків Європи. Світовий банк оцінює потреби у відбудові майже у $588 млрд, а до 40% необхідного капіталу потенційно може забезпечити приватний сектор.',
    en: 'Ukraine’s recovery is shaping one of the largest investment markets in Europe. The World Bank estimates reconstruction needs at almost $588 billion, and up to 40% of the required capital could potentially come from the private sector.',
  },
  cards: [
    {
      key: 'c1', value: '$588', visual: 'none',
      uk: { unit: 'млрд', title: 'Потреби у відновленні', text: 'Масштаб відбудови створює довгостроковий попит на приватний капітал та нові активи.' },
      en: { unit: 'bn', title: 'Recovery needs', text: 'The scale of reconstruction creates long-term demand for private capital and new assets.' },
    },
    {
      key: 'c2', value: '40%', visual: 'bar', barPercent: 40,
      uk: { prefix: 'до', title: 'Роль приватного капіталу', text: 'Приватні інвестиції мають стати важливою частиною відновлення України.' },
      en: { prefix: 'up to', title: 'The role of private capital', text: 'Private investment is set to become an important part of Ukraine’s recovery.' },
    },
    {
      key: 'c3', visual: 'stars', dark: true,
      uk: { title: 'Європейська інтеграція', text: 'ЄС уже створює окремі механізми для залучення та зниження ризиків приватних інвестицій в Україну.' },
      en: { title: 'European integration', text: 'The EU is already creating dedicated mechanisms to attract private investment in Ukraine and reduce its risks.' },
    },
  ],
};

export const PHOTO = {
  file: 'bukovel-hills.jpg',
  hotspot: { x: 0.5, y: 0.5 },
  alt: { uk: 'Карпатські полонини та ліси поблизу Буковеля', en: 'Carpathian meadows and forests near Bukovel' },
};

export const BUKOVEL = {
  anchor: 'chomu-bukovel',
  title: [
    { uk: 'Буковель.', en: 'Bukovel.' },
    { uk: 'Сформований попит упродовж року', en: 'Established year-round demand', muted: true },
  ],
  lead: {
    uk: 'Буковель давно працює ширше за зимовий курорт: гірськолижний сезон доповнюють літній відпочинок, wellness, сімейні подорожі та подієві формати. У I кварталі 2026 року Поляницька громада зафіксувала майже 400 тис. туристичних ночівель, що на 22% більше рік до року.',
    en: 'Bukovel has long been more than a winter resort: the ski season is complemented by summer holidays, wellness, family trips and events. In Q1 2026, the Polianytsia community recorded almost 400 thousand tourist overnight stays, 22% more year on year.',
  },
  rows: [
    {
      key: 'r1', value: '≈3',
      uk: { unit: 'млн', title: 'Туристів щороку', text: 'Буковель уже має сформований масштабний туристичний потік.' },
      en: { unit: 'million', title: 'Tourists every year', text: 'Bukovel already has a large, established flow of tourists.' },
    },
    {
      key: 'r2', value: '186',
      uk: { unit: 'тис.', title: 'Туристичних ночівель у II кварталі 2026', text: 'Поляницька громада, де розташований Буковель, зафіксувала 186 227 ночівель у квітні–червні 2026 року, це +4,5% до аналогічного періоду 2025 року.' },
      en: { unit: 'thousand', title: 'Tourist overnight stays in Q2 2026', text: 'The Polianytsia community, where Bukovel is located, recorded 186,227 overnight stays in April–June 2026, +4.5% on the same period of 2025.' },
    },
    {
      key: 'r3', value: '7',
      uk: { unit: 'хв', title: 'FORREST — всередині цього попиту', text: '7 хвилин до центру, Ski In / Ski Out та три аудиторії Adults / Business / Family.' },
      en: { unit: 'min', title: 'FORREST — right inside this demand', text: '7 minutes to the centre, Ski In / Ski Out and three audiences: Adults / Business / Family.' },
    },
  ],
};
