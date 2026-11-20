import { trackAttribution } from './ui/attribution.js';
import { initMenu } from './ui/menu.js';
import { initLangSwitch } from './ui/lang-switch.js';
import { initAnchorNav } from './ui/anchor-nav.js';
import { initHero } from './ui/hero.js';
import { initSwipeHints } from './ui/swipe-hint.js';
import { initApartments } from './ui/apartments.js';
import { initFooter } from './ui/footer.js';
import { initWorlds } from './ui/worlds.js';
import { initLocation } from './ui/location.js';
import { initAnimations } from './anim/core.js';
import { whenNear } from './ui/lazy.js';
import { initPopups } from './ui/popups.js';

// источник визита (UTM) — первым и на любой странице: cookie gp_utm читает сервер при заявке
trackAttribution();
// попапы — до якорей: вкладка «Розрахувати дохід» (ссылка #forma) открывает квиз, а не прокрутку
initPopups();
initMenu();
initLangSwitch();
initAnchorNav();
initHero();
initSwipeHints();
initApartments();
initFooter();
initWorlds();
initLocation();
initAnimations();

// Дальние блоки: код подгружается и запускается, когда блок подходит к экрану (ui/lazy.js).
whenNear('[data-lead-section]', (el) => import('./ui/lead-form.js').then((m) => m.initLeadForms(el)));
whenNear('.infra', (el) => import('./ui/infra.js').then((m) => m.initInfra(el)));
whenNear('[data-calc]', (el) => import('./ui/numbers.js').then((m) => m.initNumbers(el)));
whenNear('[data-ct]', (el) => import('./ui/construction.js').then((m) => m.initConstruction(el)));
whenNear('[data-ct-archive] [data-ct-item]', (el) => import('./ui/construction.js').then((m) => m.initConstructionItem(el)));
whenNear('[data-team]', (el) => import('./ui/team.js').then((m) => m.initTeam(el)));
whenNear('[data-faq]', (el) => import('./ui/faq.js').then((m) => m.initFaq(el)));
