import { defineCliConfig } from 'sanity/cli';

export default defineCliConfig({
  api: { projectId: 'rxw30lco', dataset: 'production' },
  // Адрес админки: https://forrest-trinity.sanity.studio (решение человека 2026-11-19).
  studioHost: 'forrest-trinity',
  deployment: { autoUpdates: false },
  // languages.ts лежит в корне проекта (src/lib) — разрешаем дев-серверу читать файлы уровнем выше.
  vite: (config) => ({
    ...config,
    server: { ...config.server, fs: { ...config.server?.fs, allow: ['..'] } },
  }),
});
