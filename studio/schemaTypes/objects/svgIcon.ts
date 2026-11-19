/**
 * Иконка контента: SVG-файл. При сборке сайта он очищается (без скриптов, стилей и внешних ссылок),
 * цвет заменяется на цвет текста, и иконка встраивается в страницу как сейчас (src/lib/svg.ts).
 */
import { defineType } from 'sanity';

export const svgIcon = defineType({
  name: 'svgIcon',
  title: 'Іконка (SVG)',
  type: 'file',
  options: { accept: '.svg,image/svg+xml' },
});
