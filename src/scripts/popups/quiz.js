/**
 * Квиз «Розрахувати дохід», как в выгрузке 2026-11-25 (qShow / qGo / qHide):
 * шаг 1 — формат (выбор и через 420 мс следующий шаг), шаг 2 — бюджет (несколько вариантов, «Далі»
 * доступна после выбора), шаг 3 — месенджер (один вариант, через 420 мс дальше; «Далі» — после выбора),
 * шаг 4 — контакты; после заявки — страница «Дякуємо». При каждом открытии — с начала.
 * Номер шага — в data-step окна: CSS открывает бонусы на шаге 4 и показывает реплику менеджера к шагу.
 * Переход: текущий шаг гаснет (300 мс), новый появляется по элементам; «Назад» — сверху вниз.
 * Проверка контактов — общие правила и тексты ошибок форм (form-fields.js, siteSettings.form.errors):
 * пустой или неполный телефон. Расчёт — calc() калькулятора Numbers с его числами.
 * Отправка — POST /api/lead (lead-api.js): ответы шагов и расчёт в quiz; успех — goThanks (страница «Дякуємо»,
 * событие generate_lead). Своего шага «Дякуємо» нет (решение 2026-11-25).
 * prefers-reduced-motion: без анимаций, шаги сменяются сразу.
 */
import { createModal } from './dialog.js';
import { cssNum } from './ease.js';
import { formatNational, nationalOk, setError } from '../ui/form-fields.js';
import { calc } from '../../lib/calc';
import { preloadCaptcha } from '../ui/captcha.js';
import { leadSender, goThanks, ukText } from '../ui/lead-api.js';

export function init(dlg) {
  const t = (name) => cssNum(dlg, name);
  const body = dlg.querySelector('[data-quiz-body]');
  const steps = [...dlg.querySelectorAll('[data-quiz-step]')];
  const fills = [...dlg.querySelectorAll('[data-quiz-fill]')];
  const count = dlg.querySelector('[data-quiz-count]');
  const foot = dlg.querySelector('[data-quiz-foot]');
  const back = dlg.querySelector('[data-quiz-back]');
  const next = dlg.querySelector('[data-quiz-next]');
  const formatBtns = [...dlg.querySelectorAll('[data-quiz-format]')];
  const budgets = [...dlg.querySelectorAll('[data-quiz-budget]')];
  const messengerBtns = [...dlg.querySelectorAll('[data-quiz-messenger]')];
  const bubbles = [...dlg.querySelectorAll('[data-quiz-bubble]')];
  const bubbleMessenger = dlg.querySelector('[data-quiz-bubble-messenger]');
  const form = dlg.querySelector('[data-quiz-form]');
  const { phone, code } = form.elements;
  const flag = dlg.querySelector('[data-quiz-flag]');
  const codeText = dlg.querySelector('[data-quiz-code-text]');
  let step = 0;
  let busy = false;
  let pick = 0;
  let format = null;
  let messenger = null;
  const send = leadSender(form, 'quiz');
  // вопросы и ответы — по-украински при любом языке страницы (data-uk, docs/LEADS.md)
  const stepTitle = (n) => { const h = steps[n].querySelector('h2'); return h ? ukText(h) : ''; };

  const modal = createModal(dlg, {
    beforeClose: () => {
      dlg.dataset.closing = '';
      return new Promise((r) => setTimeout(r, t('--quiz-out-ms')));
    },
    onClosed: () => { delete dlg.dataset.closing; clearTimeout(pick); },
  });

  const canNext = () => (step === 1 ? budgets.some((x) => x.checked) : step === 2 ? Boolean(messenger) : false);

  function show(n) {
    step = n;
    dlg.dataset.step = String(n);
    steps.forEach((s, k) => { s.hidden = k !== n; });
    bubbles.forEach((b, k) => { b.hidden = k !== n; });
    fills.forEach((f, k) => f.toggleAttribute('data-on', k <= n));
    count.textContent = `0${n + 1} / 0${steps.length}`;
    foot.hidden = n === 0;
    next.hidden = n !== 1 && n !== 2;
    next.disabled = !canNext();
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
    messenger = null;
    [...formatBtns, ...messengerBtns].forEach((b) => b.setAttribute('aria-pressed', 'false'));
    budgets.forEach((b) => { b.checked = false; });
    form.reset();
    setError(phone, false);
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
  messengerBtns.forEach((b) => b.addEventListener('click', () => {
    messengerBtns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    messenger = b;
    bubbleMessenger.textContent = b.querySelector('[data-quiz-messenger-label]').textContent;
    next.disabled = false;
    clearTimeout(pick);
    pick = setTimeout(() => go(3), t('--quiz-pick-delay'));
  }));
  budgets.forEach((b) => b.addEventListener('change', () => { next.disabled = !canNext(); }));
  next.addEventListener('click', () => { if (canNext()) go(step + 1); });
  back.addEventListener('click', () => { clearTimeout(pick); go(Math.max(0, step - 1)); });

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

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const digits = phone.value.replace(/\D/g, '').length;
    const badPhone = !nationalOk(phone.value, code.value);
    setError(phone, badPhone, digits ? 'invalid' : 'required');
    if (badPhone) { phone.focus(); return; }
    const nameEl = format?.querySelector('.quiz__opt-name');
    const formatName = nameEl ? ukText(nameEl) : '';
    const budget = budgets.filter((b) => b.checked).map((b) => b.dataset.uk ?? b.value).join(', ');
    const messengerName = messenger ? messenger.dataset.uk ?? messenger.querySelector('[data-quiz-messenger-label]').textContent.trim() : '';
    const est = estimate();
    const result = await send({
      fields: {
        name: form.elements.name.value.trim() || undefined,
        phone: `${code.value} ${phone.value}`,
        contactMethod: messengerName || undefined,
        format: formatName || undefined,
        areaFrom: format?.dataset.areaFrom,
        areaTo: format?.dataset.areaTo,
        budget: budget || undefined,
        budgetCurrency: budget.includes('$') ? 'usd' : undefined,
        country: code.value,
      },
      quiz: {
        answers: [
          { question: stepTitle(0), answer: formatName },
          { question: stepTitle(1), answer: budget },
          { question: stepTitle(2), answer: messengerName },
        ],
        calc: est ? Object.fromEntries(Object.entries(est).map(([k, v]) => [k, Math.round(v)])) : {},
      },
    });
    if (result) goThanks('quiz', result.number, { phone: `${code.value} ${phone.value}` });
  });

  return {
    open(opener) {
      preloadCaptcha().catch(() => {});
      reset();
      modal.open(opener);
    },
  };
}
