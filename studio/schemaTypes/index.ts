import { photo } from './objects/photo';
import { blockTypes, blockObjectTypes } from './blocks';
import { landing } from './documents/landing';
import { groupTypes } from './lib/i18n';

/** Документы, которые существуют в одном экземпляре: без «создать» и «удалить». */
export const singletonTypes = new Set(['landing']);

export const schemaTypes = [landing, ...blockTypes, ...blockObjectTypes, photo, ...groupTypes];
