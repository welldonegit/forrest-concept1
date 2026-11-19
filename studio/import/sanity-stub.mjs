// Заглушка пакета `sanity` для чтения схем Studio в Node (скрипт импорта):
// схемам нужны только defineType/defineField/defineArrayMember — они возвращают описание как есть.
export const defineType = (x) => x;
export const defineField = (x) => x;
export const defineArrayMember = (x) => x;
