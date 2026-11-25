/* FORREST — квіз «Розрахунок доходу». Без залежностей.
   Відкрити: ForrestQuiz.open()  або будь-який елемент з атрибутом data-quiz-open.
   Заявка: document.addEventListener('quiz:lead', e => console.log(e.detail)) — { format, budget[], name, phone, messenger, newsletter }.
   Розмітка в quiz.html: data-if="умова" (елемент монтується/знімається), data-bind-<attr>="ключ", data-on-<event>="обробник",
   <q-t k="ключ"> (текст), <template data-for="список" data-as="item"> (повтор). Ключі обчислює qVals(). */
(function () {
  'use strict';
  var root = document.getElementById('forrest-quiz');
  if (!root) return;

  function get(p, sc) { if (p === 'true') return true; if (p === 'false') return false; return p.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, sc); }

  function compile(node) {
    node.querySelectorAll('q-t').forEach(function (q) { var tx = document.createTextNode(''); tx.__k = q.getAttribute('k'); q.replaceWith(tx); });
    node.querySelectorAll('[data-if]').forEach(function (el) { var a = document.createComment('if'); el.parentNode.insertBefore(a, el); a.__el = el; a.__if = el.getAttribute('data-if').split('&'); el.removeAttribute('data-if'); el.remove(); });
  }

  function bindEl(el, sc) {
    Array.prototype.slice.call(el.attributes).forEach(function (at) {
      var n = at.name;
      if (n.indexOf('data-bind-') === 0) { var v = get(at.value, sc); el.setAttribute(n.slice(10), v == null ? '' : String(v)); }
      else if (n.indexOf('data-on-') === 0) { var p = at.value; el['on' + n.slice(8)] = function (e) { var f = get(p, sc); if (typeof f === 'function') f(e); }; }
    });
    walk(el, sc, el.firstChild, null);
  }

  function list(t, sc) {
    var items = get(t.dataset.for, sc) || [], as = t.dataset.as, par = t.parentNode;
    if (!t.__items) {
      t.__items = []; var after = t;
      items.forEach(function () {
        var f = t.content.cloneNode(true); compile(f);
        var s = document.createComment('item'), e = document.createComment('/item');
        f.insertBefore(s, f.firstChild); f.appendChild(e);
        par.insertBefore(f, after.nextSibling); after = e; t.__items.push([s, e]);
      });
    }
    t.__items.forEach(function (it, i) { var s = Object.create(sc); s[as] = items[i]; s.$index = i; walk(par, s, it[0].nextSibling, it[1]); });
    return t.__items.length ? t.__items[t.__items.length - 1][1].nextSibling : t.nextSibling;
  }

  function walk(par, sc, c, stop) {
    while (c && c !== stop) {
      var next = c.nextSibling;
      if (c.nodeType === 8 && c.__el) {
        var el = c.__el, on = c.__if.every(function (p) { return !!get(p, sc); });
        if (on) { if (el.parentNode !== par) par.insertBefore(el, c.nextSibling); next = el.nextSibling; bindEl(el, sc); }
        else if (el.parentNode === par) { if (next === el) next = el.nextSibling; el.remove(); }
      } else if (c.nodeType === 3 && c.__k) { var v = get(c.__k, sc); c.nodeValue = v == null ? '' : String(v); }
      else if (c.nodeType === 1) { if (c.tagName === 'TEMPLATE' && c.dataset.for) next = list(c, sc); else bindEl(c, sc); }
      c = next;
    }
  }

  var form = root.querySelector('#qform');
  compile(root);

  class Quiz {
    state = {};
    setState(u) { var p = typeof u === 'function' ? u(this.state) : u; this.state = Object.assign({}, this.state, p); this.render(); }
    render() { walk(root, this.qVals(), root.firstChild, null); }
  qFmtBase = [
    { id: 'superior', name: 'Superior', area: '27,4–32,2 м²', img: './img/superior-room.jpg' },
    { id: 'deluxe', name: 'Deluxe', area: '39,6–48,3 м²', img: './img/deluxe-room.jpg' },
    { id: 'family', name: 'Family', area: '54,3–62,5 м²', img: './img/family-room.jpg' },
    { id: 'junior', name: 'Junior Suite', area: '70,5–86,9 м²', img: './img/junior-room.jpg' },
    { id: 'pres', name: 'Presidential', area: '109,5–109,7 м²', img: './img/presidential-room.jpg' },
    { id: 'none', name: 'Ще не визначився,\nпотрібна консультація', area: '', img: '' }
  ];
  qBudBase = ['До $130 000', '$130 000–$160 000', '$160 000–$200 000', 'Понад $200 000', 'Ще не визначився, хочу отримати консультацію'];
  qShow = () => { document.body.style.overflow = 'hidden'; this.setState({ qOpen: true, qClosing: false, qStep: 0, qDir: 'f', qLeave: false, qFmt: null, qBud: [], qMsg: null, qErr: {}, qC1: true, qC2: false }); };
  qHide = () => { this.setState({ qClosing: true }); clearTimeout(this.qT); this.qT = setTimeout(() => { document.body.style.overflow = ''; this.setState({ qOpen: false, qClosing: false }); }, 420); };
  qGo = n => { if (this.qBusy) return; this.qBusy = true; this.setState({ qLeave: true, qDir: n > (this.state.qStep || 0) ? 'f' : 'b' }); setTimeout(() => { this.setState({ qStep: n, qLeave: false }); this.qBusy = false; const b = document.querySelector('[data-qbody]'); if (b) b.scrollTop = 0; }, 300); };
  qVals() {
    const s = this.state, st = s.qStep || 0, bud = s.qBud || [], err = s.qErr || {};
    return {
      qOpen: !!s.qOpen, qClosing: s.qClosing ? 'yes' : 'no', qLeave: s.qLeave ? 'yes' : 'no', qDir: s.qDir || 'f',
      qS0: st === 0, qS1: st === 1, qS2: st === 2, qS3: st === 3, qS4: st === 4, qBonLock: st < 3, qBonOpen: st >= 3, qShowBar: st < 4, qFoot: st >= 1 && st <= 3, qCount: '0' + Math.min(st + 1, 4) + ' / 04',
      qP1: s.qOpen ? 'yes' : 'no', qP2: st >= 1 ? 'yes' : 'no', qP3: st >= 2 ? 'yes' : 'no', qP4: st >= 3 ? 'yes' : 'no',
      qOpenFn: e => { if (e) e.preventDefault(); this.qShow(); }, qCloseFn: () => this.qHide(), qBack: () => this.qGo(Math.max(0, st - 1)),
      qFormats: this.qFmtBase.map(f => ({ ...f, alt: 'Апартаменти ' + f.name, hasImg: !!f.img, noImg: !f.img, sel: s.qFmt === f.id ? 'yes' : 'no', selB: s.qFmt === f.id ? 'true' : 'false', pick: () => { this.setState({ qFmt: f.id }); clearTimeout(this.qA); this.qA = setTimeout(() => this.qGo(1), 420); } })),
      qBuds: this.qBudBase.map((t, i) => ({ t, sel: bud.includes(i) ? 'yes' : 'no', selB: bud.includes(i) ? 'true' : 'false', toggle: () => this.setState(p => { const a = new Set(p.qBud || []); if (a.has(i)) a.delete(i); else a.add(i); return { qBud: [...a] }; }) })),
      qMsgTg: () => { this.setState({ qMsg: 'Telegram' }); clearTimeout(this.qA); this.qA = setTimeout(() => this.qGo(3), 420); }, qMsgTgS: s.qMsg === 'Telegram' ? 'yes' : 'no', qMsgTgB: s.qMsg === 'Telegram' ? 'true' : 'false', qMsgVb: () => { this.setState({ qMsg: 'Viber' }); clearTimeout(this.qA); this.qA = setTimeout(() => this.qGo(3), 420); }, qMsgVbS: s.qMsg === 'Viber' ? 'yes' : 'no', qMsgVbB: s.qMsg === 'Viber' ? 'true' : 'false', qMsgWa: () => { this.setState({ qMsg: 'WhatsApp' }); clearTimeout(this.qA); this.qA = setTimeout(() => this.qGo(3), 420); }, qMsgWaS: s.qMsg === 'WhatsApp' ? 'yes' : 'no', qMsgWaB: s.qMsg === 'WhatsApp' ? 'true' : 'false', qMsgOk: s.qMsg ? 'yes' : 'no', qMsgNext: () => { if (s.qMsg) this.qGo(3); }, qBub3: 'Залишився останній крок: залиште номер, і я надішлю розрахунок у ' + (s.qMsg || 'месенджер'), qThanks: 'Менеджер надішле фінмодель, планування та умови оплати у ' + (s.qMsg || 'месенджер') + ' найближчим часом.', qBudOk: bud.length ? 'yes' : 'no', qBudNext: () => { if (bud.length) this.qGo(2); },
      qCode: s.qCode || '+380', qIsUA: (s.qCode || '+380') === '+380', qCodeChange: e => this.setState({ qCode: e.target.value }),
      qC1: s.qC1 === false ? 'no' : 'yes', qC1B: s.qC1 === false ? 'false' : 'true', qC2: s.qC2 ? 'yes' : 'no', qC2B: s.qC2 ? 'true' : 'false',
      qC1Toggle: e => { if (e.target.closest('a')) return; this.setState(p => ({ qC1: p.qC1 === false, qErr: { ...(p.qErr || {}), c1: false } })); }, qC2Toggle: () => this.setState(p => ({ qC2: !p.qC2 })),
      qErrPhone: !!err.phone, qErrPhoneA: err.phone ? 'yes' : 'no', qErrC1: !!err.c1,
      qPhoneIn: () => { if (err.phone) this.setState({ qErr: { ...err, phone: false } }); },
      qSubmit: e => { e.preventDefault(); const f = e.currentTarget; const ph = (f.elements.phone.value || '').replace(/\D/g, ''); const ne = { phone: ph.length < 9, c1: false }; if (ne.phone || ne.c1) { this.setState({ qErr: ne }); return; } this.qLead = { format: s.qFmt, budget: bud.map(i => this.qBudBase[i]), name: f.elements.name.value, phone: (s.qCode || '+380') + ' ' + f.elements.phone.value, messenger: s.qMsg, newsletter: !!s.qC2 }; this.setState({ qErr: {} }); this.qGo(4); root.dispatchEvent(new CustomEvent('quiz:lead', { detail: this.qLead, bubbles: true })); }
    };
  }
  }

  var quiz = new Quiz();
  quiz.render();
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && quiz.state.qOpen) quiz.qHide(); });
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-quiz-open]'); if (b) { e.preventDefault(); api.open(); } });
  var api = window.ForrestQuiz = {
    open: function () { if (form) form.reset(); quiz.qShow(); },
    close: function () { quiz.qHide(); }
  };
})();
