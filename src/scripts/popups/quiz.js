/**
 * Квиз «Розрахувати дохід» (4.17), как в выгрузке (qShow / qGo / qHide):
 * шаг 1 — формат (выбор и через 420 мс следующий шаг), шаг 2 — бюджет (несколько вариантов, «Далі»
 * доступна после выбора), шаг 3 — контакты, затем «Дякуємо». При каждом открытии — с начала.
 * Переход: текущий шаг гаснет (300 мс), новый появляется по элементам; «Назад» — сверху вниз.
 * Проверка контактов — общие правила и тексты ошибок форм (form-fields.js, siteSettings.form.errors):
 * пустой или неполный телефон, нет согласия. Расчёт — calc() калькулятора Numbers с его числами.
 * prefers-reduced-motion: без анимаций, шаги сменяются сразу.
 */
import { createModal } from './dialog.js';
import { cssNum } from './ease.js';
import { formatNational, nationalOk, setError } from '../ui/form-fields.js';
import { calc } from '../../lib/calc';

export function init(dlg) {
  const t = (name) => cssNum(dlg, name);
  const body = dlg.querySelector('[data-quiz-body]');
  const steps = [...dlg.querySelectorAll('[data-quiz-step]')];
  const fills = [...dlg.querySelectorAll('[data-quiz-fill]')];
  const count = dlg.querySelector('[data-quiz-count]');
  const foot = dlg.querySelector('[data-quiz-foot]');
  const back = dlg.querySelector('[data-quiz-back]');
  const next = dlg.querySelector('[data-quiz-next]');
  const submit = dlg.querySelector('[data-quiz-submit]');
  const formatBtns = [...dlg.querySelectorAll('[data-quiz-format]')];
  const budgets = [...dlg.querySelectorAll('[data-quiz-budget]')];
  const form = dlg.querySelector('[data-quiz-form]');
  const { phone, code, consent } = form.elements;
  const flag = dlg.querySelector('[data-quiz-flag]');
  const codeText = dlg.querySelector('[data-quiz-code-text]');
  let step = 0;
  let busy = false;
  let pick = 0;
  let format = null;

  const modal = createModal(dlg, {
    beforeClose: () => {
      dlg.dataset.closing = '';
      return new Promise((r) => setTimeout(r, t('--quiz-out-ms')));
    },
    onClosed: () => { delete dlg.dataset.closing; clearTimeout(pick); },
  });

  function show(n) {
    step = n;
    steps.forEach((s, k) => { s.hidden = k !== n; });
    fills.forEach((f, k) => f.toggleAttribute('data-on', k <= Math.min(n, 2)));
    count.hidden = n > 2;
    count.textContent = `0${Math.min(n + 1, 3)} / 03`;
    foot.hidden = n !== 1 && n !== 2;
    next.hidden = n !== 1;
    submit.hidden = n !== 2;
    body.scrollTop = 0;
  }

  function go(n) {
    if (busy || n === step) return;
    busy = true;
    dlg.dataset.dir = n > step ? 'f' : 'b';
    body.dataset.leave = '';
    setTimeout(() => {
      show(n);
      delete body.dataset.leave;
      busy = false;
      steps[n].querySelector('h2')?.focus({ preventScroll: true });
    }, t('--quiz-leave-ms'));
  }

  function reset() {
    clearTimeout(pick);
    busy = false;
    format = null;
    formatBtns.forEach((b) => b.setAttribute('aria-pressed', 'false'));
    budgets.forEach((b) => { b.checked = false; });
    next.disabled = true;
    form.reset();
    [phone, consent].forEach((el) => setError(el, false));
    syncCode();
    delete dlg.dataset.dir;
    delete body.dataset.leave;
    show(0);
  }

  formatBtns.forEach((b) => b.addEventListener('click', () => {
    formatBtns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    format = b;
    clearTimeout(pick);
    pick = setTimeout(() => go(1), t('--quiz-pick-delay'));
  }));
  budgets.forEach((b) => b.addEventListener('change', () => { next.disabled = !budgets.some((x) => x.checked); }));
  next.addEventListener('click', () => { if (budgets.some((x) => x.checked)) go(2); });
  back.addEventListener('click', () => go(Math.max(0, step - 1)));

  function syncCode() {
    codeText.textContent = code.value;
    flag.hidden = code.value !== '+380';
    if (phone.value) phone.value = formatNational(phone.value, code.value);
  }
  code.addEventListener('change', syncCode);
  phone.addEventListener('input', () => {
    phone.value = formatNational(phone.value, code.value);
    setError(phone, false);
  });
  consent.addEventListener('change', () => setError(consent, false));

  // Расчёт для выбранного формата — те же числа и та же функция, что в калькуляторе Numbers.
  function estimate() {
    const area = Number(format?.dataset.area);
    const yieldPercent = Number(format?.dataset.yield);
    if (!area || !yieldPercent) return null;
    const r = calc({
      area,
      yieldPercent,
      pricePerM2: Number(dlg.dataset.priceM2),
      firstPercent: Number(dlg.dataset.firstPercent),
      months: Number(dlg.dataset.months),
    });
    return { price: r.price, income: r.income, first: r.first, month: r.month };
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const digits = phone.value.replace(/\D/g, '').length;
    const badPhone = !nationalOk(phone.value, code.value);
    const badConsent = !consent.checked;
    setError(phone, badPhone, digits ? 'invalid' : 'required');
    setError(consent, badConsent);
    if (badPhone) { phone.focus(); return; }
    if (badConsent) { consent.focus(); return; }
    const lead = {
      form: 'quiz',
      format: format?.dataset.quizFormat,
      budget: budgets.filter((b) => b.checked).map((b) => b.value),
      name: form.elements.name.value.trim(),
      phone: `${code.value} ${phone.value}`,
      email: form.elements.email.value.trim(),
      estimate: estimate(),
    };
    // TODO(5.4): отправка lead в POST /api/lead, как у форм. При успехе — go(3) («Дякуємо»);
    // при ошибке — текст из [data-form-status] (data-msg-turnstile / data-msg-send).
    void lead;
  });

  return {
    open(opener) {
      reset();
      modal.open(opener);
    },
  };
}
