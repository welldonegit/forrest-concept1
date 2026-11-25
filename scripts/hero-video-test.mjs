/**
 * Hero: кнопка презентации открывает видео в том же попапе, что у Season (решение 2026-11-25).
 * - До нажатия страница не обращается к YouTube (полный список запросов при загрузке и наведении).
 * - С клавиатуры: Enter и пробел открывают; Esc, крестик и подложка закрывают; фокус возвращается на кнопку;
 *   при закрытии плеер удаляется (видео останавливается).
 * - uk и en, компьютер (1440) и телефон (390).
 * YouTube в тесте подменён пустой страницей: проверяется адрес плеера, не сам сервис.
 *
 * Запуск: npm run build:test → npm run test:ui
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startWorker } from './lib/local-worker.mjs';

const PORT = 8797;
const YT = /youtube|ytimg|googlevideo|ggpht/;

let worker, browser;
before(async () => {
  worker = await startWorker(PORT);
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  worker?.stop();
});

async function setup(lang, viewport, mobile) {
  const context = await browser.newContext({ viewport, ...(mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  await context.route('https://www.googletagmanager.com/**', (r) => r.fulfill({ contentType: 'application/javascript', body: '' }));
  const yt = [];
  await context.route(YT, (r) => { yt.push(r.request().url()); return r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>player</title>' }); });
  const page = await context.newPage();
  await page.goto(`${worker.base}${lang === 'uk' ? '/' : `/${lang}/`}`);
  return { context, page, yt };
}

const state = (page) => page.evaluate(() => ({
  open: !!document.querySelector('dialog[open][data-vpop]'),
  locked: document.documentElement.classList.contains('is-pop-locked'),
  iframe: document.querySelector('[data-vpop-frame] iframe')?.src ?? null,
  focus: document.activeElement?.matches('.hero__play') ?? false,
}));
const closed = (page) => page.waitForFunction(() => !document.querySelector('dialog[open]') && !document.documentElement.classList.contains('is-pop-locked'));

for (const [lang, viewport, mobile] of [['uk', { width: 1440, height: 900 }, false], ['uk', { width: 390, height: 844 }, true], ['en', { width: 1440, height: 900 }, false]]) {
  test(`${lang} ${viewport.width}: до нажатия к YouTube нет запросов; Enter, пробел, Esc, крестик, подложка`, async () => {
    const { context, page, yt } = await setup(lang, viewport, mobile);
    try {
      const play = page.locator('.hero__play');
      const src = await play.getAttribute('data-video-src');
      assert.match(src, /youtu/, 'у кнопки адрес видео из «Відео презентації»');
      assert.equal(await play.getAttribute('data-popup'), 'video');
      // загрузка, прокрутка до конца и назад, наведение на кнопку (подгрузка попапа) — YouTube не трогаем
      await page.waitForTimeout(1500);
      await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(800);
      await page.evaluate(() => scrollTo(0, 0));
      await page.waitForTimeout(800);
      if (!mobile) await play.hover();
      await page.waitForTimeout(800);
      assert.deepEqual(yt, [], 'до нажатия запросов к YouTube нет');

      const id = src.split('/').pop().split(/[?&]/)[0];
      // Enter
      await play.focus();
      await page.keyboard.press('Enter');
      await page.locator('dialog[open][data-vpop] iframe').waitFor();
      let s = await state(page);
      assert.ok(s.locked, 'страница заперта');
      assert.match(s.iframe, new RegExp(`^https://www\\.youtube-nocookie\\.com/embed/${id}\\?`), 'плеер без cookie, то же видео');
      for (let i = 0; i < 20 && !yt.length; i++) await page.waitForTimeout(100);
      assert.ok(yt.length > 0, 'после нажатия плеер грузится');
      await page.keyboard.press('Escape');
      await closed(page);
      s = await state(page);
      assert.equal(s.iframe, null, 'Esc: плеер удалён — видео остановлено');
      assert.ok(s.focus, 'Esc: фокус на кнопке');

      // пробел → крестик
      await page.keyboard.press('Space');
      await page.locator('dialog[open][data-vpop] iframe').waitFor();
      await page.locator('.vpop__close').click();
      await closed(page);
      s = await state(page);
      assert.equal(s.iframe, null, 'крестик: плеер удалён');
      assert.ok(s.focus, 'крестик: фокус на кнопке');

      // подложка
      await play.click();
      await page.locator('dialog[open][data-vpop] iframe').waitFor();
      await page.waitForTimeout(300);
      await page.mouse.click(8, viewport.height - 8);
      await closed(page);
      s = await state(page);
      assert.equal(s.iframe, null, 'подложка: плеер удалён');
      assert.ok(s.focus, 'подложка: фокус на кнопке');
    } finally {
      await context.close();
    }
  });
}
