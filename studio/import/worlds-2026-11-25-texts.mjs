/**
 * Тексты окна «Детальніше» миров (выгрузка 2026-11-25, design-export/updates/2026-11-25/section-popups/).
 * uk — из выгрузки дословно; en — перевод разработчика, НЕ УТВЕРЖДЁН (docs/ROADMAP.md, решения).
 * Читают: studio/import/worlds-2026-11-25.mjs (запись в Sanity) и src/content-fixtures (тестовая сборка).
 */
export const WORLD_TEXTS = {
  wind: {
    uk: {
      about: 'Преміальний Adults Only-простір для гостей, які цінують приватність, тишу та відновлення. Комерційно секція орієнтована на платоспроможну аудиторію, короткі преміальні заїзди та попит у різні сезони, що підсилює потенціал стабільного завантаження протягом року.',
      commissioning: 'IV квартал 2028 року',
      access: 'Ski In / Ski Out, 5G',
    },
    en: {
      about: 'A premium Adults Only space for guests who value privacy, quiet and recovery. Commercially, the section targets an affluent audience, short premium stays and demand across different seasons, which strengthens the potential for stable year-round occupancy.',
      commissioning: 'Q4 2028',
      access: 'Ski In / Ski Out, 5G',
    },
    features: [
      ['Adults Only', 'Adults Only'],
      ['прямий Ski In / Ski Out до траси 5G', 'direct Ski In / Ski Out to slope 5G'],
      ['Biohacking & Recovery Center', 'Biohacking & Recovery Center'],
      ['SPA та wellness', 'SPA and wellness'],
      ['Rooftop Pool', 'Rooftop Pool'],
      ['ресторан і бар', 'restaurant and bar'],
      ['mini-coworking', 'mini-coworking'],
      ['переговорні кімнати', 'meeting rooms'],
      ['premium recovery services', 'premium recovery services'],
      ['підземний і гостьовий паркінг', 'underground and guest parking'],
    ],
  },
  rock: {
    uk: {
      about: 'Секція створена для ділової аудиторії, корпоративних команд, подій і професійних спільнот. Її ключова перевага для інвестора — окремий B2B-сценарій попиту, який допомагає залучати гостей не лише у високий туристичний сезон, а й у традиційно слабші періоди року.',
      commissioning: '2030 рік',
      access: 'Ski In / Ski Out, 5G',
    },
    en: {
      about: 'The section is designed for business guests, corporate teams, events and professional communities. Its key advantage for an investor is a separate B2B demand scenario that helps attract guests not only in the peak tourist season, but also in traditionally slower periods of the year.',
      commissioning: '2030',
      access: 'Ski In / Ski Out, 5G',
    },
    features: [
      ['прямий Ski In / Ski Out до траси 5G', 'direct Ski In / Ski Out to slope 5G'],
      ['конференц-зона', 'conference area'],
      ['MICE-простори', 'MICE spaces'],
      ['медійний центр', 'media centre'],
      ['streaming-ready інфраструктура', 'streaming-ready infrastructure'],
      ['коворкінг', 'coworking'],
      ['переговорні кімнати', 'meeting rooms'],
      ['padel-корт', 'padel court'],
      ['rooftop', 'rooftop'],
      ['ресторани', 'restaurants'],
      ['фітнес-центр', 'fitness centre'],
      ['простори для приватних і корпоративних подій', 'spaces for private and corporate events'],
    ],
  },
  sun: {
    uk: {
      about: 'Сімейний формат для відпочинку кількох поколінь, розрахований на довші заїзди та повторні візити. Для інвестора це сегмент із потенціалом стабільного family-попиту протягом року завдяки канікулам, святковим періодам і звичці родин повертатися у комфортні для них місця.',
      commissioning: '2030 рік',
      access: 'Ski In / Ski Out, 5G',
    },
    en: {
      about: 'A family format for multi-generation holidays, designed for longer stays and repeat visits. For an investor, this is a segment with potential for stable year-round family demand thanks to school holidays, festive periods and families’ habit of returning to places where they feel comfortable.',
      commissioning: '2030',
      access: 'Ski In / Ski Out, 5G',
    },
    features: [
      ['прямий Ski In / Ski Out до траси 5G', 'direct Ski In / Ski Out to slope 5G'],
      ['сімейні апартаменти', 'family apartments'],
      ['multi-room формати', 'multi-room formats'],
      ['дитячий центр', 'kids’ centre'],
      ['SPA на два поверхи', 'two-storey SPA'],
      ['басейни', 'swimming pools'],
      ['скалодром', 'climbing wall'],
      ['мотузковий майданчик', 'rope park'],
      ['family-активності', 'family activities'],
      ['дитячі програми', 'kids’ programmes'],
      ['сімейний ресторан', 'family restaurant'],
      ['rooftop', 'rooftop'],
      ['паркінг і сімейна логістика', 'parking and family logistics'],
    ],
  },
};

/** «Налаштування сайту» → Попапи → «Вікно «Детальніше» світу». {name} — название мира, {link} — ссылка на политику. */
export const POPUP_TEXTS = {
  uk: {
    tabsLabel: 'Секції',
    aboutLabel: 'Про секцію',
    commissioningLabel: 'Введення в експлуатацію',
    accessLabel: 'Доступ до траси',
    featuresLabel: 'Ключова інфраструктура',
    formTitle: 'Отримайте матеріали по {name}',
    formText: 'Актуальні планування, доступні апартаменти, умови придбання та персональний розрахунок прогнозованої дохідності.',
    nameLabel: 'Ім’я',
    phoneLabel: 'Телефон',
    contactLegend: 'Зручний спосіб зв’язку',
    submitLabel: 'Отримати матеріали та розрахунок',
    consentText: 'Натискаючи кнопку, ви погоджуєтесь з {link}.',
    consentLinkLabel: 'політикою конфіденційності',
  },
  en: {
    tabsLabel: 'Sections',
    aboutLabel: 'About the section',
    commissioningLabel: 'Completion',
    accessLabel: 'Slope access',
    featuresLabel: 'Key amenities',
    formTitle: 'Get the {name} materials',
    formText: 'Current floor plans, available apartments, purchase terms and a personal projected yield calculation.',
    nameLabel: 'Name',
    phoneLabel: 'Phone',
    contactLegend: 'Preferred contact method',
    submitLabel: 'Get materials and calculation',
    consentText: 'By clicking the button, you agree to the {link}.',
    consentLinkLabel: 'privacy policy',
  },
};
