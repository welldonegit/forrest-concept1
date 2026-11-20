/**
 * Worker сайта FORREST: только /api/* (wrangler.jsonc → assets.run_worker_first).
 * Статика отдаётся сервером статики без вызова этого кода.
 */
import type { Env } from './env';
import { error } from './http';
import { handleLead } from './lead/handler';

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/lead' || pathname === '/api/lead/') return handleLead(request, env, ctx);
    // Сюда же попадают запросы не-навигации к несуществующим файлам — 404 без обращения к базе.
    return error('not_found', 404);
  },
} satisfies ExportedHandler<Env>;
