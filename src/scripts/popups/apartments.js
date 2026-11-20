/**
 * Попап апартамента (4.17), как в выгрузке (openPlan / fly / closePlan):
 * - открытие: секция Apartments чуть увеличивается и размывается от центра карточки, фото карточки
 *   «перелетает» в кадр попапа, подложка проявляется; через 650 мс проявляются текст и кадр;
 * - закрытие: текст и кадр гаснут, фото улетает обратно в карточку, секция возвращается;
 * - слайды: стрелки, точки, клавиши ← →, свайп 40 px; последний слайд — «Планування».
 * В выгрузке перелёт анимирует left/top/width/height и border-radius. Здесь тот же путь и та же кривая
 * собраны из transform и clip-path (кадры считаются в JS): снаружи — сдвиг и масштаб от кадра попапа
 * к карточке, внутри — обратный масштаб, чтобы фото оставалось «cover» без искажений,
 * скругление — clip-path с поправкой на масштаб. Вид тот же.
 * prefers-reduced-motion: окно сразу в конечном состоянии, без перелёта и размытия.
 */
import { createModal } from './dialog.js';
import { cssEase, cssNum } from './ease.js';
import { formatPhone, setError, PHONE_DIGITS } from '../ui/form-fields.js';
import { preloadCaptcha } from '../ui/captcha.js';
import { leadSender, pushLeadEvent } from '../ui/lead-api.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const STEPS = 48;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const lerp = (a, b, p) => a + (b - a) * p;

export function init(dlg) {
  const panels = [...dlg.querySelectorAll('[data-apop-panel]')].map(initPanel);
  const fly = dlg.querySelector('[data-apop-fly]');
  const flyImg = fly.querySelector('img');
  const t = (name) => cssNum(dlg, name);
  let panel = null;
  let card = null;
  let section = null;
  let timer = 0;
  let anims = [];

  const modal = createModal(dlg, { beforeClose: animateOut, onClosed: reset });

  dlg.addEventListener('keydown', (e) => {
    if (!panel || e.target.closest('input, select, textarea')) return;
    if (e.key === 'ArrowRight') panel.step(1);
    else if (e.key === 'ArrowLeft') panel.step(-1);
  });

  function stopAnims() {
    anims.forEach((a) => a.cancel());
    anims = [];
  }

  // Кадры перелёта: коробка от прямоугольника from к to (обе — экранные), контейнер стоит в C (кадр попапа).
  function flight(from, to, rFrom, rTo, dur, imgDur, ease, zFrom, zTo) {
    const C = panel.frame.getBoundingClientRect();
    const iw = flyImg.naturalWidth || C.width;
    const ih = flyImg.naturalHeight || C.height;
    const c0 = Math.max(C.width / iw, C.height / ih);
    Object.assign(fly.style, { left: `${C.left}px`, top: `${C.top}px`, width: `${C.width}px`, height: `${C.height}px` });
    Object.assign(flyImg.style, {
      width: `${iw * c0}px`, height: `${ih * c0}px`,
      left: `${(C.width - iw * c0) / 2}px`, top: `${(C.height - ih * c0) / 2}px`,
    });
    const total = Math.max(dur, imgDur);
    const outer = [];
    const inner = [];
    for (let k = 0; k <= STEPS; k++) {
      const time = (k / STEPS) * total;
      const p = ease(Math.min(time / dur, 1));
      const z = lerp(zFrom, zTo, ease(Math.min(time / imgDur, 1)));
      const w = lerp(from.width, to.width, p);
      const h = lerp(from.height, to.height, p);
      const sx = w / C.width;
      const sy = h / C.height;
      const r = lerp(rFrom, rTo, p);
      const cover = Math.max(w / iw, h / ih);
      outer.push({
        offset: k / STEPS,
        transform: `translate(${lerp(from.left, to.left, p) - C.left}px, ${lerp(from.top, to.top, p) - C.top}px) scale(${sx}, ${sy})`,
        clipPath: `inset(0 round ${r / sx}px / ${r / sy}px)`,
      });
      inner.push({ offset: k / STEPS, transform: `scale(${(cover / (sx * c0)) * z}, ${(cover / (sy * c0)) * z})` });
    }
    fly.dataset.on = '';
    const a = fly.animate(outer, { duration: total, fill: 'forwards' });
    anims.push(a, flyImg.animate(inner, { duration: total, fill: 'forwards' }));
    return a;
  }

  function sectionFocus(on) {
    if (!section || reduce.matches) return;
    if (on) {
      const r = card.getBoundingClientRect();
      const s = section.getBoundingClientRect();
      section.style.setProperty('--apop-origin', `${r.left + r.width / 2 - s.left}px ${r.top + r.height / 2 - s.top}px`);
      section.dataset.popBg = 'in';
    } else if (section.dataset.popBg === 'in') {
      section.dataset.popBg = 'out';
      const sec = section;
      setTimeout(() => { if (sec.dataset.popBg === 'out') delete sec.dataset.popBg; }, t('--apop-section-dur') * 1000);
    }
  }

  function open(opener) {
    const i = Number(opener.dataset.planOpen) || 0;
    const el = opener.closest('[data-apts-card]');
    card = el?.querySelector('.apts__media') ?? null;
    section = opener.closest('[data-apts]');
    panels.forEach((p, k) => { p.el.hidden = k !== i; });
    panel = panels[i];
    panel.go(0);
    dlg.setAttribute('aria-label', panel.el.dataset.dialogLabel);
    const back = opener.matches('button') ? opener : el?.querySelector('button[data-plan-open]');
    stopAnims();
    modal.open(back ?? opener);

    const photo = card?.querySelector('img');
    if (reduce.matches || !photo) {
      dlg.dataset.open = '';
      dlg.dataset.ready = '';
      return;
    }
    flyImg.src = photo.currentSrc || photo.src;
    const A = card.getBoundingClientRect();
    const C = panel.frame.getBoundingClientRect();
    const rA = parseFloat(getComputedStyle(card).borderTopLeftRadius) || 0;
    const rC = parseFloat(getComputedStyle(panel.frame).borderTopLeftRadius) || 0;
    sectionFocus(true);
    requestAnimationFrame(() => {
      dlg.dataset.open = '';
      const a = flight(A, C, rA, rC, t('--apop-fly-in'), t('--apop-fly-img-in'), cssEase(dlg, '--ease-out-expo'), t('--apop-fly-zoom-in'), 1);
      clearTimeout(timer);
      timer = setTimeout(() => { dlg.dataset.ready = ''; }, t('--apop-ready-delay'));
      const flyIn = t('--apop-fly-in');
      a.finished.then(() => wait(t('--apop-fly-hide') - (a.effect.getTiming().duration - flyIn))).then(() => {
        if (a.playState === 'finished') delete fly.dataset.on;
      }).catch(() => {});
    });
  }

  function animateOut() {
    clearTimeout(timer);
    delete dlg.dataset.ready;
    delete dlg.dataset.open;
    sectionFocus(false);
    if (reduce.matches) return undefined;
    stopAnims();
    if (!card || !card.isConnected || !card.getClientRects().length) return wait(t('--apop-back-out'));
    const A = card.getBoundingClientRect();
    const C = panel.frame.getBoundingClientRect();
    const rA = parseFloat(getComputedStyle(card).borderTopLeftRadius) || 0;
    const rC = parseFloat(getComputedStyle(panel.frame).borderTopLeftRadius) || 0;
    const out = t('--apop-fly-out');
    const a = flight(C, A, rC, rA, out, out, cssEase(dlg, '--apop-fly-out-ease'), 1, t('--apop-fly-zoom-out'));
    return a.finished.catch(() => {});
  }

  function reset() {
    clearTimeout(timer);
    stopAnims();
    delete fly.dataset.on;
    delete dlg.dataset.ready;
    delete dlg.dataset.open;
    sectionFocus(false);
    panel = null;
  }

  return { open };
}

