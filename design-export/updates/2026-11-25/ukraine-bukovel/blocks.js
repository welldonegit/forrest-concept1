/* FORREST — анімації появи блоків «Україна» та «Буковель».
   Елементи з data-uab / data-bvb отримують атрибут data-in, коли входять у вікно; решту робить CSS. */
(function () {
  'use strict';
  function init() {
    { const U = document.querySelector('[data-ua]'); if (U) { const bs = U.querySelectorAll('[data-uab]'); if ('IntersectionObserver' in window) { const io = new IntersectionObserver(es => es.forEach(x => { if (x.isIntersecting) { x.target.dataset.in = ''; io.unobserve(x.target); } }), { threshold: .15 }); bs.forEach(e => io.observe(e)); } else bs.forEach(e => e.dataset.in = ''); } }
    { const V = document.querySelector('[data-bv]'); if (V) { const bs = V.querySelectorAll('[data-bvb]'); if ('IntersectionObserver' in window) { const io = new IntersectionObserver(es => es.forEach(x => { if (x.isIntersecting) { x.target.dataset.in = ''; io.unobserve(x.target); } }), { threshold: .18 }); bs.forEach(e => io.observe(e)); } else bs.forEach(e => e.dataset.in = ''); } }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
