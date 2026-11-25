/* FORREST — попапи секцій WIND / ROCK / SUN. Без залежностей.
   Відкрити: ForrestSections.open(0|1|2)  або будь-який елемент з атрибутом data-section-open="0|1|2".
   Заявка: document.addEventListener('section:lead', e => console.log(e.detail)) — { section, name, phone, contact }. */
(function () {
  'use strict';
  var m = document.querySelector('[data-hs=zmodal]');
  if (!m) return;
  var names = ['WIND', 'ROCK', 'SUN'], sent = [], last = null;
  function set(w) {
    m.setAttribute('data-zw', String(w)); m.setAttribute('aria-label', names[w]);
    m.querySelectorAll('[data-hs=zmtab]').forEach(function (t) { t.setAttribute('aria-selected', String(+t.dataset.w === w)); });
  }
  function open(w) {
    w = Math.max(0, Math.min(2, +w || 0)); last = document.activeElement; set(w);
    document.documentElement.style.overflow = 'hidden';
    m.setAttribute('aria-hidden', 'false'); m.setAttribute('data-zopen', 'yes');
    var x = m.querySelector('[data-hs=zmx]'); if (x) setTimeout(function () { x.focus({ preventScroll: true }); }, 50);
  }
  function close() {
    m.setAttribute('data-zopen', 'no'); m.setAttribute('aria-hidden', 'true');
    document.documentElement.style.overflow = '';
    if (last && last.focus) last.focus({ preventScroll: true });
  }
  m.querySelectorAll('[data-zclose]').forEach(function (el) { el.addEventListener('click', close); });
  m.querySelectorAll('[data-zopen-w]').forEach(function (el) { el.addEventListener('click', function () { set(+el.dataset.zopenW); }); });
  m.querySelectorAll('[data-hs=zmform]').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault(); var w = +f.dataset.w, fd = new FormData(f), c = f.querySelector('input[type=radio]:checked');
      if (sent.indexOf(w) < 0) sent.push(w);
      m.setAttribute('data-zsent', sent.map(function (i) { return 'w' + i; }).join(' '));
      m.dispatchEvent(new CustomEvent('section:lead', { bubbles: true, detail: { section: names[w], name: fd.get('name'), phone: fd.get('phone'), contact: c ? c.value : '' } }));
    });
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && m.getAttribute('data-zopen') === 'yes') close(); });
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-section-open]'); if (b) { e.preventDefault(); open(b.getAttribute('data-section-open')); } });
  window.ForrestSections = { open: open, close: close };
})();