function initPanel(el) {
  const frame = el.querySelector('[data-apop-frame]');
  const slides = [...frame.querySelectorAll('[data-apop-slide]')];
  const dots = [...frame.querySelectorAll('[data-apop-dot]')];
  let cur = 0;

  function go(k) {
    cur = (k + slides.length) % slides.length;
    slides.forEach((s, j) => {
      s.toggleAttribute('data-on', j === cur);
      if (j === cur) s.removeAttribute('aria-hidden'); else s.setAttribute('aria-hidden', 'true');
    });
    dots.forEach((d, j) => d.setAttribute('aria-pressed', String(j === cur)));
    frame.toggleAttribute('data-on-plan', slides[cur].hasAttribute('data-plan'));
  }
  const step = (d) => go(cur + d);

  frame.querySelectorAll('[data-apop-step]').forEach((b) => b.addEventListener('click', () => step(Number(b.dataset.apopStep))));
  dots.forEach((d, j) => d.addEventListener('click', () => go(j)));
  let x0 = null;
  frame.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  frame.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    x0 = null;
    if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1);
  });

  // «Дізнатись ціну»: та же проверка телефона и те же тексты ошибок, что у форм (form-fields.js)
  const form = el.querySelector('[data-apop-form]');
  const tel = form.elements.phone;
  tel.addEventListener('input', () => {
    tel.value = formatPhone(tel.value);
    setError(tel, false);
  });
  // Отправка — POST /api/lead (lead-api.js). Успех: form.dataset.sent, текст кнопки из data-success-label,
  // кнопка неактивна; ошибка — текст в [data-form-status], номер остаётся в поле.
  preloadCaptcha().catch(() => {});
  const send = leadSender(form, 'apartment');
  const apartment = el.querySelector('.apop__name')?.textContent.trim();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if ('sent' in form.dataset) return;
    const digits = tel.value.replace(/\D/g, '').length;
    const bad = digits < PHONE_DIGITS;
    setError(tel, bad, digits ? 'invalid' : 'required');
    if (bad) { tel.focus(); return; }
    const result = await send({ fields: { phone: tel.value, apartment: apartment || undefined } });
    if (!result) return;
    pushLeadEvent('apartment');
    const btn = form.querySelector('button[type=submit]');
    form.dataset.sent = '';
    btn.textContent = btn.dataset.successLabel;
    btn.disabled = true;
  });

  return { el, frame, go, step };
}
