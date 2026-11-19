import { photo } from './objects/photo.ts';
import { svgIcon } from './objects/svgIcon.ts';
import { blockTypes, blockObjectTypes } from './blocks/index.ts';
import { landing } from './documents/landing.ts';
import { siteSettings, navLink, socialLink, footerGroup, quizBudget, quizCountry } from './documents/siteSettings.ts';
import { constructionReport, reportWork, apartmentFormat, formatTag, pricing, pricingFormat, pricingPayment } from './documents/catalog.ts';
import { groupTypes } from './lib/i18n.ts';

/** Документы в одном экземпляре: без «создать», «удалить», «дублировать». */
export const singletonTypes = new Set(['landing', 'siteSettings', 'pricing']);

export const schemaTypes = [
  landing, constructionReport, apartmentFormat, pricing, siteSettings,
  ...blockTypes, ...blockObjectTypes,
  reportWork, formatTag, pricingFormat, pricingPayment,
  navLink, socialLink, footerGroup, quizBudget, quizCountry,
  photo, svgIcon,
  ...groupTypes,
];
