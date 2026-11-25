/**
 * Кнопка «Звʼязатися» и её попап (выгрузка 2026-11-25-contact-popup) на всех страницах с шапкой:
 * главная, архив, документ, «Дякуємо», 404 — uk и en.
 * - Кнопка открывает попап; фокус в поле «Імʼя»; Tab не выходит из окна; страница под окном не прокручивается;
 *   Esc, подложка и крестик закрывают; фокус возвращается на кнопку.
 * - Без JS кнопка — ссылка tel: на номер из «Контакти».
 * - prefers-reduced-motion — без анимаций появления.
 * - Шапка по-прежнему прячется при прокрутке вниз и возвращается при прокрутке вверх.
 *
 * Запуск: npm run build:test → npm run test:ui
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startWorker } from './lib/local-worker.mjs';

const PORT = 8796;
const PAGES = ['', 'archive/', 'dokumenty/dozvil-na-budivelni-roboty/', 'thanks/', 'net-takoi-storinky/'];
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

const url = (lang, path) => `${worker.base}${lang === 'uk' ? '/' : `/${lang}/`}${path}`;

async function newContext(opts = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
  await context.route('https://www.googletagmanager.com/**', (r) => r.fulfill({ contentType: 'application/javascript', body: '' }));
  return context;
}

const focused = (page) => page.evaluate(() => {
  const el = document.activeElement;
  return el?.matches('.site-header__cta') ? 'cta' : el?.getAttribute('name') ?? el?.className ?? el?.tagName;
});

for (const lang of LANGS) {
  for (const path of PAGES) {
    test(`${lang} /${path}: кнопка открывает попап; фокус, Tab, Esc, подложка, крестик, прокрутка`, async () => {
      const context = await newContext();
      const page = await context.newPage();
      try {
        await page.goto(url(lang, path));
        const cta = page.locator('.site-header__cta');
        assert.equal(await cta.getAttribute('data-popup'), 'contact');
        assert.match(await cta.getAttribute('href'), /^tel:\+\d+$/);

        await cta.click();
        const dlg = page.locator('dialog[open][data-cpop]');
        await dlg.waitFor();
        assert.equal(await focused(page), 'name', 'фокус в поле «Імʼя»');
        assert.equal(await page.evaluate(() => document.documentElement.classList.contains('is-pop-locked')), true, 'страница заперта');
        const y0 = await page.evaluate(() => scrollY);
        await page.mouse.wheel(0, 600);
        await page.waitForTimeout(300);
        assert.equal(await page.evaluate(() => scrollY), y0, 'страница под попапом не прокручивается');
        // Tab по кругу внутри окна
        for (let i = 0; i < 8; i++) {
          await page.keyboard.press('Tab');
          assert.equal(await page.evaluate(() => !!document.activeElement.closest('dialog[open]')), true, `Tab ${i + 1}: фокус в окне`);
        }
        await page.keyboard.press('Escape');
        // событие close (снимает блокировку и возвращает фокус) приходит после закрытия окна
        await page.waitForFunction(() => !document.querySelector('dialog[open]') && !document.documentElement.classList.contains('is-pop-locked'));
        assert.equal(await focused(page), 'cta', 'Esc: фокус вернулся на кнопку');

        // подложка (край окна вне карточки)
        await cta.click();
        await dlg.waitFor();
        await page.waitForTimeout(800);
        await page.mouse.click(20, 450);
        await page.waitForFunction(() => !document.querySelector('dialog[open]') && !document.documentElement.classList.contains('is-pop-locked'));
        assert.equal(await focused(page), 'cta', 'подложка: фокус на кнопке');

        // крестик; введённое в прошлый раз сбрасывается при новом открытии (как в выгрузке)
        await cta.click();
        await dlg.waitFor();
        await page.locator('.cpop__input[name=name]').fill('Тест');
        await page.locator('.cpop__x').click();
        await page.waitForFunction(() => !document.querySelector('dialog[open]') && !document.documentElement.classList.contains('is-pop-locked'));
        assert.equal(await focused(page), 'cta', 'крестик: фокус на кнопке');
        await cta.click();
        await dlg.waitFor();
        assert.equal(await page.locator('.cpop__input[name=name]').inputValue(), '');
      } finally {
        await context.close();
      }
    });
  }

  test(`${lang}: без JS кнопка звонит на номер из «Контакти»`, async () => {
    const context = await newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    try {
      for (const path of PAGES) {
        await page.goto(url(lang, path));
        const cta = page.locator('.site-header__cta');
        const href = await cta.getAttribute('href');
        assert.match(href, /^tel:\+\d{10,15}$/, `/${path}`);
        const phone = await page.locator('.site-menu__phone').getAttribute('href');
        assert.equal(href, phone, 'тот же номер, что в меню');
      }
    } finally {
      await context.close();
    }
  });

  test(`${lang}: prefers-reduced-motion — попап без анимаций`, async () => {
    const context = await newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    try {
      await page.goto(url(lang, ''));
      await page.locator('.site-header__cta').click();
      await page.locator('dialog[open][data-cpop]').waitFor();
      const running = await page.evaluate(() => document.querySelector('dialog[open]').getAnimations({ subtree: true }).length);
      assert.equal(running, 0);
    } finally {
      await context.close();
    }
  });
}

test('шапка: прячется при прокрутке вниз, возвращается при прокрутке вверх (без изменений)', async () => {
  const context = await newContext();
  const page = await context.newPage();
  try {
    await page.goto(url('uk', ''));
    await page.waitForTimeout(500);
    await page.mouse.wheel(0, 1200);
    await page.waitForFunction(() => document.querySelector('.site-header').hasAttribute('data-hidden'));
    await page.mouse.wheel(0, -300);
    await page.waitForFunction(() => !document.querySelector('.site-header').hasAttribute('data-hidden'));
  } finally {
    await context.close();
  }
});
