/**
 * Видео-попап (4.17). Адрес видео — у кнопки (data-video-src, из Sanity). Плеер YouTube (iframe)
 * создаётся при открытии и удаляется при закрытии: до нажатия к YouTube нет ни одного запроса,
 * после закрытия звук не продолжает играть. Ссылки youtube.com / youtu.be переводятся
 * в режим без cookie (youtube-nocookie.com/embed) — плеер выглядит так же, как в выгрузке.
 */
import { createModal } from './dialog.js';

function embedUrl(src) {
  let url;
  try { url = new URL(src, location.href); } catch { return ''; }
  const host = url.hostname.replace(/^www\./, '');
  let id = '';
  if (host === 'youtu.be') id = url.pathname.slice(1);
  else if (/(^|\.)youtube(-nocookie)?\.com$/.test(host)) id = url.searchParams.get('v') || url.pathname.split('/').filter(Boolean).pop();
  if (!id) return '';
  const out = new URL(`https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`);
  out.search = new URLSearchParams({ autoplay: '1', rel: '0', playsinline: '1' }).toString();
  return out.href;
}

export function init(dlg) {
  const frame = dlg.querySelector('[data-vpop-frame]');
  const modal = createModal(dlg, { onClosed: () => frame.replaceChildren() });

  function open(opener) {
    const src = embedUrl(opener.dataset.videoSrc || '');
    if (!src) return;
    const iframe = document.createElement('iframe');
    iframe.title = frame.dataset.title;
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    iframe.allowFullscreen = true;
    iframe.src = src;
    frame.replaceChildren(iframe);
    modal.open(opener);
  }

  return { open };
}
