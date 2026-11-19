/**
 * Попапы (4.17): кнопки с data-popup="<имя>". С главной страницей не грузится ничего, кроме этого файла:
 * разметка и стили попапа — отдельная страница /{lang}/popup/<имя>/ (готовится при сборке из Sanity),
 * код — отдельный модуль. Оба подгружаются при первом наведении, фокусе или касании кнопки;
 * по нажатию попап открывается (если ещё грузится — сразу после загрузки).
 * Не загрузилось (нет сети) — ссылка ведёт по своему href, кнопка ничего не делает.
 */
const modules = {
  apartments: () => import('../popups/apartments.js'),
  video: () => import('../popups/video.js'),
  quiz: () => import('../popups/quiz.js'),
};
const cache = {};

function load(name) {
  if (!modules[name]) return Promise.reject(new Error(`нет попапа ${name}`));
  cache[name] ??= Promise.all([
    fetch(`/${document.documentElement.lang}/popup/${name}/`).then((r) => {
      if (!r.ok) throw new Error(`попап ${name}: ${r.status}`);
      return r.text();
    }),
    modules[name](),
  ]).then(async ([html, mod]) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    await adoptStyles(doc);
    const root = doc.querySelector('[data-popup-root]');
    document.body.append(root);
    return mod.init(root);
  });
  cache[name].catch(() => { delete cache[name]; });
  return cache[name];
}

// Стили со страницы-фрагмента переносятся в <head>; общий файл двух попапов не дублируется.
function adoptStyles(doc) {
  const waits = [];
  for (const el of doc.head.querySelectorAll('link[rel=stylesheet], style')) {
    if (el.tagName === 'LINK') {
      const href = new URL(el.getAttribute('href'), location.href).href;
      if ([...document.styleSheets].some((s) => s.href === href)) continue;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      waits.push(new Promise((ok) => { link.onload = ok; link.onerror = ok; }));
      document.head.append(link);
    } else {
      const style = document.createElement('style');
      style.textContent = el.textContent;
      document.head.append(style);
    }
  }
  return Promise.all(waits);
}

const opener = (e) => (e.target instanceof Element ? e.target.closest('[data-popup]') : null);

export function initPopups() {
  const warm = (e) => {
    const o = opener(e);
    if (o) load(o.dataset.popup).catch(() => {});
  };
  for (const type of ['pointerover', 'focusin', 'touchstart']) document.addEventListener(type, warm, { passive: true });
  // всплытие, не перехват: лента Apartments гасит щелчок после перетаскивания
  document.addEventListener('click', (e) => {
    const o = opener(e);
    if (!o || e.defaultPrevented) return;
    e.preventDefault();
    load(o.dataset.popup)
      .then((popup) => popup.open(o))
      .catch(() => { if (o.href) location.href = o.href; });
  });
}
