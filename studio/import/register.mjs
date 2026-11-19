// Подменяет `sanity` заглушкой при загрузке схем Studio в Node (node --import ./register.mjs).
import { register } from 'node:module';
register(new URL('./hooks.mjs', import.meta.url));
