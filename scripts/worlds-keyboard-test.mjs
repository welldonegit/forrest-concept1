/**
 * «Три світи» с клавиатуры (открытый вопрос 2026-11-25): настоящей клавишей Tab с верха страницы
 * доходим до кнопок «Детальніше» WIND / ROCK / SUN — по порядку, сцена прокручивается к кадру мира,
 * кнопка видна и под ней ничего нет; дальше Tab уходит из блока. Shift+Tab — обратно так же.
 * Мышь: невидимые слайды нажатий не принимают, нажатие по видимой кнопке и возврат фокуса после Esc
 * сцену не двигают. prefers-reduced-motion: к кадру — сразу, без плавной прокрутки.
 * uk и en, 1440×900 и 390×844.
 *
 * Запуск: npm run build:test → npm run test:ui
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startWorker } from './lib/local-worker.mjs';

const PORT = 8795;
const VIEWPORTS = [{ width: 1440, height: 900 }, { width: 390, height: 844 }];
const LANGS = ['uk', 'en'];

let worker, browser;
before(async () => {
  worker = await startWorker(PORT);
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  worker?.stop();
});

async function open(lang, viewport, reducedMotion = 'no-preference') {
  const context = await browser.newContext({ viewport, reducedMotion });
  await context.route('https://www.googletagmanager.com/**', (r) => r.fulfill({ contentType: 'application/javascript', body: '' }));
  const page = await context.newPage();
  await page.goto(`${worker.base}${lang === 'uk' ? '/' : `/${lang}/`}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForSelector('[data-worlds][data-ready]');
  return { context, page };
}

/** Что в фокусе: индекс кнопки мира, 'before' / 'after' — элемент до / после блока, 'inside' — другое в блоке. */
const where = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    const sec = document.querySelector('[data-worlds]');
    if (el?.matches('.worlds__btn')) return Number(el.dataset.world);
    if (!el || el === document.body) return 'body';
    if (sec.contains(el)) return 'inside';
    return sec.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING ? 'after' : 'before';
  });

/** Сцена дошла до кадра мира k: слайд активен, текст виден целиком, кнопка в окне и сверху ничего нет. */
async function expectShown(page, k) {
  await page.waitForFunction(
    (k) => {
      const st = document.querySelector('[data-worlds-stage]');
      const text = st.querySelector('[data-worlds-text]');
      const btn = document.activeElement;
      if (st.dataset.active !== String(k) || parseFloat(text.style.opacity) !== 1) return false;
      if (getComputedStyle(st.querySelector(`[data-slide="${k}"]`)).opacity !== '1') return false;
      const r = btn.getBoundingClientRect();
      if (r.top < 0 || r.bottom > innerHeight || r.left < 0 || r.right > innerWidth) return false;
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!hit && btn.contains(hit);
    },
    k,
    { timeout: 10_000 },
  );
}

async function tabUntilWorlds(page) {
  for (let i = 0; i < 300; i++) {
    await page.keyboard.press('Tab');
    const w = await where(page);
    if (w === 0) return i + 1;
    assert.notEqual(w, 'after', 'Tab проскочил блок «Три світи»');
    assert.notEqual(w, 1, 'первая кнопка в блоке — не WIND');
  }
  throw new Error('за 300 нажатий Tab кнопка WIND не получила фокус');
}

for (const lang of LANGS) {
  for (const vp of VIEWPORTS) {
    test(`${lang} ${vp.width}: Tab и Shift+Tab проходят WIND → ROCK → SUN, сцена у кадра мира`, async () => {
      const { context, page } = await open(lang, vp);
      try {
        await tabUntilWorlds(page);
        await expectShown(page, 0);
        for (const k of [1, 2]) {
          await page.keyboard.press('Tab');
          assert.equal(await where(page), k, `Tab → кнопка ${k}`);
          await expectShown(page, k);
        }
        await page.keyboard.press('Tab');
        assert.equal(await where(page), 'after', 'после SUN Tab уходит из блока');
        await page.keyboard.press('Shift+Tab');
        assert.equal(await where(page), 2, 'Shift+Tab → SUN');
        await expectShown(page, 2);
        for (const k of [1, 0]) {
          await page.keyboard.press('Shift+Tab');
          assert.equal(await where(page), k, `Shift+Tab → кнопка ${k}`);
          await expectShown(page, k);
        }
        await page.keyboard.press('Shift+Tab');
        assert.equal(await where(page), 'before', 'перед WIND Shift+Tab уходит из блока');
      } finally {
        await context.close();
      }
    });

    test(`${lang} ${vp.width}: мышь — невидимые слайды не нажимаются, нажатие и Esc сцену не двигают`, async () => {
      const { context, page } = await open(lang, vp);
      try {
        // Положение сцены по доле прогресса p.
        const scrollToP = (p) =>
          page.evaluate((p) => {
            const sec = document.querySelector('[data-worlds]');
            const st = sec.querySelector('[data-worlds-stage]');
            const top = sec.getBoundingClientRect().top + scrollY;
            scrollTo({ top: Math.round(top + p * (sec.offsetHeight - st.clientHeight)), behavior: 'instant' });
          }, p);
        const hitButton = () =>
          page.evaluate(() =>
            [...document.querySelectorAll('.worlds__btn')].map((b) => {
              const r = b.getBoundingClientRect();
              const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
              return !!hit && !!hit.closest('.worlds__btn');
            }),
          );
        // До проявления текста ни одна кнопка нажатие не принимает.
        await scrollToP(0.1);
        await page.waitForFunction(() => document.querySelector('[data-worlds-text]').style.opacity === '0');
        assert.deepEqual(await hitButton(), [false, false, false], 'текст скрыт — кнопки не нажимаются');
        // Кадр ROCK: нажимается только видимая кнопка, и это ROCK.
        await scrollToP(0.65);
        await page.waitForFunction(() => document.querySelector('[data-worlds-stage]').dataset.active === '1');
        await page.waitForTimeout(400);
        const btn = page.locator('.worlds__btn[data-world="1"]');
        const box = await btn.boundingBox();
        const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('.worlds__btn')?.dataset.world, {
          x: box.x + box.width / 2,
          y: box.y + box.height / 2,
        });
        assert.equal(hit, '1', 'под курсором кнопка ROCK, а не скрытый слайд');
        const y0 = await page.evaluate(() => scrollY);
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForSelector('dialog[open]', { timeout: 10_000 });
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.querySelector('dialog[open]'));
        assert.equal(await where(page), 1, 'фокус вернулся на кнопку ROCK');
        await page.waitForTimeout(800);
        assert.equal(await page.evaluate(() => scrollY), y0, 'нажатие мышью и возврат фокуса сцену не двигают');
      } finally {
        await context.close();
      }
    });
  }

  test(`${lang}: prefers-reduced-motion — к кадру мира без плавной прокрутки`, async () => {
    const { context, page } = await open(lang, VIEWPORTS[0], 'reduce');
    try {
      await tabUntilWorlds(page);
      await expectShown(page, 0);
      await page.keyboard.press('Tab');
      const y1 = await page.evaluate(() => scrollY);
      await page.waitForTimeout(300);
      assert.equal(await page.evaluate(() => scrollY), y1, 'прокрутка закончилась сразу');
      await expectShown(page, 1);
    } finally {
      await context.close();
    }
  });
}
