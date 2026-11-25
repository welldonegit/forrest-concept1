/** Блоки главной — в порядке сайта. Имя типа = имя Astro-компонента (CLAUDE.md). */
import { stats, statsCard } from './stats.ts';
import { hero, heroTitleLine, skylinePoint } from './hero.ts';
import { season, seasonTitleLine, worlds, worldsTitleLine, world, worldFeature, model, modelStep } from './story.ts';
import { apartments, apartmentsTitleLine, apartmentItem, form, formTitleLine, formBullet, formFinal, choiceOption } from './sales.ts';
import { location, locationTitleLine, locationPin, locationFact, locationChip, infrastructure, infraTitleLine, infraItem } from './place.ts';
import { numbers, numbersTitleLine, numbersStep, investorService, serviceTitleLine, serviceItem, dashNavItem, dashAxisItem, dashKpi, dashReport, dashStay } from './money.ts';
import { whyUkraine, whyUkraineCard, photoBand, whyBukovel, whyBukovelRow, whyTitleLine } from './why.ts';
import { construction, team, teamMember, teamStat, faq, faqTitleLine, faqDoc, faqItem } from './about.ts';

export const blockTypes = [hero, stats, whyUkraine, photoBand, whyBukovel, season, worlds, model, apartments, form, location, infrastructure, numbers, investorService, construction, team, faq, formFinal];

export const blockObjectTypes = [
  statsCard, heroTitleLine, skylinePoint, seasonTitleLine, worldsTitleLine, world, worldFeature, modelStep,
  apartmentsTitleLine, apartmentItem, formTitleLine, formBullet, choiceOption,
  locationTitleLine, locationPin, locationFact, locationChip, infraTitleLine, infraItem,
  numbersTitleLine, numbersStep, serviceTitleLine, serviceItem, dashNavItem, dashAxisItem, dashKpi, dashReport, dashStay,
  teamMember, teamStat, faqTitleLine, faqDoc, faqItem,
  whyTitleLine, whyUkraineCard, whyBukovelRow,
];
